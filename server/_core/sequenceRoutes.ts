import { Router, Request, Response } from 'express';
import { supabase } from '../supabase';

const router = Router();

// Auth is handled by expressAuthMiddleware — req.user = { id, email, role, teamId }

function getTeamId(req: any): string | null {
  const user = req.user;
  if (!user) return null;
  if (user.role === 'super_admin' && req.query.target_team_id) {
    return req.query.target_team_id as string;
  }
  return user.teamId || null;
}

/**
 * Replace template variables with prospect data.
 * Supported: {{firstName}} {{lastName}} {{company}} {{jobTitle}}
 * Missing values → empty string (never returns raw {{var}})
 */
function replaceVariables(template: string | null, prospect: any): string {
  if (!template) return '';
  return template
    .replace(/\{\{firstName\}\}/g, prospect?.name?.split(' ')[0] || prospect?.first_name || '')
    .replace(/\{\{lastName\}\}/g, prospect?.name?.split(' ').slice(1).join(' ') || prospect?.last_name || '')
    .replace(/\{\{company\}\}/g, prospect?.company || '')
    .replace(/\{\{jobTitle\}\}/g, prospect?.title || prospect?.headline || '');
}

// ============================================================================
// GET /api/sequence/campaigns/:id/steps — Get all steps for a campaign
// ============================================================================
router.get('/campaigns/:id/steps', async (req: Request, res: Response) => {
  try {
    const teamId = getTeamId(req);
    if (!teamId) return res.status(401).json({ error: 'Unauthorized' });

    // Verify campaign belongs to team
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id')
      .eq('id', req.params.id)
      .eq('team_id', teamId)
      .single();

    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const { data: steps, error } = await supabase
      .from('campaign_steps')
      .select('*')
      .eq('campaign_id', req.params.id)
      .order('step_number', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });

    res.json({ success: true, data: steps || [] });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================================
// POST /api/sequence/campaigns/:id/steps — Save/update campaign steps (batch)
// ============================================================================
router.post('/campaigns/:id/steps', async (req: Request, res: Response) => {
  try {
    const teamId = getTeamId(req);
    if (!teamId) return res.status(401).json({ error: 'Unauthorized' });

    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id')
      .eq('id', req.params.id)
      .eq('team_id', teamId)
      .single();

    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const { steps } = req.body;
    if (!Array.isArray(steps)) return res.status(400).json({ error: 'steps array required' });

    // Delete existing steps, then insert new ones
    await supabase
      .from('campaign_steps')
      .delete()
      .eq('campaign_id', req.params.id);

    const stepsToInsert = steps.map((step: any, index: number) => ({
      campaign_id: req.params.id,
      step_number: index + 1,
      step_type: step.step_type,
      name: step.name || `Step ${index + 1}`,
      configuration: step.configuration || {},
      message_template: step.message_template || null,
      delay_days: step.delay_days || 0,
    }));

    const { data: inserted, error } = await supabase
      .from('campaign_steps')
      .insert(stepsToInsert)
      .select();

    if (error) return res.status(500).json({ error: error.message });

    res.json({ success: true, data: inserted });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================================
// POST /api/sequence/campaigns/:id/enroll — Enroll prospects into campaign
// Auto-creates prospect_step_status rows for ALL steps
// ============================================================================
router.post('/campaigns/:id/enroll', async (req: Request, res: Response) => {
  try {
    const teamId = getTeamId(req);
    if (!teamId) return res.status(401).json({ error: 'Unauthorized' });

    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id')
      .eq('id', req.params.id)
      .eq('team_id', teamId)
      .single();

    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const { prospect_ids } = req.body;
    if (!Array.isArray(prospect_ids) || prospect_ids.length === 0) {
      return res.status(400).json({ error: 'prospect_ids array required' });
    }

    // Get campaign steps ordered by step_number
    const { data: steps } = await supabase
      .from('campaign_steps')
      .select('id, step_number, step_type, delay_days')
      .eq('campaign_id', req.params.id)
      .order('step_number', { ascending: true });

    if (!steps || steps.length === 0) {
      return res.status(400).json({ error: 'Campaign has no steps configured' });
    }

    // Create prospect_step_status rows for each prospect × each step
    const statusRows: any[] = [];
    const now = new Date().toISOString();

    for (const prospectId of prospect_ids) {
      for (const step of steps) {
        statusRows.push({
          prospect_id: prospectId,
          campaign_id: req.params.id,
          step_id: step.id,
          status: step.step_number === 1 ? 'pending' : 'waiting',
          scheduled_at: step.step_number === 1 ? now : null,
        });
      }
    }

    const { data: inserted, error } = await supabase
      .from('prospect_step_status')
      .insert(statusRows)
      .select();

    if (error) return res.status(500).json({ error: error.message });

    res.json({
      success: true,
      enrolled: prospect_ids.length,
      steps_created: inserted?.length || 0,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================================
// GET /api/sequence/campaigns/:id/queue — Get pending actions
// Returns items where status='pending' AND scheduled_at <= now, max 50
// Includes variable-replaced message templates
// ============================================================================
router.get('/campaigns/:id/queue', async (req: Request, res: Response) => {
  try {
    const teamId = getTeamId(req);
    if (!teamId) return res.status(401).json({ error: 'Unauthorized' });

    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id')
      .eq('id', req.params.id)
      .eq('team_id', teamId)
      .single();

    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    // Get pending items where scheduled_at is in the past
    const { data: queueItems, error } = await supabase
      .from('prospect_step_status')
      .select(`
        id,
        prospect_id,
        step_id,
        status,
        scheduled_at,
        campaign_steps!inner (
          step_type,
          step_number,
          message_template,
          name
        ),
        prospects!inner (
          linkedin_url,
          name,
          title,
          company,
          first_name,
          last_name
        )
      `)
      .eq('campaign_id', req.params.id)
      .eq('status', 'pending')
      .lte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(50);

    if (error) return res.status(500).json({ error: error.message });

    // Format and replace variables
    const queue = (queueItems || []).map((item: any) => {
      const step = item.campaign_steps;
      const prospect = item.prospects;

      return {
        prospectStepId: item.id,
        prospectId: item.prospect_id,
        stepId: item.step_id,
        stepType: step?.step_type,
        stepNumber: step?.step_number,
        stepName: step?.name,
        linkedinUrl: prospect?.linkedin_url,
        prospectName: prospect?.name || `${prospect?.first_name || ''} ${prospect?.last_name || ''}`.trim(),
        messageTemplate: replaceVariables(step?.message_template, prospect),
        scheduledAt: item.scheduled_at,
      };
    });

    res.json({ success: true, data: queue });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================================
// POST /api/sequence/step/complete — Mark step as completed/failed → unlock next
// ============================================================================
router.post('/step/complete', async (req: Request, res: Response) => {
  try {
    const teamId = getTeamId(req);
    if (!teamId) return res.status(401).json({ error: 'Unauthorized' });

    const { prospectStepId, status, errorMessage } = req.body;
    if (!prospectStepId || !status) {
      return res.status(400).json({ error: 'prospectStepId and status required' });
    }

    if (!['completed', 'failed'].includes(status)) {
      return res.status(400).json({ error: 'status must be completed or failed' });
    }

    // Get the current step status record
    const { data: currentStep, error: fetchError } = await supabase
      .from('prospect_step_status')
      .select(`
        id,
        prospect_id,
        campaign_id,
        step_id,
        campaign_steps!inner (
          step_number,
          step_type
        )
      `)
      .eq('id', prospectStepId)
      .single();

    if (fetchError || !currentStep) {
      return res.status(404).json({ error: 'Step status not found' });
    }

    // Verify campaign belongs to team
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id')
      .eq('id', currentStep.campaign_id)
      .eq('team_id', teamId)
      .single();

    if (!campaign) return res.status(403).json({ error: 'Forbidden' });

    const now = new Date().toISOString();

    // Update current step
    await supabase
      .from('prospect_step_status')
      .update({
        status,
        executed_at: now,
        error_message: errorMessage || null,
      })
      .eq('id', prospectStepId);

    // If completed → unlock next step
    if (status === 'completed') {
      const currentStepData = (currentStep as any).campaign_steps;
      const currentStepNumber = currentStepData.step_number;
      const currentStepType = currentStepData.step_type;

      // Get the next step definition
      const { data: nextStepDef } = await supabase
        .from('campaign_steps')
        .select('id, step_type, delay_days')
        .eq('campaign_id', currentStep.campaign_id)
        .eq('step_number', currentStepNumber + 1)
        .single();

      if (nextStepDef) {
        // Get next step status record for this prospect
        const { data: nextStepStatus } = await supabase
          .from('prospect_step_status')
          .select('id')
          .eq('prospect_id', currentStep.prospect_id)
          .eq('campaign_id', currentStep.campaign_id)
          .eq('step_id', nextStepDef.id)
          .single();

        if (nextStepStatus) {
          // Determine unlock logic based on step type
          const nextStepType = nextStepDef.step_type;
          const delayDays = nextStepDef.delay_days || 0;

          if (currentStepType === 'invitation' || currentStepType === 'invite') {
            // After invite → MESSAGE requires connection accepted check
            if (nextStepType === 'message') {
              // Check linkedin_connections directly
              const { data: connection } = await supabase
                .from('linkedin_connections')
                .select('connection_status')
                .eq('prospect_id', currentStep.prospect_id)
                .single();

              if (connection?.connection_status === 'accepted') {
                // Connection already accepted → unlock immediately (with delay if set)
                const scheduledAt = delayDays > 0
                  ? new Date(Date.now() + delayDays * 86400000).toISOString()
                  : now;

                await supabase
                  .from('prospect_step_status')
                  .update({ status: 'pending', scheduled_at: scheduledAt })
                  .eq('id', nextStepStatus.id);
              } else {
                // Not accepted yet → create acceptance check job
                await supabase
                  .from('acceptance_check_jobs')
                  .insert({
                    prospect_step_status_id: nextStepStatus.id,
                    prospect_id: currentStep.prospect_id,
                    campaign_id: currentStep.campaign_id,
                    next_check_at: new Date(Date.now() + 6 * 3600000).toISOString(), // 6 hours
                    checks_remaining: 56, // 14 days * 4/day
                  });
              }
            } else {
              // Non-message step after invite → unlock immediately
              const scheduledAt = delayDays > 0
                ? new Date(Date.now() + delayDays * 86400000).toISOString()
                : now;

              await supabase
                .from('prospect_step_status')
                .update({ status: 'pending', scheduled_at: scheduledAt })
                .eq('id', nextStepStatus.id);
            }
          } else {
            // For visit→invite and message→message: unlock with delay
            const scheduledAt = delayDays > 0
              ? new Date(Date.now() + delayDays * 86400000).toISOString()
              : now;

            await supabase
              .from('prospect_step_status')
              .update({ status: 'pending', scheduled_at: scheduledAt })
              .eq('id', nextStepStatus.id);
          }
        }
      }
    }

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================================
// GET /api/sequence/campaigns/:id/stats — Per-step status counts
// ============================================================================
router.get('/campaigns/:id/stats', async (req: Request, res: Response) => {
  try {
    const teamId = getTeamId(req);
    if (!teamId) return res.status(401).json({ error: 'Unauthorized' });

    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id')
      .eq('id', req.params.id)
      .eq('team_id', teamId)
      .single();

    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    // Get all step statuses grouped
    const { data: statuses, error } = await supabase
      .from('prospect_step_status')
      .select(`
        step_id,
        status,
        campaign_steps!inner (
          step_number,
          step_type,
          name
        )
      `)
      .eq('campaign_id', req.params.id);

    if (error) return res.status(500).json({ error: error.message });

    // Aggregate counts per step per status
    const stepStats: Record<string, any> = {};

    for (const item of (statuses || [])) {
      const stepData = (item as any).campaign_steps;
      const stepKey = item.step_id;

      if (!stepStats[stepKey]) {
        stepStats[stepKey] = {
          stepId: item.step_id,
          stepNumber: stepData.step_number,
          stepType: stepData.step_type,
          stepName: stepData.name,
          waiting: 0,
          pending: 0,
          in_progress: 0,
          completed: 0,
          failed: 0,
          skipped: 0,
        };
      }

      stepStats[stepKey][item.status] = (stepStats[stepKey][item.status] || 0) + 1;
    }

    const stats = Object.values(stepStats).sort((a: any, b: any) => a.stepNumber - b.stepNumber);

    const sent = (statuses || []).filter((s: any) => s.status === 'completed').length;
    const inProgress = (statuses || []).filter((s: any) => ['pending', 'in_progress'].includes(s.status)).length;
    const failed = (statuses || []).filter((s: any) => s.status === 'failed').length;

    // Acceptance rate: count prospects with invite completed → how many accepted
    const inviteSteps = (statuses || []).filter((s: any) =>
      (s as any).campaign_steps?.step_type === 'invitation' || (s as any).campaign_steps?.step_type === 'invite'
    );
    const inviteCompleted = inviteSteps.filter((s: any) => s.status === 'completed').length;

    // Get acceptance count from prospects table
    let accepted = 0;
    if (inviteCompleted > 0) {
      const prospectIds = Array.from(new Set(inviteSteps.filter((s: any) => s.status === 'completed').map((s: any) => s.prospect_id || '')));
      if (prospectIds.length > 0) {
        const { count } = await supabase
          .from('prospects')
          .select('id', { count: 'exact', head: true })
          .in('id', prospectIds as string[])
          .eq('connection_status', 'accepted');
        accepted = count || 0;
      }
    }

    const acceptanceRate = inviteCompleted > 0 ? Math.round((accepted / inviteCompleted) * 100) : 0;

    res.json({
      success: true,
      data: {
        steps: stats,
        summary: { sent, inProgress, failed, inviteCompleted, accepted, acceptanceRate },
      },
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================================
// GET /api/sequence/campaigns/:id/prospect-status — Per-prospect step grid
// ============================================================================
router.get('/campaigns/:id/prospect-status', async (req: Request, res: Response) => {
  try {
    const teamId = getTeamId(req);
    if (!teamId) return res.status(401).json({ error: 'Unauthorized' });

    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id')
      .eq('id', req.params.id)
      .eq('team_id', teamId)
      .single();

    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const { data: statuses, error } = await supabase
      .from('prospect_step_status')
      .select(`
        id,
        prospect_id,
        step_id,
        status,
        executed_at,
        error_message,
        campaign_steps!inner (
          step_number,
          step_type,
          name
        ),
        prospects!inner (
          name,
          linkedin_url,
          company,
          title,
          connection_status
        )
      `)
      .eq('campaign_id', req.params.id)
      .order('created_at', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });

    // Fetch last_checked_at from acceptance_check_jobs for all prospects in this campaign
    const { data: checkJobs } = await supabase
      .from('acceptance_check_jobs')
      .select('prospect_id, last_checked_at')
      .eq('campaign_id', req.params.id);

    const lastCheckedMap: Record<string, string | null> = {};
    for (const job of (checkJobs || [])) {
      lastCheckedMap[job.prospect_id] = job.last_checked_at;
    }

    // Group by prospect
    const prospectMap: Record<string, any> = {};

    for (const item of (statuses || [])) {
      const prospect = (item as any).prospects;
      const step = (item as any).campaign_steps;

      if (!prospectMap[item.prospect_id]) {
        prospectMap[item.prospect_id] = {
          prospectId: item.prospect_id,
          name: prospect.name,
          linkedinUrl: prospect.linkedin_url,
          company: prospect.company,
          title: prospect.title,
          connectionStatus: prospect.connection_status || 'none',
          lastCheckedAt: lastCheckedMap[item.prospect_id] || null,
          steps: {},
        };
      }

      prospectMap[item.prospect_id].steps[step.step_number] = {
        stepId: item.step_id,
        stepType: step.step_type,
        stepName: step.name,
        status: item.status,
        executedAt: item.executed_at,
        errorMessage: item.error_message,
      };
    }

    res.json({ success: true, data: Object.values(prospectMap) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================================
// GET /api/sequence/pending-acceptance-checks — Prospects needing connection check
// Extension calls this every 10 minutes
// ============================================================================
router.get('/pending-acceptance-checks', async (req: Request, res: Response) => {
  try {
    const teamId = getTeamId(req);
    if (!teamId) return res.status(401).json({ error: 'Unauthorized' });

    const sixHoursAgo = new Date(Date.now() - 6 * 3600000).toISOString();
    const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000).toISOString();

    // Find acceptance_check_jobs that are due
    const { data: jobs, error } = await supabase
      .from('acceptance_check_jobs')
      .select(`
        id,
        prospect_id,
        prospect_step_status_id,
        campaign_id,
        last_checked_at,
        checks_remaining,
        created_at
      `)
      .gt('checks_remaining', 0)
      .gte('created_at', fourteenDaysAgo)
      .or(`last_checked_at.is.null,last_checked_at.lt.${sixHoursAgo}`)
      .limit(10);

    if (error) return res.status(500).json({ error: error.message });

    if (!jobs || jobs.length === 0) {
      return res.json({ success: true, data: [] });
    }

    // Get prospect details for each job
    const prospectIds = jobs.map(j => j.prospect_id);
    const { data: prospects } = await supabase
      .from('prospects')
      .select('id, linkedin_url, name, company, connection_status')
      .in('id', prospectIds);

    const prospectMap: Record<string, any> = {};
    for (const p of (prospects || [])) {
      prospectMap[p.id] = p;
    }

    // Verify campaigns belong to team
    const campaignIds = Array.from(new Set(jobs.map(j => j.campaign_id)));
    const { data: campaigns } = await supabase
      .from('campaigns')
      .select('id')
      .in('id', campaignIds)
      .eq('team_id', teamId);

    const validCampaignIds = new Set((campaigns || []).map(c => c.id));

    const result = jobs
      .filter(j => validCampaignIds.has(j.campaign_id))
      .map(j => ({
        jobId: j.id,
        prospectId: j.prospect_id,
        prospectStepStatusId: j.prospect_step_status_id,
        campaignId: j.campaign_id,
        linkedinUrl: prospectMap[j.prospect_id]?.linkedin_url || '',
        prospectName: prospectMap[j.prospect_id]?.name || 'Unknown',
        currentStatus: prospectMap[j.prospect_id]?.connection_status || 'none',
        lastCheckedAt: j.last_checked_at,
        checksRemaining: j.checks_remaining,
      }));

    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================================
// POST /api/sequence/update-connection-status — Extension reports LinkedIn status
// ============================================================================
router.post('/update-connection-status', async (req: Request, res: Response) => {
  try {
    const teamId = getTeamId(req);
    if (!teamId) return res.status(401).json({ error: 'Unauthorized' });

    const { prospectId, status, jobId } = req.body;
    if (!prospectId || !status) {
      return res.status(400).json({ error: 'prospectId and status required' });
    }

    if (!['accepted', 'pending', 'withdrawn'].includes(status)) {
      return res.status(400).json({ error: 'status must be accepted, pending, or withdrawn' });
    }

    const now = new Date().toISOString();

    // 1. Update prospect's connection_status
    await supabase
      .from('prospects')
      .update({ connection_status: status })
      .eq('id', prospectId);

    // 2. Update linkedin_connections if exists
    const { data: existingConn } = await supabase
      .from('linkedin_connections')
      .select('id')
      .eq('prospect_id', prospectId)
      .single();

    if (existingConn) {
      await supabase
        .from('linkedin_connections')
        .update({ connection_status: status })
        .eq('prospect_id', prospectId);
    }

    // 3. Handle based on status
    if (status === 'accepted') {
      // Find the acceptance_check_job for this prospect
      const { data: job } = jobId
        ? await supabase.from('acceptance_check_jobs').select('*').eq('id', jobId).single()
        : await supabase.from('acceptance_check_jobs').select('*').eq('prospect_id', prospectId).limit(1).single();

      if (job) {
        // Get the message step's delay_days
        const { data: pss } = await supabase
          .from('prospect_step_status')
          .select('step_id, campaign_steps!inner(delay_days)')
          .eq('id', job.prospect_step_status_id)
          .single();

        const delayDays = (pss as any)?.campaign_steps?.delay_days || 0;
        const scheduledAt = delayDays > 0
          ? new Date(Date.now() + delayDays * 86400000).toISOString()
          : now;

        // Unlock Message 1 step
        await supabase
          .from('prospect_step_status')
          .update({ status: 'pending', scheduled_at: scheduledAt })
          .eq('id', job.prospect_step_status_id);

        // Delete the check job (resolved)
        await supabase.from('acceptance_check_jobs').delete().eq('id', job.id);

        console.log(`[ConnSync] ✓ ${prospectId} accepted → Message 1 unlocked`);
      }

      res.json({ success: true, action: 'unlocked_message', prospectId });

    } else if (status === 'withdrawn') {
      // Find and skip message step, delete job
      const { data: job } = jobId
        ? await supabase.from('acceptance_check_jobs').select('*').eq('id', jobId).single()
        : await supabase.from('acceptance_check_jobs').select('*').eq('prospect_id', prospectId).limit(1).single();

      if (job) {
        // Mark Message 1 step as skipped
        await supabase
          .from('prospect_step_status')
          .update({ status: 'skipped', error_message: 'Connection withdrawn/expired' })
          .eq('id', job.prospect_step_status_id);

        // Also skip any subsequent message steps for this prospect in this campaign
        const { data: laterSteps } = await supabase
          .from('prospect_step_status')
          .select('id')
          .eq('prospect_id', prospectId)
          .eq('campaign_id', job.campaign_id)
          .eq('status', 'waiting');

        if (laterSteps && laterSteps.length > 0) {
          await supabase
            .from('prospect_step_status')
            .update({ status: 'skipped', error_message: 'Connection not established' })
            .in('id', laterSteps.map(s => s.id));
        }

        // Delete the job
        await supabase.from('acceptance_check_jobs').delete().eq('id', job.id);

        console.log(`[ConnSync] ✗ ${prospectId} withdrawn → steps skipped`);
      }

      res.json({ success: true, action: 'skipped', prospectId });

    } else {
      // status === 'pending' — still waiting, update last_checked_at
      if (jobId) {
        const { data: job } = await supabase
          .from('acceptance_check_jobs')
          .select('checks_remaining')
          .eq('id', jobId)
          .single();

        await supabase
          .from('acceptance_check_jobs')
          .update({
            last_checked_at: now,
            checks_remaining: (job?.checks_remaining || 56) - 1,
          })
          .eq('id', jobId);
      } else {
        await supabase
          .from('acceptance_check_jobs')
          .update({ last_checked_at: now })
          .eq('prospect_id', prospectId);
      }

      res.json({ success: true, action: 'still_pending', prospectId });
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================================
// POST /api/sequence/campaigns/pause — Pause campaign (from extension safety)
// ============================================================================
router.post('/campaigns/pause', async (req: Request, res: Response) => {
  try {
    const teamId = getTeamId(req);
    if (!teamId) return res.status(401).json({ error: 'Unauthorized' });

    const { campaignId, reason } = req.body;
    if (!campaignId) return res.status(400).json({ error: 'campaignId required' });

    const { error } = await supabase
      .from('campaigns')
      .update({ status: 'paused' })
      .eq('id', campaignId)
      .eq('team_id', teamId);

    if (error) return res.status(500).json({ error: error.message });

    console.log(`[Sequence] Campaign ${campaignId} paused. Reason: ${reason || 'unknown'}`);

    res.json({ success: true, message: 'Campaign paused' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================================
// POST /api/sequence/check-acceptances — Process acceptance check jobs
// Called by cron or extension periodically
// ============================================================================
router.post('/check-acceptances', async (req: Request, res: Response) => {
  try {
    const teamId = getTeamId(req);
    if (!teamId) return res.status(401).json({ error: 'Unauthorized' });

    // Get due acceptance check jobs
    const { data: jobs, error } = await supabase
      .from('acceptance_check_jobs')
      .select('*')
      .lte('next_check_at', new Date().toISOString())
      .gt('checks_remaining', 0)
      .limit(50);

    if (error) return res.status(500).json({ error: error.message });

    let unlocked = 0;
    let expired = 0;
    let deferred = 0;

    for (const job of (jobs || [])) {
      // Check if connection is accepted
      const { data: connection } = await supabase
        .from('linkedin_connections')
        .select('connection_status')
        .eq('prospect_id', job.prospect_id)
        .single();

      if (connection?.connection_status === 'accepted') {
        // Get the next step def to check delay_days
        const { data: pss } = await supabase
          .from('prospect_step_status')
          .select('step_id, campaign_steps!inner(delay_days)')
          .eq('id', job.prospect_step_status_id)
          .single();

        const delayDays = (pss as any)?.campaign_steps?.delay_days || 0;
        const scheduledAt = delayDays > 0
          ? new Date(Date.now() + delayDays * 86400000).toISOString()
          : new Date().toISOString();

        // Unlock the message step
        await supabase
          .from('prospect_step_status')
          .update({ status: 'pending', scheduled_at: scheduledAt })
          .eq('id', job.prospect_step_status_id);

        // Delete the check job
        await supabase.from('acceptance_check_jobs').delete().eq('id', job.id);
        unlocked++;
      } else if (job.checks_remaining <= 1) {
        // Expired — mark step as skipped
        await supabase
          .from('prospect_step_status')
          .update({ status: 'skipped', error_message: 'Connection not accepted within 14 days' })
          .eq('id', job.prospect_step_status_id);

        await supabase.from('acceptance_check_jobs').delete().eq('id', job.id);
        expired++;
      } else {
        // Schedule next check in 6 hours
        await supabase
          .from('acceptance_check_jobs')
          .update({
            next_check_at: new Date(Date.now() + 6 * 3600000).toISOString(),
            checks_remaining: job.checks_remaining - 1,
          })
          .eq('id', job.id);
        deferred++;
      }
    }

    res.json({ success: true, unlocked, expired, deferred });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
