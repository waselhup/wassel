import { Router, Request, Response } from 'express';
import { randomBytes } from 'crypto';
import { supabase } from '../supabase';
import { encrypt } from './encryption';

const router = Router();

const LINKEDIN_AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const LINKEDIN_USERINFO_URL = 'https://api.linkedin.com/v2/userinfo';
const SCOPES = 'openid profile email';
const STATE_TTL_MINUTES = 10;

/**
 * Sanitize an env var: trim whitespace, strip surrounding quotes.
 */
function sanitizeEnv(val: string | undefined): string {
    if (!val) return '';
    let s = val.trim();
    // Strip surrounding single or double quotes
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
        s = s.slice(1, -1).trim();
    }
    return s;
}

function getConfig() {
    const clientId = sanitizeEnv(process.env.LINKEDIN_CLIENT_ID);
    const clientSecret = sanitizeEnv(process.env.LINKEDIN_CLIENT_SECRET);
    const redirectUri = sanitizeEnv(process.env.LINKEDIN_REDIRECT_URI) || 'https://wassel-alpha.vercel.app/api/auth/linkedin/callback';
    const appUrl = sanitizeEnv(process.env.APP_URL) || 'https://wassel-alpha.vercel.app';

    if (!clientId || clientId.includes(' ')) {
        throw new Error(`Missing/invalid LINKEDIN_CLIENT_ID env var (len=${clientId.length}, hasSpace=${clientId.includes(' ')})`);
    }
    if (!clientSecret || clientSecret.includes(' ')) {
        throw new Error(`Missing/invalid LINKEDIN_CLIENT_SECRET env var (len=${clientSecret.length})`);
    }

    return { clientId, clientSecret, redirectUri, appUrl };
}

/**
 * GET /api/auth/linkedin/start?invite=TOKEN
 * Validates invite, creates CSRF state, redirects to LinkedIn consent.
 */
router.get('/start', async (req: Request, res: Response) => {
    try {
        const inviteToken = req.query.invite as string;
        if (!inviteToken) {
            return res.status(400).json({ error: 'invite parameter required' });
        }

        // Validate invite token
        const { data: invite, error: inviteError } = await supabase
            .from('client_invites')
            .select('id, client_id, expires_at, used_at')
            .eq('token', inviteToken)
            .single();

        if (inviteError || !invite) {
            return res.status(404).json({ error: 'Invalid invite token' });
        }

        if (invite.used_at) {
            return res.status(400).json({ error: 'Invite already used' });
        }

        if (new Date(invite.expires_at) < new Date()) {
            return res.status(400).json({ error: 'Invite expired' });
        }

        // Generate CSRF state
        const state = randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + STATE_TTL_MINUTES * 60 * 1000).toISOString();

        // Store state → invite mapping
        await supabase.from('oauth_states').insert({
            state,
            invite_token: inviteToken,
            client_id: invite.client_id,
            expires_at: expiresAt,
        });

        let config: ReturnType<typeof getConfig>;
        try {
            config = getConfig();
        } catch (envErr: any) {
            console.error('[LinkedIn OAuth] ENV_ERROR:', envErr.message);
            return res.status(500).json({ error: envErr.message });
        }

        // Debug logging (safe: mask most of client_id)
        const tail = config.clientId.slice(-3);
        const masked = '*'.repeat(Math.max(0, config.clientId.length - 3)) + tail;
        console.log(`[LinkedIn OAuth] START client_id_len=${config.clientId.length} client_id=${masked} redirect_uri=${config.redirectUri} scope=${SCOPES} state=${state.substring(0, 8)}...`);

        // Build LinkedIn OAuth URL — use manual concatenation to avoid any URLSearchParams encoding issues
        const authUrl = `${LINKEDIN_AUTH_URL}?response_type=code&client_id=${encodeURIComponent(config.clientId)}&redirect_uri=${encodeURIComponent(config.redirectUri)}&state=${encodeURIComponent(state)}&scope=${encodeURIComponent(SCOPES)}`;

        console.log(`[LinkedIn OAuth] REDIRECT_URL=${authUrl.substring(0, 120)}...`);

        return res.redirect(302, authUrl);
    } catch (error) {
        console.error('[LinkedIn OAuth] Start error:', error);
        return res.status(500).json({ error: 'Failed to start LinkedIn OAuth' });
    }
});

/**
 * GET /api/auth/linkedin/debug
 * Returns masked OAuth config for diagnosing issues. No auth required (read-only, safe).
 */
router.get('/debug', (_req: Request, res: Response) => {
    const rawId = process.env.LINKEDIN_CLIENT_ID || '';
    const rawSecret = process.env.LINKEDIN_CLIENT_SECRET || '';
    const rawRedirect = process.env.LINKEDIN_REDIRECT_URI || '';

    const clientId = sanitizeEnv(process.env.LINKEDIN_CLIENT_ID);
    const redirectUri = sanitizeEnv(process.env.LINKEDIN_REDIRECT_URI) || 'https://wassel-alpha.vercel.app/api/auth/linkedin/callback';

    res.json({
        client_id_raw_len: rawId.length,
        client_id_raw_first3: rawId.substring(0, 3),
        client_id_raw_last3: rawId.slice(-3),
        client_id_raw_charCodes_first5: Array.from(rawId.substring(0, 5)).map(c => c.charCodeAt(0)),
        client_id_sanitized: clientId ? `${clientId.substring(0, 3)}..${clientId.slice(-3)}` : 'EMPTY',
        client_id_sanitized_len: clientId.length,
        client_secret_present: rawSecret.length > 0,
        client_secret_len: rawSecret.length,
        redirect_uri: redirectUri,
        scopes: SCOPES,
        auth_url: LINKEDIN_AUTH_URL,
    });
});

/**
 * GET /api/auth/linkedin/callback?code=...&state=...
 * Exchanges code for tokens, fetches profile, stores in DB, redirects to /connected.
 */
router.get('/callback', async (req: Request, res: Response) => {
    try {
        const code = req.query.code as string;
        const state = req.query.state as string;
        const errorParam = req.query.error as string;

        const config = getConfig();

        // Handle user denial
        if (errorParam) {
            console.error('[LinkedIn OAuth] User denied:', errorParam);
            return res.redirect(302, `${config.appUrl}/invite/error?reason=denied`);
        }

        if (!code || !state) {
            return res.status(400).json({ error: 'code and state are required' });
        }

        // Verify state (CSRF protection)
        const { data: oauthState, error: stateError } = await supabase
            .from('oauth_states')
            .select('id, invite_token, client_id, expires_at')
            .eq('state', state)
            .single();

        if (stateError || !oauthState) {
            console.error('[LinkedIn OAuth] Invalid state:', stateError);
            return res.status(400).json({ error: 'Invalid OAuth state (CSRF check failed)' });
        }

        if (new Date(oauthState.expires_at) < new Date()) {
            return res.status(400).json({ error: 'OAuth state expired' });
        }

        // Delete used state immediately
        await supabase.from('oauth_states').delete().eq('id', oauthState.id);

        // Exchange code for access token
        const tokenResponse = await fetch(LINKEDIN_TOKEN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                redirect_uri: config.redirectUri,
                client_id: config.clientId,
                client_secret: config.clientSecret,
            }).toString(),
        });

        if (!tokenResponse.ok) {
            const errBody = await tokenResponse.text();
            console.error('[LinkedIn OAuth] Token exchange failed:', errBody);
            return res.status(400).json({ error: 'Failed to exchange code for token' });
        }

        const tokenData = await tokenResponse.json() as {
            access_token: string;
            expires_in: number;
            refresh_token?: string;
            scope?: string;
        };

        // Fetch user profile from LinkedIn UserInfo endpoint (OIDC)
        const userInfoResponse = await fetch(LINKEDIN_USERINFO_URL, {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });

        let linkedinProfile = { sub: '', name: '', email: '' };
        if (userInfoResponse.ok) {
            const userInfo = await userInfoResponse.json() as {
                sub: string;
                name?: string;
                given_name?: string;
                family_name?: string;
                email?: string;
            };
            linkedinProfile = {
                sub: userInfo.sub || '',
                name: userInfo.name || `${userInfo.given_name || ''} ${userInfo.family_name || ''}`.trim(),
                email: userInfo.email || '',
            };
        }

        // Encrypt tokens before storing
        const encryptedAccessToken = encrypt(tokenData.access_token);
        const encryptedRefreshToken = tokenData.refresh_token ? encrypt(tokenData.refresh_token) : null;
        const tokenExpiresAt = tokenData.expires_in
            ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
            : null;

        // Store LinkedIn connection
        await supabase.from('linkedin_connections').upsert(
            {
                client_id: oauthState.client_id,
                linkedin_member_id: linkedinProfile.sub,
                linkedin_name: linkedinProfile.name,
                linkedin_email: linkedinProfile.email,
                access_token: encryptedAccessToken,
                refresh_token: encryptedRefreshToken,
                token_expires_at: tokenExpiresAt,
                scopes: tokenData.scope || SCOPES,
            },
            { onConflict: 'client_id' }
        );

        // Mark invite as used
        await supabase
            .from('client_invites')
            .update({ used_at: new Date().toISOString() })
            .eq('token', oauthState.invite_token);

        // Mark client as connected
        await supabase
            .from('clients')
            .update({ status: 'connected', updated_at: new Date().toISOString() })
            .eq('id', oauthState.client_id);

        // Redirect to success page
        return res.redirect(302, `${config.appUrl}/connected`);
    } catch (error) {
        console.error('[LinkedIn OAuth] Callback error:', error);
        const appUrl = process.env.APP_URL || 'https://wassel-alpha.vercel.app';
        return res.redirect(302, `${appUrl}/connected?error=callback_failed`);
    }
});

export default router;
