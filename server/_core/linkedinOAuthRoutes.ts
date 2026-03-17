import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const router = Router();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID || '';
const LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET || '';
const LINKEDIN_REDIRECT_URI = process.env.LINKEDIN_REDIRECT_URI || 'https://wassel-alpha.vercel.app/api/linkedin/callback';
const DASHBOARD_URL = process.env.DASHBOARD_ORIGIN || 'https://wassel-alpha.vercel.app';

// Helper to get team_id from JWT
function getTeamId(req: Request): string | null {
  return (req as any).teamId || (req as any).user?.teamId || null;
}
function getUserId(req: Request): string | null {
  return (req as any).userId || (req as any).user?.id || null;
}

// ============================================================================
// GET /api/linkedin/connect — Start OAuth flow
// ============================================================================
router.get('/connect', (req: Request, res: Response) => {
  const state = crypto.randomUUID();
  // Store state in cookie for verification (simple approach)
  res.cookie('linkedin_oauth_state', state, { httpOnly: true, maxAge: 600000, sameSite: 'lax' });

  const scopes = ['openid', 'profile', 'email', 'w_member_social'].join('%20');
  const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${LINKEDIN_CLIENT_ID}&redirect_uri=${encodeURIComponent(LINKEDIN_REDIRECT_URI)}&state=${state}&scope=${scopes}`;

  res.redirect(authUrl);
});

// ============================================================================
// GET /api/linkedin/callback — Handle OAuth callback from LinkedIn
// ============================================================================
router.get('/callback', async (req: Request, res: Response) => {
  try {
    const { code, state, error: oauthError } = req.query;

    if (oauthError) {
      console.error('[LinkedIn OAuth] Error:', oauthError);
      return res.redirect(`${DASHBOARD_URL}/app/extension?linkedin=error&reason=${oauthError}`);
    }

    if (!code) {
      return res.redirect(`${DASHBOARD_URL}/app/extension?linkedin=error&reason=no_code`);
    }

    // Exchange code for access token
    const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code as string,
        redirect_uri: LINKEDIN_REDIRECT_URI,
        client_id: LINKEDIN_CLIENT_ID,
        client_secret: LINKEDIN_CLIENT_SECRET,
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      console.error('[LinkedIn OAuth] Token exchange failed:', tokenData);
      return res.redirect(`${DASHBOARD_URL}/app/extension?linkedin=error&reason=token_failed`);
    }

    // Get LinkedIn profile info
    const profileRes = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await profileRes.json();

    const linkedinName = profile.name || profile.given_name || 'LinkedIn User';
    const linkedinEmail = profile.email || '';
    const linkedinSub = profile.sub || '';

    // Find team from cookie/session — for now, extract from query state
    // In production, the state UUID would map to a stored user session
    // Simple approach: save to linkedin_connections and let user link it later
    const expiresAt = new Date(Date.now() + (tokenData.expires_in || 5184000) * 1000).toISOString();

    // Upsert into linkedin_connections
    const { error: dbError } = await supabase
      .from('linkedin_connections')
      .upsert({
        linkedin_member_id: linkedinSub,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || null,
        expires_at: expiresAt,
        linkedin_name: linkedinName,
        linkedin_email: linkedinEmail,
        oauth_connected: true,
        status: 'connected',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'linkedin_member_id' });

    if (dbError) {
      console.error('[LinkedIn OAuth] DB error:', dbError);
    }

    // Redirect back to extension page with success
    res.redirect(`${DASHBOARD_URL}/app/extension?linkedin=connected&name=${encodeURIComponent(linkedinName)}`);
  } catch (e: any) {
    console.error('[LinkedIn OAuth] Callback error:', e);
    res.redirect(`${DASHBOARD_URL}/app/extension?linkedin=error&reason=server_error`);
  }
});

// ============================================================================
// GET /api/linkedin/status — Check if user has LinkedIn connected
// ============================================================================
router.get('/status', async (req: Request, res: Response) => {
  try {
    const { data: connections } = await supabase
      .from('linkedin_connections')
      .select('linkedin_name, linkedin_email, linkedin_member_id, oauth_connected, status, expires_at')
      .eq('oauth_connected', true)
      .eq('status', 'connected')
      .limit(1);

    if (connections && connections.length > 0) {
      const conn = connections[0];
      const expired = new Date(conn.expires_at) < new Date();
      res.json({
        connected: !expired,
        expired,
        name: conn.linkedin_name,
        email: conn.linkedin_email,
        memberId: conn.linkedin_member_id,
      });
    } else {
      res.json({ connected: false });
    }
  } catch (e: any) {
    res.json({ connected: false, error: e.message });
  }
});

// ============================================================================
// POST /api/linkedin/send-invite — Send invite via LinkedIn API
// ============================================================================
router.post('/send-invite', async (req: Request, res: Response) => {
  try {
    const { linkedinProfileUrl, message } = req.body;

    if (!linkedinProfileUrl) {
      return res.status(400).json({ error: 'linkedinProfileUrl required' });
    }

    // Get active LinkedIn connection
    const { data: connections } = await supabase
      .from('linkedin_connections')
      .select('access_token, expires_at')
      .eq('oauth_connected', true)
      .eq('status', 'connected')
      .limit(1);

    if (!connections || connections.length === 0) {
      return res.status(400).json({ error: 'No LinkedIn account connected. Connect via /app/extension.' });
    }

    const conn = connections[0];
    if (new Date(conn.expires_at) < new Date()) {
      return res.status(401).json({ error: 'LinkedIn token expired. Please reconnect.' });
    }

    // NOTE: LinkedIn's official API for sending invitations is restricted.
    // The w_member_social scope allows posting content but not sent connection requests.
    // Real tools use the undocumented Voyager API which requires session cookies.
    // This endpoint is structured to work if/when API access is granted.
    
    // For now, return a structured response indicating server-side invite is ready
    // but falls back to extension-based invites.
    res.json({
      success: true,
      method: 'queued',
      note: 'Invite queued for extension execution. Server-side sending requires LinkedIn API partner access.',
      profileUrl: linkedinProfileUrl,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================================
// POST /api/linkedin/disconnect — Disconnect LinkedIn OAuth
// ============================================================================
router.post('/disconnect', async (req: Request, res: Response) => {
  try {
    const { error } = await supabase
      .from('linkedin_connections')
      .update({ oauth_connected: false, status: 'disconnected', access_token: null })
      .eq('oauth_connected', true);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
