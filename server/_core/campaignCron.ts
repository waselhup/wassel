/**
 * Campaign Cron Runner — SCHEDULER ONLY
 * Vercel Cron: runs every minute via GET /api/cron/campaign-runner
 *
 * Architecture (v6 — Extension Execution):
 * - Cron does NOT execute LinkedIn API calls (extension handles that)
 * - Cron handles: auto-enrollment, stuck row recovery, acceptance checks,
 *   campaign completion detection, and scheduling
 * - Extension polls GET /api/ext/pending-actions for work
 * - Extension reports results via POST /api/ext/report-action
 */

import { Router } from 'express';
import { supabase } from '../supabase';

const router = Router();

const CRON_SECRET = process.env.CRON_SECRET || '';

// ─── DIAGNOSTIC ENDPOINT ──────────────────────────────────
router.get('/diagnose', async (req: any, res: any) => {
  const authHeader = req.headers['authorization'] || '';
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Check active sessions
    const { data: sessions, count: sessionCount } = await supabase
      .from('linkedin_sessions')
      .select('user_id, status, updated_at', { count: 'exact' })
      .eq('status', 'active');

    // Check active campaigns
    const { data: campaigns, count: campaignCount } = await supabase
      .from('campaigns')
      .select('id, name, status')
      .eq('status', 'active');

    // Check pending actions
    const { count: pendingCount } = await supabase
      .from('prospect_step_status')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    // Check in_progress (claimed by extension)
    const { count: inProgressCount } = await supabase
      .from('prospect_step_status')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'in_progress');

    // Recent activity
    const { data: recentLogs } = await supabase
      .from('activity_logs')
      .select('action_type, status, prospect_name, executed_at, error_message')
      .order('executed_at', { ascending: false })
      .limit(10);

    return res.json({
      ok: true,
      mode: 'extension-execution',
      activeSessions: sessionCount || 0,
      activeCampaigns: campaignCount || 0,
      pendingActions: pendingCount || 0,
      inProgressActions: inProgressCount || 0,
      campaigns: campaigns || [],
      recentActivity: recentLogs || [],
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// ─── MAIN CRON ENDPOINT ────────────────────────────────────

router.get('/campaign-runner', async (req: any, res: any) => {
  const authHeader = req.headers['authorization'] || '';
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const results: any[] = [];
  const startTime = Date.now();

  try {
    // ── Step 1: Recovery — reset stuck in_progress older than 5 min ──
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: stuckRows } = await supabase
      .from('prospect_step_status')
      .update({ status: 'pending' })
      .eq('status', 'in_progress')
      .lt('created_at', fiveMinAgo)
      .select('id');

    if (stuckRows?.length) {
      console.log(`[Cron] Recovered ${stuckRows.length} stuck rows`);
      results.push({ recovery: stuckRows.length });
    }

    // ── Step 2: Get all active campaigns ──
    const { data: activeCampaigns } = await supabase
      .from('campaigns')
      .select('id, team_id, created_by, name')
      .eq('status', 'active');

    if (!activeCampaigns?.length) {
      return res.json({ ok: true, mode: 'scheduler', message: 'No active campaigns', processed: 0 });
    }

    // ── Step 3: Auto-enroll prospects for campaigns with no status rows ──
    for (const campaign of activeCampaigns) {
      if (Date.now() - startTime > 8000) break;

      const { count: totalRows } = await supabase
        .from('prospect_step_status')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaign.id);

      if (!totalRows) {
        await autoEnrollProspects(campaign.id);
        results.push({ campaign: campaign.name, action: 'auto_enrolled' });
      }
    }

    // ── Step 4: Check campaign completion ──
    for (const campaign of activeCampaigns) {
      if (Date.now() - startTime > 8500) break;

      const { count: remaining } = await supabase
        .from('prospect_step_status')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaign.id)
        .in('status', ['pending', 'in_progress', 'waiting']);

      if (!remaining) {
        await supabase
          .from('campaigns')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('id', campaign.id);
        results.push({ campaign: campaign.name, status: 'completed' });
        console.log(`[Cron] Campaign "${campaign.name}" completed — all steps done`);
      }
    }

    // ── Step 5: Run acceptance checker ──
    if (Date.now() - startTime < 7000) {
      try {
        const acceptanceResults = await processAcceptanceChecks(startTime);
        if (acceptanceResults.length) {
          results.push({ acceptance_checks: acceptanceResults });
        }
      } catch (err: any) {
        console.error('[Cron] Acceptance check error:', err.message);
      }
    }

    return res.json({
      ok: true,
      mode: 'scheduler',
      message: 'Extension handles LinkedIn execution. Cron handles scheduling.',
      processed: results.length,
      results,
      elapsed: Date.now() - startTime,
    });
  } catch (err: any) {
    console.error('[CampaignCron] Fatal error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Auto-Enroll Prospects ─────────────────────────────────

async function autoEnrollProspects(campaignId: string) {
  const { data: prospects } = await supabase
    .from('prospects')
    .select('id')
    .eq('campaign_id', campaignId);

  const { data: steps } = await supabase
    .from('campaign_steps')
    .select('id, step_number')
    .eq('campaign_id', campaignId)
    .order('step_number', { ascending: true });

  if (!prospects?.length || !steps?.length) return;

  const now = new Date().toISOString();
  const rows: any[] = [];

  for (const p of prospects) {
    for (const s of steps) {
      rows.push({
        prospect_id: p.id,
        campaign_id: campaignId,
        step_id: s.id,
        status: s.step_number === 1 ? 'pending' : 'waiting',
        scheduled_at: s.step_number === 1 ? now : null,
      });
    }
  }

  for (let i = 0; i < rows.length; i += 50) {
    await supabase.from('prospect_step_status').insert(rows.slice(i, i + 50));
  }

  console.log(`[Cron] Auto-enrolled ${prospects.length} prospects × ${steps.length} steps for campaign ${campaignId}`);
}

// ─── ACCEPTANCE CHECKER ────────────────────────────────────
// NOTE: In v6 the acceptance checker no longer calls LinkedIn directly.
// Instead, it just checks if enough time has passed and unlocks steps
// based on optimistic scheduling or marks as timed-out.
// The extension will verify connection status when it picks up message actions.

async function processAcceptanceChecks(startTime: number): Promise<any[]> {
  const results: any[] = [];
  const now = new Date().toISOString();

  // Get acceptance check jobs that are due
  const { data: jobs } = await supabase
    .from('acceptance_check_jobs')
    .select(`
      id,
      prospect_step_status_id,
      prospect_id,
      campaign_id,
      checks_remaining,
      prospects!inner (
        linkedin_url,
        name,
        connection_status
      )
    `)
    .lte('next_check_at', now)
    .gt('checks_remaining', 0)
    .limit(10);

  if (!jobs?.length) return results;

  for (const job of jobs) {
    if (Date.now() - startTime > 8500) break;

    const prospect = (job as any).prospects;
    const checksRemaining = job.checks_remaining - 1;

    // If prospect was already marked as accepted (e.g., by extension),
    // unlock the next step immediately
    if (prospect.connection_status === 'accepted') {
      const { data: pss } = await supabase
        .from('prospect_step_status')
        .select('id, step_id')
        .eq('id', job.prospect_step_status_id)
        .single();

      if (pss) {
        const { data: stepDef } = await supabase
          .from('campaign_steps')
          .select('delay_days')
          .eq('id', pss.step_id)
          .single();

        const delayDays = stepDef?.delay_days || 0;
        const scheduledAt = delayDays > 0
          ? new Date(Date.now() + delayDays * 86400000).toISOString()
          : new Date().toISOString();

        await supabase
          .from('prospect_step_status')
          .update({ status: 'pending', scheduled_at: scheduledAt })
          .eq('id', job.prospect_step_status_id)
          .eq('status', 'waiting');

        console.log(`[AcceptanceCheck] ${prospect.name} already ACCEPTED → message step unlocked`);
      }

      await supabase.from('acceptance_check_jobs').delete().eq('id', job.id);
      results.push({ prospect: prospect.name, status: 'accepted', unlocked: true });
      continue;
    }

    if (checksRemaining <= 0) {
      // 14 days passed, no acceptance — skip the message step
      await supabase
        .from('prospect_step_status')
        .update({ status: 'skipped', error_message: 'invite_not_accepted_14d' })
        .eq('id', job.prospect_step_status_id);

      await supabase
        .from('prospect_step_status')
        .update({ status: 'skipped', error_message: 'invite_not_accepted_cascade' })
        .eq('prospect_id', job.prospect_id)
        .eq('campaign_id', job.campaign_id)
        .eq('status', 'waiting');

      await supabase.from('acceptance_check_jobs').delete().eq('id', job.id);
      results.push({ prospect: prospect.name, status: 'expired', skipped: true });
      console.log(`[AcceptanceCheck] ${prospect.name} NOT ACCEPTED after 14 days → skipped`);
    } else {
      // Schedule next check in 6 hours
      const nextCheck = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
      await supabase
        .from('acceptance_check_jobs')
        .update({ checks_remaining: checksRemaining, next_check_at: nextCheck })
        .eq('id', job.id);

      results.push({ prospect: prospect.name, status: 'still_pending', checksRemaining });
    }
  }

  return results;
}

export default router;
