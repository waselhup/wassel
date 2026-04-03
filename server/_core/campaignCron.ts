/**
 * Campaign Cron Runner — THE SINGLE EXECUTOR
 * Vercel Cron: runs every minute via GET /api/cron/campaign-runner
 *
 * Architecture:
 * - Only this cron processes campaign actions (no /tick, no frontend triggers)
 * - Processes ONE action per active campaign per run
 * - Atomic row claiming prevents duplicate actions
 * - Includes acceptance checker for invite→message sequences
 * - Human-like random delays between actions
 * - Daily rate limits per user per action type
 */

import { Router } from 'express';
import { supabase } from '../supabase';
import {
  visitProfile,
  sendInvite,
  sendMessage,
  followProfile,
  checkConnectionStatus,
  extractSlug,
} from './linkedinApi';
import type { LinkedInSession } from './linkedinApi';
import { decrypt } from './encryption';

const router = Router();

const CRON_SECRET = process.env.CRON_SECRET || '';

// ─── Rate Limits (Medium: balanced safety + throughput) ────
const DAILY_LIMITS: Record<string, number> = {
  visit: 100,
  connect: 50,
  message: 60,
  follow: 50,
};

function renderTemplate(template: string, prospect: any): string {
  if (!template) return '';
  const name = prospect?.name || '';
  const firstName = name.split(' ')[0] || '';
  const lastName = name.split(' ').slice(1).join(' ') || '';
  const company = prospect?.company || '';
  const title = prospect?.title || '';
  return template
    .replace(/\{\{firstName\}\}/gi, firstName)
    .replace(/\{\{lastName\}\}/gi, lastName)
    .replace(/\{\{name\}\}/gi, name)
    .replace(/\{\{fullName\}\}/gi, name)
    .replace(/\{\{company\}\}/gi, company)
    .replace(/\{\{jobTitle\}\}/gi, title)
    .replace(/\{\{title\}\}/gi, title);
}

function profileMatchesProspect(profileName: string, prospectName: string): boolean {
  if (!profileName || !prospectName) return true;
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z\u0600-\u06ff0-9]/g, '');
  const pn = normalize(profileName);
  const sn = normalize(prospectName);
  return pn.includes(sn) || sn.includes(pn) || pn === sn;
}

/** Map step_type → action_type for logging and rate limiting */
function stepTypeToActionType(stepType: string): string | null {
  const map: Record<string, string> = {
    visit: 'visit',
    invitation: 'connect',
    invite: 'connect',
    connect: 'connect',
    message: 'message',
    followup: 'message',
    follow_up: 'message',
    follow: 'follow',
  };
  return map[stepType] || null;
}

async function getUserSession(userId: string): Promise<LinkedInSession | null> {
  const { data } = await supabase
    .from('linkedin_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();

  if (!data) return null;

  // Check if session is expired
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    await supabase
      .from('linkedin_sessions')
      .update({ status: 'expired' })
      .eq('id', data.id);
    return null;
  }

  let liAt = '';
  let jsessionId = '';

  try {
    liAt = decrypt(data.li_at);
  } catch (e: any) {
    console.error('[Cron] Failed to decrypt li_at:', e.message);
    return null;
  }

  try {
    jsessionId = data.jsessionid ? decrypt(data.jsessionid) : '';
  } catch (e: any) {
    console.error('[Cron] Failed to decrypt jsessionid:', e.message);
  }

  if (!liAt) {
    console.error('[Cron] Decrypted li_at is empty');
    return null;
  }

  return {
    liAt,
    jsessionId,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  };
}

async function getDailyCount(userId: string, actionType: string): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { count } = await supabase
    .from('activity_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('action_type', actionType)
    .in('status', ['success', 'completed'])
    .gte('executed_at', today.toISOString());
  return count || 0;
}

// ─── MAIN CRON ENDPOINT ────────────────────────────────────

router.get('/campaign-runner', async (req: any, res: any) => {
  // Verify cron secret if set
  const authHeader = req.headers['authorization'] || '';
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const results: any[] = [];
  const startTime = Date.now();

  try {
    // ── Step 1: Recovery — reset stuck in_progress older than 10 min ──
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: stuckRows } = await supabase
      .from('prospect_step_status')
      .update({ status: 'pending' })
      .eq('status', 'in_progress')
      .lt('created_at', tenMinAgo)
      .select('id');

    if (stuckRows?.length) {
      console.log(`[Cron] Recovered ${stuckRows.length} stuck rows`);
    }

    // ── Step 2: Get all active campaigns ──
    const { data: activeCampaigns } = await supabase
      .from('campaigns')
      .select('id, team_id, created_by, name')
      .eq('status', 'active');

    if (!activeCampaigns?.length) {
      return res.json({ ok: true, message: 'No active campaigns', processed: 0 });
    }

    // ── Step 3: Resolve campaigns → users with active LinkedIn sessions ──
    const teamCampaigns: Record<string, any[]> = {};
    for (const c of activeCampaigns) {
      if (!c.team_id) continue;
      if (!teamCampaigns[c.team_id]) teamCampaigns[c.team_id] = [];
      teamCampaigns[c.team_id].push(c);
    }

    const userCampaigns: Record<string, { campaigns: any[]; teamId: string }> = {};
    for (const [teamId, campaigns] of Object.entries(teamCampaigns)) {
      const { data: members } = await supabase
        .from('team_members')
        .select('user_id')
        .eq('team_id', teamId);

      if (!members?.length) continue;

      // Find first member with active LinkedIn session
      for (const m of members) {
        const { data: sess } = await supabase
          .from('linkedin_sessions')
          .select('id')
          .eq('user_id', m.user_id)
          .eq('status', 'active')
          .limit(1);

        if (sess?.length) {
          if (!userCampaigns[m.user_id]) {
            userCampaigns[m.user_id] = { campaigns: [], teamId };
          }
          userCampaigns[m.user_id].campaigns.push(...campaigns);
          break;
        }
      }
    }

    // ── Step 4: Process ONE action per campaign per user ──
    for (const [userId, { campaigns, teamId }] of Object.entries(userCampaigns)) {
      const session = await getUserSession(userId);
      if (!session) {
        results.push({ userId, error: 'no_session' });
        continue;
      }

      for (const campaign of campaigns) {
        // Abort if approaching Vercel's 10s timeout
        if (Date.now() - startTime > 8000) break;

        try {
          const result = await processCampaignAction(campaign, userId, teamId, session);
          if (result) results.push(result);
        } catch (err: any) {
          console.error(`[Cron] Error processing campaign ${campaign.name}:`, err.message);
          results.push({ campaign: campaign.name, error: err.message });
        }
      }

      if (Date.now() - startTime > 8000) break;
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

    return res.json({ ok: true, processed: results.length, results, elapsed: Date.now() - startTime });
  } catch (err: any) {
    console.error('[CampaignCron] Fatal error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Process ONE action for a campaign ─────────────────────

async function processCampaignAction(
  campaign: any,
  userId: string,
  teamId: string,
  session: LinkedInSession
): Promise<any> {
  // Auto-enroll: if campaign active but no prospect_step_status rows, create them
  const { count: totalRows } = await supabase
    .from('prospect_step_status')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', campaign.id);

  if (!totalRows) {
    await autoEnrollProspects(campaign.id);
  }

  // Get ONE pending action (scheduled_at <= now)
  const now = new Date().toISOString();
  const { data: pendingSteps } = await supabase
    .from('prospect_step_status')
    .select(`
      id,
      prospect_id,
      step_id,
      status,
      campaign_steps!inner (
        id,
        step_number,
        step_type,
        name,
        message_template,
        delay_days
      ),
      prospects!inner (
        id,
        linkedin_url,
        name,
        company,
        title,
        connection_status
      )
    `)
    .eq('campaign_id', campaign.id)
    .eq('status', 'pending')
    .or(`scheduled_at.is.null,scheduled_at.lte.${now}`)
    .order('created_at', { ascending: true })
    .limit(1);

  if (!pendingSteps?.length) {
    // Check if campaign should be marked complete
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
      return { campaign: campaign.name, status: 'completed' };
    }
    return null; // Nothing pending right now
  }

  const pss = pendingSteps[0];
  const stepDef = (pss as any).campaign_steps;
  const prospect = (pss as any).prospects;

  if (!prospect?.linkedin_url) return null;

  const slug = extractSlug(prospect.linkedin_url);
  if (!slug) return null;

  const actionType = stepTypeToActionType(stepDef.step_type);
  if (!actionType) return null;

  // ── Rate limit check ──
  const dailyCount = await getDailyCount(userId, actionType);
  const limit = DAILY_LIMITS[actionType] || 50;
  if (dailyCount >= limit) {
    return { campaign: campaign.name, prospect: prospect.name, skipped: `daily_limit_${actionType} (${dailyCount}/${limit})` };
  }

  // ── For message steps: check if prospect is actually connected ──
  if (actionType === 'message' && prospect.connection_status !== 'accepted') {
    // Can't message someone who hasn't accepted our invite
    // Skip this step or wait for acceptance checker
    const connectionCheck = await checkConnectionStatus(session, slug);
    if (connectionCheck.status === 'connected') {
      // Update prospect status
      await supabase
        .from('prospects')
        .update({ connection_status: 'accepted' })
        .eq('id', prospect.id);
    } else {
      // Skip — can't message yet, acceptance checker will unlock when ready
      return { campaign: campaign.name, prospect: prospect.name, skipped: 'not_connected_yet' };
    }
  }

  // ── Atomic claim: UPDATE ... WHERE status='pending' ──
  const { data: claimed } = await supabase
    .from('prospect_step_status')
    .update({ status: 'in_progress' })
    .eq('id', pss.id)
    .eq('status', 'pending')  // This is the atomic guard
    .select('id');

  if (!claimed?.length) {
    return null; // Another process already claimed it
  }

  // ── Execute the action ──
  let result: { success: boolean; error?: string; name?: string; profileId?: string } = {
    success: false,
    error: 'unknown',
  };

  try {
    switch (actionType) {
      case 'visit': {
        result = await visitProfile(session, slug);
        break;
      }

      case 'connect': {
        // Visit first to get profileId
        const profile = await visitProfile(session, slug);
        if (!profile.success || !profile.profileId) {
          result = { success: false, error: 'profile_not_found' };
          break;
        }

        // Identity verification
        if (prospect.name && profile.name && !profileMatchesProspect(profile.name, prospect.name)) {
          result = { success: false, error: `identity_mismatch: expected "${prospect.name}" got "${profile.name}"` };
          break;
        }

        // Human-like delay between visit and connect (2-5s)
        await new Promise(r => setTimeout(r, 2000 + Math.random() * 3000));

        // Render template and send invite
        const note = renderTemplate(stepDef.message_template || '', prospect);
        result = await sendInvite(session, profile.profileId, note);
        break;
      }

      case 'message': {
        // Visit first to get profileId
        const profile = await visitProfile(session, slug);
        if (!profile.success || !profile.profileId) {
          result = { success: false, error: 'profile_not_found' };
          break;
        }

        // Identity verification
        if (prospect.name && profile.name && !profileMatchesProspect(profile.name, prospect.name)) {
          result = { success: false, error: `identity_mismatch: expected "${prospect.name}" got "${profile.name}"` };
          break;
        }

        // Human-like delay (2-5s)
        await new Promise(r => setTimeout(r, 2000 + Math.random() * 3000));

        const urn = `urn:li:fsd_profile:${profile.profileId}`;
        const msg = renderTemplate(stepDef.message_template || '', prospect);
        result = await sendMessage(session, urn, msg);
        break;
      }

      case 'follow': {
        result = await followProfile(session, slug);
        break;
      }
    }
  } catch (e: any) {
    result = { success: false, error: e.message };
  }

  const finalStatus = result.success ? 'completed' : 'failed';

  // ── Update prospect_step_status ──
  await supabase
    .from('prospect_step_status')
    .update({
      status: finalStatus,
      executed_at: new Date().toISOString(),
      error_message: result.error || null,
    })
    .eq('id', pss.id);

  // ── Log activity ──
  await supabase.from('activity_logs').insert({
    user_id: userId,
    team_id: teamId,
    campaign_id: campaign.id,
    prospect_id: prospect.id,
    action_type: actionType,
    status: finalStatus === 'completed' ? 'success' : 'failed',
    prospect_name: prospect.name || slug,
    linkedin_url: prospect.linkedin_url,
    error_message: result.error || null,
    executed_at: new Date().toISOString(),
  });

  // ── On SUCCESS: unlock next step + create acceptance job if needed ──
  if (result.success) {
    await unlockNextStep(pss, stepDef, campaign, prospect, actionType, userId, teamId);
  }

  // ── On session_expired: revert to pending for retry ──
  if (!result.success && result.error?.includes('session_expired')) {
    await supabase
      .from('prospect_step_status')
      .update({ status: 'pending', error_message: 'session_expired - will retry' })
      .eq('id', pss.id);

    // Mark session as expired
    await supabase
      .from('linkedin_sessions')
      .update({ status: 'expired' })
      .eq('user_id', userId)
      .eq('status', 'active');
  }

  return {
    campaign: campaign.name,
    prospect: prospect.name || slug,
    action: actionType,
    step: stepDef.step_number,
    success: result.success,
    error: result.error || null,
  };
}

// ─── Unlock Next Step ──────────────────────────────────────

async function unlockNextStep(
  pss: any,
  stepDef: any,
  campaign: any,
  prospect: any,
  actionType: string,
  userId: string,
  teamId: string
) {
  const currentStepNumber = stepDef.step_number;

  // Get next step definition
  const { data: nextStepDef } = await supabase
    .from('campaign_steps')
    .select('id, step_number, step_type, delay_days')
    .eq('campaign_id', campaign.id)
    .eq('step_number', currentStepNumber + 1)
    .single();

  if (!nextStepDef) return; // No more steps

  const nextActionType = stepTypeToActionType(nextStepDef.step_type);

  // ── Special case: if current step was CONNECT and next step needs connection ──
  // Don't unlock next step immediately — create acceptance check job instead
  if (actionType === 'connect' && (nextActionType === 'message')) {
    // Update prospect connection_status
    await supabase
      .from('prospects')
      .update({ connection_status: 'pending' })
      .eq('id', pss.prospect_id);

    // Get the next step's prospect_step_status row
    const { data: nextPss } = await supabase
      .from('prospect_step_status')
      .select('id')
      .eq('prospect_id', pss.prospect_id)
      .eq('campaign_id', campaign.id)
      .eq('step_id', nextStepDef.id)
      .single();

    if (nextPss) {
      // Create acceptance check job (check every 6 hours for 14 days = 56 checks)
      const nextCheckAt = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(); // 6 hours from now

      await supabase.from('acceptance_check_jobs').insert({
        prospect_step_status_id: nextPss.id,
        prospect_id: pss.prospect_id,
        campaign_id: campaign.id,
        next_check_at: nextCheckAt,
        checks_remaining: 56, // 14 days × 4 checks/day
      });

      console.log(`[Cron] Created acceptance check job for ${prospect.name} (step ${currentStepNumber}→${currentStepNumber + 1})`);
    }
    return; // Don't unlock — acceptance checker will handle it
  }

  // ── Normal case: unlock next step with delay ──
  if (actionType === 'connect') {
    await supabase
      .from('prospects')
      .update({ connection_status: 'pending' })
      .eq('id', pss.prospect_id);
  }

  const delayDays = nextStepDef.delay_days || 0;
  const scheduledAt = delayDays > 0
    ? new Date(Date.now() + delayDays * 86400000).toISOString()
    : new Date().toISOString();

  const { data: unlocked } = await supabase
    .from('prospect_step_status')
    .update({ status: 'pending', scheduled_at: scheduledAt })
    .eq('prospect_id', pss.prospect_id)
    .eq('campaign_id', campaign.id)
    .eq('step_id', nextStepDef.id)
    .eq('status', 'waiting')
    .select('id');

  console.log(`[Cron] Step ${currentStepNumber}→${currentStepNumber + 1} for ${prospect.name}: unlocked=${unlocked?.length || 0}, scheduled=${scheduledAt}`);
}

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

  // Insert in chunks of 50
  for (let i = 0; i < rows.length; i += 50) {
    await supabase.from('prospect_step_status').insert(rows.slice(i, i + 50));
  }

  console.log(`[Cron] Auto-enrolled ${prospects.length} prospects × ${steps.length} steps for campaign ${campaignId}`);
}

// ─── ACCEPTANCE CHECKER ────────────────────────────────────
// Checks if prospects accepted connection requests
// If accepted → unlocks the next step (message)
// If expired (14 days) → marks as skipped

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
    .limit(5); // Process up to 5 checks per cron run

  if (!jobs?.length) return results;

  // We need a session to check connection status — find any active session
  const { data: anySession } = await supabase
    .from('linkedin_sessions')
    .select('user_id')
    .eq('status', 'active')
    .limit(1)
    .single();

  if (!anySession) return results;

  const session = await getUserSession(anySession.user_id);
  if (!session) return results;

  for (const job of jobs) {
    if (Date.now() - startTime > 8500) break; // Don't exceed timeout

    const prospect = (job as any).prospects;
    if (!prospect?.linkedin_url) continue;

    const slug = extractSlug(prospect.linkedin_url);
    if (!slug) continue;

    try {
      const connectionCheck = await checkConnectionStatus(session, slug);

      if (connectionCheck.status === 'connected') {
        // 🎉 Accepted! Unlock the next step (message)
        // Update prospect
        await supabase
          .from('prospects')
          .update({ connection_status: 'accepted' })
          .eq('id', job.prospect_id);

        // Get the prospect_step_status for the message step
        const { data: pss } = await supabase
          .from('prospect_step_status')
          .select('id, step_id')
          .eq('id', job.prospect_step_status_id)
          .single();

        if (pss) {
          // Get the step's delay_days
          const { data: stepDef } = await supabase
            .from('campaign_steps')
            .select('delay_days')
            .eq('id', pss.step_id)
            .single();

          const delayDays = stepDef?.delay_days || 0;
          const scheduledAt = delayDays > 0
            ? new Date(Date.now() + delayDays * 86400000).toISOString()
            : new Date().toISOString();

          // Unlock the message step
          await supabase
            .from('prospect_step_status')
            .update({ status: 'pending', scheduled_at: scheduledAt })
            .eq('id', job.prospect_step_status_id)
            .eq('status', 'waiting');

          console.log(`[AcceptanceCheck] ${prospect.name} ACCEPTED → message step unlocked, scheduled for ${scheduledAt}`);
        }

        // Delete the check job (done!)
        await supabase
          .from('acceptance_check_jobs')
          .delete()
          .eq('id', job.id);

        results.push({ prospect: prospect.name, status: 'accepted', unlocked: true });

      } else if (connectionCheck.status === 'error' && connectionCheck.error?.includes('session_expired')) {
        // Session expired — don't decrement, just reschedule
        await supabase
          .from('acceptance_check_jobs')
          .update({ next_check_at: new Date(Date.now() + 30 * 60 * 1000).toISOString() }) // retry in 30 min
          .eq('id', job.id);

      } else {
        // Still pending — schedule next check and decrement
        const checksRemaining = job.checks_remaining - 1;

        if (checksRemaining <= 0) {
          // 14 days passed, no acceptance — skip the message step
          await supabase
            .from('prospect_step_status')
            .update({ status: 'skipped', error_message: 'invite_not_accepted_14d' })
            .eq('id', job.prospect_step_status_id);

          // Also skip all subsequent steps for this prospect in this campaign
          await supabase
            .from('prospect_step_status')
            .update({ status: 'skipped', error_message: 'invite_not_accepted_cascade' })
            .eq('prospect_id', job.prospect_id)
            .eq('campaign_id', job.campaign_id)
            .eq('status', 'waiting');

          // Delete the check job
          await supabase
            .from('acceptance_check_jobs')
            .delete()
            .eq('id', job.id);

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
    } catch (err: any) {
      console.error(`[AcceptanceCheck] Error for ${prospect.name}:`, err.message);
    }
  }

  return results;
}

export default router;
