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
        throw new Error(`Missing/invalid LINKEDIN_CLIENT_ID env var (len=${clientId.length})`);
    }
    if (!clientSecret || clientSecret.includes(' ')) {
        throw new Error(`Missing/invalid LINKEDIN_CLIENT_SECRET env var (len=${clientSecret.length})`);
    }

    return { clientId, clientSecret, redirectUri, appUrl };
}

function getAppUrl(): string {
    return sanitizeEnv(process.env.APP_URL) || 'https://wassel-alpha.vercel.app';
}

/**
 * GET /api/auth/linkedin/start?invite=TOKEN
 * Validates invite, creates CSRF state in DB, redirects to LinkedIn consent.
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

        // Generate cryptographically secure CSRF state (32 bytes = 64 hex chars)
        const state = randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + STATE_TTL_MINUTES * 60 * 1000).toISOString();

        // Store state in DB with all necessary data
        const { error: insertError } = await supabase.from('oauth_states').insert({
            state,
            invite_token: inviteToken,
            client_id: invite.client_id,
            expires_at: expiresAt,
            // used_at stays null until callback processes it
        });

        if (insertError) {
            console.error(`[LinkedIn OAuth] STATE_INSERT_FAIL error=`, insertError);
            return res.status(500).json({ error: 'Failed to create OAuth state' });
        }

        let config: ReturnType<typeof getConfig>;
        try {
            config = getConfig();
        } catch (envErr: any) {
            console.error('[LinkedIn OAuth] ENV_ERROR:', envErr.message);
            return res.status(500).json({ error: envErr.message });
        }

        // Debug logging (safe: only state tail + lengths)
        const stateTail = state.slice(-4);
        const clientIdMasked = '*'.repeat(Math.max(0, config.clientId.length - 3)) + config.clientId.slice(-3);
        console.log(`[LinkedIn OAuth] START state_tail=${stateTail} client_id=${clientIdMasked} redirect_uri=${config.redirectUri} scope=${SCOPES}`);

        // Build LinkedIn OAuth URL
        const authUrl = `${LINKEDIN_AUTH_URL}?response_type=code&client_id=${encodeURIComponent(config.clientId)}&redirect_uri=${encodeURIComponent(config.redirectUri)}&state=${encodeURIComponent(state)}&scope=${encodeURIComponent(SCOPES)}`;

        // Set fallback cookie (optional, for environments that block DB)
        res.cookie('wassel_oauth_state', state, {
            httpOnly: true,
            secure: true,
            sameSite: 'none',
            path: '/',
            maxAge: STATE_TTL_MINUTES * 60 * 1000,
        });

        return res.redirect(302, authUrl);
    } catch (error) {
        console.error('[LinkedIn OAuth] Start error:', error);
        return res.status(500).json({ error: 'Failed to start LinkedIn OAuth' });
    }
});

/**
 * GET /api/auth/linkedin/debug
 * Returns masked OAuth config for diagnosing issues.
 */
router.get('/debug', (_req: Request, res: Response) => {
    const rawId = process.env.LINKEDIN_CLIENT_ID || '';
    const rawSecret = process.env.LINKEDIN_CLIENT_SECRET || '';
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
 * ALL errors redirect to /oauth/error — never returns raw JSON to the end user.
 */
router.get('/callback', async (req: Request, res: Response) => {
    const appUrl = getAppUrl();

    try {
        const code = req.query.code as string;
        const state = req.query.state as string;
        const errorParam = req.query.error as string;

        // 1) Handle user denial on LinkedIn
        if (errorParam) {
            console.log(`[LinkedIn OAuth] CALLBACK_DENIED reason=${errorParam}`);
            return res.redirect(302, `${appUrl}/oauth/error?reason=denied`);
        }

        if (!code || !state) {
            console.log(`[LinkedIn OAuth] CALLBACK_MISSING code=${!!code} state=${!!state}`);
            return res.redirect(302, `${appUrl}/oauth/error?reason=missing_params`);
        }

        const stateTail = state.slice(-4);
        console.log(`[LinkedIn OAuth] CALLBACK_START state_tail=${stateTail} state_len=${state.length}`);

        // 2) Validate state via DB lookup
        const { data: stateRows, error: stateQueryError } = await supabase
            .from('oauth_states')
            .select('id, invite_token, client_id, expires_at')
            .eq('state', state)
            .limit(1);

        // Log what we found for debugging
        if (stateQueryError) {
            console.error(`[LinkedIn OAuth] STATE_QUERY_ERROR state_tail=${stateTail} error=`, JSON.stringify(stateQueryError));
            return res.redirect(302, `${appUrl}/oauth/error?reason=state_query_error`);
        }

        const oauthState = stateRows?.[0];

        if (!oauthState) {
            console.error(`[LinkedIn OAuth] STATE_NOT_FOUND state_tail=${stateTail} state_len=${state.length} (state already used or never created)`);
            return res.redirect(302, `${appUrl}/oauth/error?reason=invalid_state`);
        }

        // Log state details
        console.log(`[LinkedIn OAuth] STATE_FOUND id=${oauthState.id} expires_at=${oauthState.expires_at}`);

        if (new Date(oauthState.expires_at) < new Date()) {
            console.log(`[LinkedIn OAuth] STATE_EXPIRED state_tail=${stateTail} expires=${oauthState.expires_at}`);
            // Clean up expired state
            await supabase.from('oauth_states').delete().eq('id', oauthState.id);
            return res.redirect(302, `${appUrl}/oauth/error?reason=state_expired`);
        }

        // 3) Delete state immediately to prevent replay attacks (atomic)
        const { error: deleteError } = await supabase
            .from('oauth_states')
            .delete()
            .eq('id', oauthState.id);

        if (deleteError) {
            console.error(`[LinkedIn OAuth] STATE_DELETE_FAIL state_tail=${stateTail}`, deleteError);
            return res.redirect(302, `${appUrl}/oauth/error?reason=state_claim_failed`);
        }

        console.log(`[LinkedIn OAuth] STATE_CLAIMED state_tail=${stateTail}`);

        // 4) Get config (sanitized env vars)
        let config: ReturnType<typeof getConfig>;
        try {
            config = getConfig();
        } catch (envErr: any) {
            console.error('[LinkedIn OAuth] ENV_ERROR in callback:', envErr.message);
            return res.redirect(302, `${appUrl}/oauth/error?reason=server_config_error`);
        }

        // 5) Exchange code for access token
        console.log(`[LinkedIn OAuth] TOKEN_EXCHANGE state_tail=${stateTail}`);
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
            console.error(`[LinkedIn OAuth] TOKEN_EXCHANGE_FAIL status=${tokenResponse.status} body=${errBody.substring(0, 200)}`);
            return res.redirect(302, `${appUrl}/oauth/error?reason=token_exchange_failed`);
        }

        const tokenData = await tokenResponse.json() as {
            access_token: string;
            expires_in: number;
            refresh_token?: string;
            scope?: string;
        };

        console.log(`[LinkedIn OAuth] TOKEN_OK state_tail=${stateTail} scope=${tokenData.scope}`);

        // 6) Fetch user profile from LinkedIn UserInfo endpoint (OIDC)
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
            console.log(`[LinkedIn OAuth] PROFILE_OK name=${linkedinProfile.name} email_present=${!!linkedinProfile.email}`);
        } else {
            console.log(`[LinkedIn OAuth] PROFILE_FAIL status=${userInfoResponse.status}`);
        }

        // 7) Encrypt tokens before storing
        const encryptedAccessToken = encrypt(tokenData.access_token);
        const encryptedRefreshToken = tokenData.refresh_token ? encrypt(tokenData.refresh_token) : null;
        const tokenExpiresAt = tokenData.expires_in
            ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
            : null;

        // 8) Store LinkedIn connection
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

        // 9) Mark invite as used
        await supabase
            .from('client_invites')
            .update({ used_at: new Date().toISOString() })
            .eq('token', oauthState.invite_token);

        // 10) Mark client as connected
        await supabase
            .from('clients')
            .update({ status: 'connected', updated_at: new Date().toISOString() })
            .eq('id', oauthState.client_id);

        console.log(`[LinkedIn OAuth] CALLBACK_SUCCESS client_id=${oauthState.client_id} state_tail=${stateTail}`);

        // 11) Redirect to success page
        return res.redirect(302, `${appUrl}/connected?ok=1`);
    } catch (error) {
        console.error('[LinkedIn OAuth] CALLBACK_FATAL error=', error);
        return res.redirect(302, `${appUrl}/oauth/error?reason=callback_failed`);
    }
});

export default router;
