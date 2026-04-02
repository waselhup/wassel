import { Router, Request, Response } from 'express';
import { supabase } from '../supabase';

const router = Router();

const AUTOMATION_URL = process.env.AUTOMATION_SERVER_URL || '';
const AUTOMATION_KEY = process.env.AUTOMATION_API_KEY || '';

function getTeamId(req: any): string | null {
  const user = req.user;
  if (!user) return null;
  if (user.role === 'super_admin' && req.query.target_team_id) {
    return req.query.target_team_id as string;
  }
  return user.teamId || null;
}

function replaceVariables(template: string | null, prospect: any): string {
  if (!template) return '';
  return template
    .replace(/\{\{firstName\}\}/g, prospect?.name?.split(' ')[0] || prospect?.first_name || '')
    .replace(/\{\{lastName\}\}/g, prospect?.name?.split(' ').slice(1).join(' ') || prospect?.last_name || '')
    .replace(/\{\{company\}\}/g, prospect?.company || '')
    .replace(/\{\{jobTitle\}\}/g, prospect?.title || prospect?.headline || '');
}

// ============================================================================
// POST /api/automation/campaigns/:id/launch — Launch campaign via cloud
// ============================================================================
router.post('/campaigns/:id/launch', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const teamId = getTeamId(req);
    if (!userId || !teamId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!AUTOMATION_URL) {
      return res.status(503).json({ error: 'Automation server not configured' });
    }

    const campaignId = req.params.id;

    // Verify campaign belongs to team
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id, name, status')
      .eq('id', campaignId)
      .eq('team_id', teamId)
      .single();

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Check user has active LinkedIn session
    const { data: session } = await supabase
      .from('linkedin_sessions')
      .select('id, status')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (!session) {
      return res.status(400).json({
        error: 'No active LinkedIn session. Open LinkedIn in your browser and reload the Wassel extension.',
      });
    }

    // Get pending steps with prospect data
    const now = new Date().toISOString();
    const { data: pendingSteps, error: qError } = await supabase
      .from('prospect_step_status')
      .select(`
        id,
        prospect_id,
        step_id,
        campaign_steps (
          step_type,
          step_number,
          message_template
        ),
        prospects (
          id,
          name,
          linkedin_url,
          title,
          company
        )
      `)
      .eq('campaign_id', campaignId)
      .eq('status', 'pending')
      .lte('scheduled_at', now)
      .order('scheduled_at', { ascending: true })
      .limit(100);

    if (qError) {
      return res.status(500).json({ error: qError.message });
    }

    if (!pendingSteps || pendingSteps.length === 0) {
      return res.json({ success: true, queued: 0, message: 'No pending actions' });
    }

    // Queue each action to the automation server
    let queued = 0;
    let failed = 0;

    for (const step of pendingSteps) {
      const stepData = step.campaign_steps as any;
      const prospect = step.prospects as any;

      if (!prospect?.linkedin_url) continue;

      const actionType = (stepData?.step_type === 'invitation' || stepData?.step_type === 'invite' || stepData?.step_type === 'connection_request')
        ? 'connect'
        : stepData?.step_type === 'visit' ? 'visit'
        : (stepData?.step_type === 'message' || stepData?.step_type === 'follow_up') ? 'message'
        : null;

      if (!actionType) continue;

      try {
        const resp = await fetch(`${AUTOMATION_URL}/jobs/enqueue`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${AUTOMATION_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: actionType,
            userId,
            teamId,
            prospectStepId: step.id,
            linkedinUrl: prospect.linkedin_url,
            name: prospect.name || '',
            message: replaceVariables(stepData?.message_template, prospect),
            campaignId,
          }),
        });

        if (resp.ok) {
          queued++;
          // Mark as in_progress
          await supabase
            .from('prospect_step_status')
            .update({ status: 'in_progress' })
            .eq('id', step.id);
        } else {
          failed++;
        }
      } catch (err: any) {
        console.error('[Automation] Queue error:', err.message);
        failed++;
      }
    }

    // Update campaign status
    if (queued > 0) {
      await supabase
        .from('campaigns')
        .update({ status: 'active' })
        .eq('id', campaignId);
    }

    console.log(`[Automation] Campaign ${campaignId.slice(0, 8)}… launched: ${queued} queued, ${failed} failed`);
    res.json({ success: true, queued, failed });
  } catch (err: any) {
    console.error('[Automation] Launch error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/automation/campaigns/:id/progress — Campaign progress
// ============================================================================
router.get('/campaigns/:id/progress', async (req: Request, res: Response) => {
  try {
    const teamId = getTeamId(req);
    if (!teamId) return res.status(401).json({ error: 'Authentication required' });

    const campaignId = req.params.id;

    // Verify campaign belongs to team
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id')
      .eq('id', campaignId)
      .eq('team_id', teamId)
      .single();

    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const { data: statuses } = await supabase
      .from('prospect_step_status')
      .select('status')
      .eq('campaign_id', campaignId);

    const counts = { total: 0, pending: 0, in_progress: 0, completed: 0, failed: 0, waiting: 0, skipped: 0 };
    for (const s of (statuses || [])) {
      counts.total++;
      const st = s.status as keyof typeof counts;
      if (st in counts) counts[st]++;
    }

    res.json({ success: true, progress: counts });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// POST /api/automation/campaigns/:id/pause — Pause cloud campaign
// ============================================================================
router.post('/campaigns/:id/pause', async (req: Request, res: Response) => {
  try {
    const teamId = getTeamId(req);
    if (!teamId) return res.status(401).json({ error: 'Authentication required' });

    const campaignId = req.params.id;

    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id')
      .eq('id', campaignId)
      .eq('team_id', teamId)
      .single();

    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    // Revert in_progress steps back to pending
    await supabase
      .from('prospect_step_status')
      .update({ status: 'pending' })
      .eq('campaign_id', campaignId)
      .eq('status', 'in_progress');

    // Pause campaign
    await supabase
      .from('campaigns')
      .update({ status: 'paused' })
      .eq('id', campaignId);

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
