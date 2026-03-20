import { Router, Request, Response } from 'express';
import { supabase } from '../supabase';

const router = Router();

function getTeamId(req: any): string | null {
    const user = req.user;
    if (!user) return null;
    return user.teamId || null;
}

async function resolveTeamId(req: any): Promise<string | null> {
    let teamId = getTeamId(req);
    if (!teamId) {
        const userId = req.user?.id;
        if (!userId) return null;
        const { data: membership } = await supabase
            .from('team_members')
            .select('team_id')
            .eq('user_id', userId)
            .single();
        teamId = membership?.team_id || null;
    }
    return teamId;
}

/**
 * GET /api/posts?status=all|draft|scheduled|published|failed
 */
router.get('/', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        if (!userId) return res.status(401).json({ error: 'Not authenticated' });

        const teamId = await resolveTeamId(req);
        if (!teamId) return res.json({ posts: [] });

        const status = req.query.status as string;

        let query = supabase
            .from('posts')
            .select('*')
            .eq('team_id', teamId)
            .order('created_at', { ascending: false });

        if (status && status !== 'all') {
            query = query.eq('status', status);
        }

        const { data: posts, error } = await query.limit(100);

        if (error) {
            console.error('[Posts] GET error:', error.message);
            return res.json({ posts: [] });
        }

        res.json({ posts: posts || [] });
    } catch (err: any) {
        console.error('[Posts] GET error:', err.message);
        res.json({ posts: [] });
    }
});

/**
 * POST /api/posts
 * Body: { content, scheduled_at? }
 */
router.post('/', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        if (!userId) return res.status(401).json({ error: 'Not authenticated' });

        const teamId = await resolveTeamId(req);
        if (!teamId) return res.status(400).json({ error: 'No team associated' });

        const { content, scheduled_at } = req.body;
        if (!content || !content.trim()) {
            return res.status(400).json({ error: 'Content is required' });
        }

        const status = scheduled_at ? 'scheduled' : 'draft';

        const { data: post, error } = await supabase
            .from('posts')
            .insert({
                team_id: teamId,
                user_id: userId,
                content: content.trim(),
                status,
                scheduled_at: scheduled_at || null,
            })
            .select()
            .single();

        if (error) {
            console.error('[Posts] INSERT error:', error.message);
            return res.status(500).json({ error: 'Failed to create post' });
        }

        res.json({ post });
    } catch (err: any) {
        console.error('[Posts] POST error:', err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * PUT /api/posts/:id
 * Body: { content?, scheduled_at?, status? }
 */
router.put('/:id', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        if (!userId) return res.status(401).json({ error: 'Not authenticated' });

        const { id } = req.params;
        const { content, scheduled_at, status } = req.body;

        const updates: any = { updated_at: new Date().toISOString() };
        if (content !== undefined) updates.content = content.trim();
        if (scheduled_at !== undefined) updates.scheduled_at = scheduled_at;
        if (status !== undefined) updates.status = status;

        const { data: post, error } = await supabase
            .from('posts')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('[Posts] UPDATE error:', error.message);
            return res.status(500).json({ error: 'Failed to update post' });
        }

        res.json({ post });
    } catch (err: any) {
        console.error('[Posts] PUT error:', err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * DELETE /api/posts/:id
 */
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        if (!userId) return res.status(401).json({ error: 'Not authenticated' });

        const { id } = req.params;
        const { error } = await supabase.from('posts').delete().eq('id', id);

        if (error) {
            console.error('[Posts] DELETE error:', error.message);
            return res.status(500).json({ error: 'Failed to delete post' });
        }

        res.json({ success: true });
    } catch (err: any) {
        console.error('[Posts] DELETE error:', err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * POST /api/posts/:id/publish
 * Marks post as published and returns data for extension to publish on LinkedIn.
 */
router.post('/:id/publish', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        if (!userId) return res.status(401).json({ error: 'Not authenticated' });

        const { id } = req.params;

        // Get the post content
        const { data: post, error: fetchError } = await supabase
            .from('posts')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        // Update status to published
        const { error: updateError } = await supabase
            .from('posts')
            .update({
                status: 'published',
                published_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq('id', id);

        if (updateError) {
            console.error('[Posts] Publish error:', updateError.message);
            return res.status(500).json({ error: 'Failed to publish post' });
        }

        // Return post content for extension to use
        res.json({
            success: true,
            post: { ...post, status: 'published' },
            publishAction: {
                type: 'PUBLISH_POST',
                postId: id,
                content: post.content,
            },
        });
    } catch (err: any) {
        console.error('[Posts] Publish error:', err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

export default router;
