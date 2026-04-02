import { Router, Request, Response } from 'express';
import { supabase } from '../supabase';
import { encrypt, decrypt } from './encryption';

const router = Router();

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
    res.json({ success: true, id: data?.id, status: 'active' });
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
