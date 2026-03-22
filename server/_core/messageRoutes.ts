import { Router, Request, Response } from 'express';
import { supabase } from '../supabase';

const router = Router();

function getUserId(req: any): string | null {
  return req.user?.id || req.user?.sub || null;
}

function getTeamId(req: any): string | null {
  const user = req.user;
  if (!user) return null;
  if (user.role === 'super_admin' && req.query.target_team_id) {
    return req.query.target_team_id as string;
  }
  return user.teamId || null;
}

// GET /api/messages — list message templates
router.get('/', async (req: Request, res: Response) => {
  try {
    const teamId = getTeamId(req);
    if (!teamId) return res.status(401).json({ error: 'No team' });

    const type = req.query.type as string;
    let query = supabase
      .from('messages')
      .select('*')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false });

    if (type && type !== 'all') {
      query = query.eq('message_type', type);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[Messages] List error:', error.message);
      return res.json({ messages: [] });
    }

    res.json({ messages: data || [] });
  } catch (e: any) {
    console.error('[Messages] Error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/messages — create template
router.post('/', async (req: Request, res: Response) => {
  try {
    const teamId = getTeamId(req);
    const userId = getUserId(req);
    if (!teamId) return res.status(401).json({ error: 'No team' });

    const { name, content, message_type, purpose, tone, variables } = req.body;
    if (!name || !content) {
      return res.status(400).json({ error: 'name and content required' });
    }

    const { data, error } = await supabase
      .from('messages')
      .insert({
        team_id: teamId,
        user_id: userId,
        name,
        content,
        message_type: message_type || 'connection_note',
        purpose: purpose || null,
        tone: tone || null,
        variables: variables || [],
      })
      .select()
      .single();

    if (error) {
      console.error('[Messages] Create error:', error.message);
      return res.status(500).json({ error: error.message });
    }

    res.json({ message: data });
  } catch (e: any) {
    console.error('[Messages] Error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/messages/:id — update template
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const teamId = getTeamId(req);
    if (!teamId) return res.status(401).json({ error: 'No team' });

    const { name, content, message_type, purpose, tone, variables } = req.body;

    const { data, error } = await supabase
      .from('messages')
      .update({
        name,
        content,
        message_type,
        purpose,
        tone,
        variables,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .eq('team_id', teamId)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ message: data });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/messages/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const teamId = getTeamId(req);
    if (!teamId) return res.status(401).json({ error: 'No team' });

    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('id', req.params.id)
      .eq('team_id', teamId);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/messages/:id/use — increment usage count
router.post('/:id/use', async (req: Request, res: Response) => {
  try {
    const teamId = getTeamId(req);
    if (!teamId) return res.status(401).json({ error: 'No team' });

    const { data: msg } = await supabase
      .from('messages')
      .select('usage_count')
      .eq('id', req.params.id)
      .eq('team_id', teamId)
      .single();

    await supabase
      .from('messages')
      .update({ usage_count: (msg?.usage_count || 0) + 1 })
      .eq('id', req.params.id)
      .eq('team_id', teamId);

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
