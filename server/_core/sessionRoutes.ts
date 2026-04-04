import { Router, Request, Response } from 'express';
import { supabase } from '../supabase';
import { encrypt, decrypt } from './encryption';
import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';

const router = Router();

/**
 * Quick verify: hit LinkedIn Voyager API to check if li_at cookie is valid
 * Returns { valid: true, name } or { valid: false, reason }
 */
async function verifyLinkedInCookie(liAt: string, jsessionId?: string): Promise<{ valid: boolean; name?: string; reason?: string }> {
  try {
    const csrfToken = (jsessionId || '').replace(/"/g, '');
    const headers: Record<string, string> = {
      'cookie': `li_at=${liAt}${jsessionId ? `; JSESSIONID="${jsessionId}"` : ''}`,
      'csrf-token': csrfToken,
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'x-restli-protocol-version': '2.0.0',
      'accept': 'application/vnd.linkedin.normalized+json+2.1',
    };

    const proxyUrl = process.env.LINKEDIN_PROXY_URL;
    const agent = proxyUrl ? new HttpsProxyAgent(proxyUrl, { rejectUnauthorized: false }) : undefined;

    const res = await fetch('https://www.linkedin.com/voyager/api/me', {
      headers,
      redirect: 'manual',
      ...(agent ? { agent } : {}),
    });

    if (res.status >= 300 && res.status < 400 || res.status === 401 || res.status === 403) {
      return { valid: false, reason: `LinkedIn rejected cookie (HTTP ${res.status})` };
    }

    if (res.ok) {
      const data: any = await res.json();
      const firstName = data?.firstName || data?.miniProfile?.firstName || '';
      const lastName = data?.lastName || data?.miniProfile?.lastName || '';
      const name = `${firstName} ${lastName}`.trim();
      return { valid: true, name: name || 'Unknown' };
    }

    return { valid: false, reason: `Unexpected HTTP ${res.status}` };
  } catch (err: any) {
    return { valid: false, reason: err.message };
  }
}

function getTeamId(req: any): string | null {
  const user = req.user;
  if (!user) return null;
  if (user.role === 'super_admin' && req.query.target_team_id) {
    return req.query.target_team_id as string;
  }
  return user.teamId || null;
}

// ============================================================================
// POST /api/session/store — Extension sends LinkedIn cookies here
// ============================================================================
router.post('/store', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { li_at, jsessionid } = req.body;
    if (!li_at || typeof li_at !== 'string') {
      return res.status(400).json({ error: 'li_at cookie is required' });
    }

    const teamId = getTeamId(req);

    // Encrypt cookies before storing
    const encryptedLiAt = encrypt(li_at);
    const encryptedJsession = jsessionid ? encrypt(jsessionid) : null;

    const { data, error } = await supabase
      .from('linkedin_sessions')
      .upsert({
        user_id: userId,
        team_id: teamId,
        li_at: encryptedLiAt,
        jsessionid: encryptedJsession,
        status: 'active',
        last_verified_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
      .select('id')
      .single();

    if (error) {
      console.error('[Session] Store error:', error.message);
      return res.status(500).json({ error: error.message });
    }

    console.log(`[Session] Stored for user=${userId.slice(0, 8)}…`);

    // Verify the cookie actually works with LinkedIn
    const verification = await verifyLinkedInCookie(
      li_at,
      jsessionid || ''
    );

    if (verification.valid) {
      console.log(`[Session] ✅ Cookie verified for ${verification.name}`);
    } else {
      console.log(`[Session] ⚠️ Cookie stored but INVALID: ${verification.reason}`);
    }

    res.json({
      success: true,
      id: data?.id,
      status: 'active',
      verified: verification.valid,
      linkedinName: verification.name || null,
      verifyError: verification.reason || null,
    });
  } catch (err: any) {
    console.error('[Session] Store exception:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/session/status — Check if user has valid LinkedIn session
// ============================================================================
router.get('/status', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.json({ hasSession: false, reason: 'not_authenticated' });
    }

    const { data } = await supabase
      .from('linkedin_sessions')
      .select('id, status, last_verified_at, expires_at, created_at, updated_at')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (!data) {
      return res.json({ hasSession: false });
    }

    // Check if expired
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      await supabase
        .from('linkedin_sessions')
        .update({ status: 'expired' })
        .eq('id', data.id);
      return res.json({ hasSession: false, reason: 'expired' });
    }

    res.json({
      hasSession: true,
      status: data.status,
      lastVerified: data.last_verified_at,
      expiresAt: data.expires_at,
      updatedAt: data.updated_at,
    });
  } catch (err: any) {
    res.json({ hasSession: false, error: err.message });
  }
});

// ============================================================================
// GET /api/session/verify — Test if stored cookie actually works with LinkedIn
// ============================================================================
router.get('/verify', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { data } = await supabase
      .from('linkedin_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (!data) {
      return res.json({ hasSession: false, verified: false, reason: 'No active session stored' });
    }

    // Decrypt and verify
    try {
      const liAt = decrypt(data.li_at);
      const jsessionId = data.jsessionid ? decrypt(data.jsessionid) : '';

      if (!liAt) {
        return res.json({ hasSession: true, verified: false, reason: 'Decrypted cookie is empty' });
      }

      const result = await verifyLinkedInCookie(liAt, jsessionId);

      // Update last_verified_at if valid
      if (result.valid) {
        await supabase
          .from('linkedin_sessions')
          .update({ last_verified_at: new Date().toISOString() })
          .eq('id', data.id);
      }

      return res.json({
        hasSession: true,
        verified: result.valid,
        linkedinName: result.name || null,
        reason: result.reason || null,
        lastUpdated: data.updated_at,
        cookieLength: liAt.length,
      });
    } catch (decryptErr: any) {
      return res.json({ hasSession: true, verified: false, reason: `Decryption failed: ${decryptErr.message}` });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// POST /api/session/manual-store — Paste li_at cookie directly (no extension needed)
// ============================================================================
router.post('/manual-store', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { li_at, jsessionid } = req.body;
    if (!li_at || typeof li_at !== 'string' || li_at.length < 50) {
      return res.status(400).json({ error: 'Invalid li_at cookie. Must be a long string from LinkedIn.' });
    }

    // Verify FIRST before storing
    const verification = await verifyLinkedInCookie(li_at, jsessionid || '');
    if (!verification.valid) {
      return res.status(400).json({
        error: 'Cookie is not valid with LinkedIn',
        reason: verification.reason,
        hint: 'Make sure you are logged into LinkedIn and copied the correct li_at cookie value',
      });
    }

    const teamId = getTeamId(req);
    const encryptedLiAt = encrypt(li_at);
    const encryptedJsession = jsessionid ? encrypt(jsessionid) : null;

    const { data, error } = await supabase
      .from('linkedin_sessions')
      .upsert({
        user_id: userId,
        team_id: teamId,
        li_at: encryptedLiAt,
        jsessionid: encryptedJsession,
        status: 'active',
        last_verified_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
      .select('id')
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    console.log(`[Session] ✅ Manual store for user=${userId.slice(0, 8)}… verified as ${verification.name}`);
    res.json({
      success: true,
      verified: true,
      linkedinName: verification.name,
      id: data?.id,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// DELETE /api/session/revoke — Revoke stored LinkedIn session
// ============================================================================
router.delete('/revoke', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { error } = await supabase
      .from('linkedin_sessions')
      .update({ status: 'revoked', li_at: '', jsessionid: '', updated_at: new Date().toISOString() })
      .eq('user_id', userId);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    console.log(`[Session] Revoked for user=${userId.slice(0, 8)}…`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
