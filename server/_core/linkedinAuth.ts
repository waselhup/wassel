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

function getConfig() {
    const clientId = process.env.LINKEDIN_CLIENT_ID;
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
    const redirectUri = process.env.LINKEDIN_REDIRECT_URI || 'https://wassel-alpha.vercel.app/api/auth/linkedin/callback';
    const appUrl = process.env.APP_URL || 'https://wassel-alpha.vercel.app';

    if (!clientId || !clientSecret) {
        throw new Error('Missing LINKEDIN_CLIENT_ID or LINKEDIN_CLIENT_SECRET');
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

        const config = getConfig();

        // Build LinkedIn OAuth URL
        const params = new URLSearchParams({
            response_type: 'code',
            client_id: config.clientId,
            redirect_uri: config.redirectUri,
            state,
            scope: SCOPES,
        });

        const authUrl = `${LINKEDIN_AUTH_URL}?${params.toString()}`;
        return res.redirect(302, authUrl);
    } catch (error) {
        console.error('[LinkedIn OAuth] Start error:', error);
        return res.status(500).json({ error: 'Failed to start LinkedIn OAuth' });
    }
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
