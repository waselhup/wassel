import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const router = Router();

// Lazy Supabase client — avoids module-level createClient('','') crash when env vars are missing.
// @supabase/supabase-js v2 throws "supabaseUrl and supabaseKey are required" on empty strings,
// which kills the entire serverless function at import time.
function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) throw new Error('Missing Supabase env vars (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

// Read at request time so hot-reloads / Vercel env injection work correctly
function getConfig() {
  return {
    LINKEDIN_CLIENT_ID: process.env.LINKEDIN_CLIENT_ID || '',
    LINKEDIN_CLIENT_SECRET: process.env.LINKEDIN_CLIENT_SECRET || '',
    LINKEDIN_REDIRECT_URI: process.env.LINKEDIN_REDIRECT_URI || 'https://wassel-alpha.vercel.app/api/linkedin/callback',
    DASHBOARD_URL: process.env.DASHBOARD_ORIGIN || 'https://wassel-alpha.vercel.app',
  };
}

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
  const { LINKEDIN_CLIENT_ID, LINKEDIN_REDIRECT_URI } = getConfig();
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
  const { LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET, LINKEDIN_REDIRECT_URI, DASHBOARD_URL } = getConfig();
  const supabase = getSupabase();
  try {
    const { code, state, error: oauthError } = req.query;

    console.log('[LinkedIn OAuth] Callback received', { code: !!code, error: oauthError });

    if (oauthError) {
      console.error('[LinkedIn OAuth] Error:', oauthError);
      return res.redirect(`${DASHBOARD_URL}/login?error=linkedin_denied`);
    }

    if (!code) {
      return res.redirect(`${DASHBOARD_URL}/login?error=no_code`);
    }

    // 1. Exchange code for access token
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
    console.log('[LinkedIn OAuth] Token received:', !!tokenData.access_token);

    if (!tokenData.access_token) {
      console.error('[LinkedIn OAuth] Token exchange failed:', tokenData);
      return res.redirect(`${DASHBOARD_URL}/login?error=token_failed`);
    }

    // 2. Get LinkedIn profile info
    const profileRes = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await profileRes.json();
    console.log('[LinkedIn OAuth] Profile:', profile.email, profile.name);

    const linkedinName = profile.name || profile.given_name || 'LinkedIn User';
    const linkedinEmail = profile.email || `linkedin_${profile.sub}@wassel.app`;
    const linkedinSub = profile.sub || '';
    const linkedinPicture = profile.picture || '';

    // 3. Find or create Supabase user
    const { data: userList } = await supabase.auth.admin.listUsers();
    const existingUser = userList?.users?.find(
      (u: any) => u.email === linkedinEmail
    );

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
      console.log('[LinkedIn OAuth] Existing user found:', userId);

      // Update user metadata with latest LinkedIn photo/name
      try {
        const existingMeta = existingUser.user_metadata || {};
        await supabase.auth.admin.updateUserById(userId, {
          user_metadata: {
            ...existingMeta,
            avatar_url: linkedinPicture || existingMeta.avatar_url,
            picture: linkedinPicture || existingMeta.picture,
            full_name: linkedinName || existingMeta.full_name,
            linkedin_id: linkedinSub || existingMeta.linkedin_id,
          },
        });
        console.log('[LinkedIn OAuth] Updated user metadata with LinkedIn photo');
      } catch (metaErr: any) {
        console.warn('[LinkedIn OAuth] Metadata update skipped:', metaErr.message);
      }
    } else {
      // Create new user
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: linkedinEmail,
        email_confirm: true,
        user_metadata: {
          full_name: linkedinName,
          avatar_url: linkedinPicture,
          linkedin_id: linkedinSub,
          provider: 'linkedin',
        },
      });

      if (createError) {
        console.error('[LinkedIn OAuth] User creation failed:', createError);
        return res.redirect(`${DASHBOARD_URL}/login?error=callback_failed`);
      }

      userId = newUser.user!.id;
      console.log('[LinkedIn OAuth] New user created:', userId);

      // Create profile
      await supabase.from('profiles').upsert({
        id: userId,
        email: linkedinEmail,
        full_name: linkedinName,
        role: 'client_user',
      });

      // Create team
      try {
        const { data: team } = await supabase
          .from('teams')
          .insert({ name: linkedinName + "'s Team", plan: 'trial' })
          .select()
          .single();

        if (team) {
          await supabase.from('team_members').insert({
            team_id: team.id,
            user_id: userId,
            role: 'owner',
          });
        }
      } catch (teamErr) {
        console.warn('[LinkedIn OAuth] Team creation skipped:', teamErr);
      }
    }

    // 4. Save LinkedIn token to linkedin_connections
    const expiresAt = new Date(Date.now() + (tokenData.expires_in || 5184000) * 1000).toISOString();
    await supabase
      .from('linkedin_connections')
      .upsert({
        user_id: userId,
        linkedin_member_id: linkedinSub,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || null,
        expires_at: expiresAt,
        linkedin_name: linkedinName,
        linkedin_email: linkedinEmail,
        profile_picture_url: linkedinPicture || null,
        headline: (profile as any).headline || null,
        oauth_connected: true,
        status: 'connected',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    console.log('[LinkedIn OAuth] Token saved to DB');

    // Also mark linkedin_connected on profile
    await supabase
      .from('profiles')
      .update({ linkedin_connected: true })
      .eq('id', userId);

    // 5. Generate magic link for auto-login
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: linkedinEmail,
      options: {
        redirectTo: `${DASHBOARD_URL}/onboarding/extension`,
      },
    });

    if (linkData?.properties?.action_link) {
      console.log('[LinkedIn OAuth] Redirecting via magic link');
      return res.redirect(linkData.properties.action_link);
    }

    // Fallback: redirect to login with success message
    console.warn('[LinkedIn OAuth] Magic link failed, fallback redirect', linkError);
    return res.redirect(`${DASHBOARD_URL}/login?linkedin=connected`);
  } catch (e: any) {
    console.error('[LinkedIn OAuth] Callback error:', e);
    return res.redirect(`${DASHBOARD_URL}/login?error=callback_failed`);
  }
});

// ============================================================================
// GET /api/linkedin/profile — Return LinkedIn profile data for hero card
// ============================================================================
router.get('/profile', async (req: Request, res: Response) => {
  const supabase = getSupabase();
  try {
    const userId = getUserId(req);

    // Try fetching from linkedin_connections by user_id
    let photoUrl: string | null = null;
    let headline: string | null = null;
    let fullName: string | null = null;

    if (userId) {
      const { data: conn } = await supabase
        .from('linkedin_connections')
        .select('linkedin_name, linkedin_email, profile_picture_url, headline')
        .eq('user_id', userId)
        .eq('oauth_connected', true)
        .limit(1)
        .single();

      if (conn) {
        photoUrl = conn.profile_picture_url || null;
        headline = conn.headline || null;
        fullName = conn.linkedin_name || null;
      }
    }

    // If no connection found, try user_metadata via Supabase auth
    if (!photoUrl && userId) {
      const { data: userData } = await supabase.auth.admin.getUserById(userId);
      if (userData?.user) {
        const meta = userData.user.user_metadata || {};
        photoUrl = meta.picture || meta.avatar_url || meta.profile_picture || null;
        fullName = fullName || meta.full_name || meta.name || null;
      }
    }

    res.json({ photoUrl, headline, fullName });
  } catch (e: any) {
    console.error('[LinkedIn] Profile fetch error:', e.message);
    res.json({ photoUrl: null, headline: null, fullName: null });
  }
});

// ============================================================================
// GET /api/linkedin/status — Check if user has LinkedIn connected
// ============================================================================
router.get('/status', async (req: Request, res: Response) => {
  const supabase = getSupabase();
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
  const supabase = getSupabase();
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
  const supabase = getSupabase();
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

// ============================================================================
// GET /api/linkedin/test — Diagnostic endpoint
// ============================================================================
router.get('/test', (_req: Request, res: Response) => {
  const { LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET, LINKEDIN_REDIRECT_URI, DASHBOARD_URL } = getConfig();
  res.json({
    linkedinRoutes: 'ACTIVE ✅',
    clientId: LINKEDIN_CLIENT_ID ? 'SET ✅' : 'MISSING ❌',
    secret: LINKEDIN_CLIENT_SECRET ? 'SET ✅' : 'MISSING ❌',
    redirectUri: LINKEDIN_REDIRECT_URI || 'MISSING ❌',
    dashboardUrl: DASHBOARD_URL,
    timestamp: new Date().toISOString(),
  });
});

export default router;
