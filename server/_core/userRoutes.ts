import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const router = Router();

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
}

// ============================================================
// PATCH /api/user/profile — Update user profile fields
// ============================================================
router.patch('/profile', async (req: Request, res: Response) => {
  const supabase = getSupabase();
  try {
    // 1. Extract JWT from Authorization header
    const authHeader = req.headers.authorization;
    console.log('[UserProfile] PATCH /profile called, auth header present:', !!authHeader);

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('[UserProfile] Missing or invalid authorization header');
      return res.status(401).json({ error: 'Missing authorization header' });
    }

    const token = authHeader.replace('Bearer ', '');

    // 2. Get user from token using Supabase Auth
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('[UserProfile] Auth error:', authError?.message || 'No user found');
      return res.status(401).json({ error: 'Invalid token: ' + (authError?.message || 'user not found') });
    }

    console.log('[UserProfile] User authenticated:', user.id, user.email);

    // 3. Determine what fields to update
    const allowedFields = ['extension_installed', 'linkedin_connected', 'full_name'];
    const updates: Record<string, any> = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update. Allowed: ' + allowedFields.join(', ') });
    }

    console.log('[UserProfile] Updating fields:', JSON.stringify(updates), 'for user:', user.id);

    // 4. Update profile in Supabase
    const { data, error: updateError } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();

    if (updateError) {
      console.error('[UserProfile] Supabase update error:', updateError);
      return res.status(500).json({ error: 'Database update failed: ' + updateError.message });
    }

    console.log('[UserProfile] Update successful:', JSON.stringify(data));
    return res.json({ success: true, profile: data });
  } catch (err: any) {
    console.error('[UserProfile] Unexpected error:', err);
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// ============================================================
// GET /api/user/profile — Get current user profile
// ============================================================
router.get('/profile', async (req: Request, res: Response) => {
  const supabase = getSupabase();
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing authorization header' });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    return res.json({ profile });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
