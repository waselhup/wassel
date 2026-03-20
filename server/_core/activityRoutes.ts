import { Router, Request, Response } from 'express';
import { supabase } from '../supabase';

const router = Router();

/**
 * Get team ID from the authenticated user.
 */
function getTeamId(req: any): string | null {
    const user = req.user;
    if (!user) return null;
    if (user.role === 'super_admin' && req.query.target_team_id) {
        return req.query.target_team_id as string;
    }
    return user.teamId || null;
}

/**
 * POST /api/activity-log
 * Log an activity from the extension or server.
 */
router.post('/', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        let teamId = getTeamId(req);
        if (!teamId) {
            const { data: membership } = await supabase
                .from('team_members')
                .select('team_id')
                .eq('user_id', userId)
                .single();
            teamId = membership?.team_id || null;
        }

        if (!teamId) {
            return res.status(400).json({ error: 'No team associated' });
        }

        const { action_type, status, prospect_name, linkedin_url, campaign_id, error_message } = req.body;

        if (!action_type || !status) {
            return res.status(400).json({ error: 'action_type and status are required' });
        }

        const { error } = await supabase.from('activity_logs').insert({
            team_id: teamId,
            campaign_id: campaign_id || null,
            action_type,
            status,
            prospect_name: prospect_name || null,
            linkedin_url: linkedin_url || null,
            error_message: error_message || null,
            executed_at: new Date().toISOString(),
        });

        if (error) {
            console.error('[ActivityLog] Insert error:', error.message);
            return res.status(500).json({ error: 'Failed to log activity' });
        }

        res.json({ success: true });
    } catch (err: any) {
        console.error('[ActivityLog] POST error:', err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * GET /api/activity-log?limit=50&campaign_id=optional
 * Returns recent activity logs for the user's team.
 */
router.get('/', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        let teamId = getTeamId(req);
        if (!teamId) {
            const { data: membership } = await supabase
                .from('team_members')
                .select('team_id')
                .eq('user_id', userId)
                .single();
            teamId = membership?.team_id || null;
        }

        if (!teamId) {
            return res.json({ logs: [] });
        }

        const limit = parseInt(req.query.limit as string) || 50;
        const campaignId = req.query.campaign_id as string;

        let query = supabase
            .from('activity_logs')
            .select('id, action_type, status, prospect_name, linkedin_url, error_message, executed_at, created_at')
            .eq('team_id', teamId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (campaignId) {
            query = query.eq('campaign_id', campaignId);
        }

        const { data: logs, error } = await query;

        if (error) {
            console.error('[ActivityLog] GET error:', error.message);
            return res.json({ logs: [] });
        }

        res.json({ logs: logs || [] });
    } catch (err: any) {
        console.error('[ActivityLog] GET error:', err.message);
        res.json({ logs: [] });
    }
});

export default router;
