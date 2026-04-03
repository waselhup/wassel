/**
 * Campaign Cron Runner
 * Vercel Cron: runs every minute via GET /api/cron/campaign-runner
 * Processes one pending action per active campaign per user.
 * Uses prospect_step_status + prospects tables for tracking.
 */

import { Router } from 'express';
import { supabase } from '../supabase';
import { visitProfile, sendInvite, sendMessage } from './linkedinApi';
import crypto from 'crypto';

const router = Router();

const ENCRYPTION_KEY = process.env.SESSION_ENCRYPTION_KEY || 'wassel-session-key-2026-secure!!';
const CRON_SECRET = process.env.CRON_SECRET || '';

// Daily limits per user
const DAILY_LIMITS: Record<string, number> = { visit: 80, connect: 20, message: 30 };

function decrypt(text: string): string {
  if (!text) return '';
  // If it doesn't look encrypted (no colon separator), return as-is
  if (!text.includes(':')) return text;
  try {
    const [ivHex, encrypted] = text.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32),
      iv
    );
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    // If decryption fails, return raw value (might be stored unencrypted)
    return text;
  }
}

function renderTemplate(template: string, prospect: any): string {
  if (!template) return '';
  const firstName = (prospect?.name || '').split(' ')[0] || '';
  const fullName = prospect?.name || '';
  const company = prospect?.company || '';
  return template
    .replace(/\{\{firstName\}\}/gi, firstName)
    .replace(/\{\{name\}\}/gi, fullName)
    .replace(/\{\{fullName\}\}/gi, fullName)
    .replace(/\{\{company\}\}/gi, company);
}

function profileMatchesProspect(profileName: string, prospectName: string): boolean {
  if (!profileName || !prospectName) return true;
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z\u0600-\u06ff0-9]/g, '');
  const pn = normalize(profileName);
  const sn = normalize(prospectName);
  return pn.includes(sn) || sn.includes(pn) || pn === sn;
}

async function getUserSession(userId: string) {
  const { data } = await supabase
    .from('linkedin_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();

  if (!data) return null;
  return {
    liAt: decrypt(data.li_at),
    jsessionId: data.jsessionid ? decrypt(data.jsessionid) : '',
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
    .eq('status', 'success')
    .gte('executed_at', today.toISOString());
  return count || 0;
}

// Map step_type to action_type for logging
function stepTypeToActionType(stepType: string): string | null {
  if (stepType === 'visit') return 'visit';
  if (stepType === 'invitation') return 'connect';
  if (stepType === 'message') return 'message';
  return null;
}

// GET /api/cron/campaign-runner
router.get('/campaign-runner', async (req: any, res: any) => {
  // Verify cron secret if set
  const authHeader = req.headers['authorization'] || '';
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const results: any[] = [];
  const startTime = Date.now();

  try {
    // Recovery: reset stuck in_progress items older than 10 minutes
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    await supabase
      .from('prospect_step_status')
      .update({ status: 'pending' })
      .eq('status', 'in_progress')
      .lt('created_at', tenMinAgo);

    // Get all active campaigns
    const { data: activeCampaigns } = await supabase
      .from('campaigns')
      .select('id, team_id, created_by, name')
      .eq('status', 'active');

    if (!activeCampaigns?.length) {
      return res.json({ ok: true, message: 'No active campaigns', processed: 0 });
    }

    // Group by team_id, then resolve user from team_members
    // (created_by is often null, so we look up the team owner instead)
    const teamCampaigns: Record<string, any[]> = {};
    for (const campaign of activeCampaigns) {
      const key = campaign.team_id;
      if (!key) continue;
      if (!teamCampaigns[key]) teamCampaigns[key] = [];
      teamCampaigns[key].push(campaign);
    }

    // Resolve team_id → user_id (first member with an active LinkedIn session)
    const userCampaigns: Record<string, any[]> = {};
    for (const [teamId, campaigns] of Object.entries(teamCampaigns)) {
      const { data: members } = await supabase
        .from('team_members')
        .select('user_id')
        .eq('team_id', teamId);

      if (!members?.length) continue;

      // Find first member who has an active LinkedIn session
      let resolvedUserId: string | null = null;
      for (const m of members) {
        const { data: sess } = await supabase
          .from('linkedin_sessions')
          .select('id')
          .eq('user_id', m.user_id)
          .eq('status', 'active')
          .limit(1);
        if (sess?.length) {
          resolvedUserId = m.user_id;
          break;
        }
      }

      if (resolvedUserId) {
        if (!userCampaigns[resolvedUserId]) userCampaigns[resolvedUserId] = [];
        userCampaigns[resolvedUserId].push(...campaigns);
      }
    }

    for (const [userId, campaigns] of Object.entries(userCampaigns)) {
      // Get user's LinkedIn session
      const session = await getUserSession(userId);
      if (!session) {
        results.push({ userId, error: 'no_session' });
        continue;
      }

      for (const campaign of campaigns) {
        // Auto-enroll: if campaign is active but has no prospect_step_status rows, create them
        const { count: totalRows } = await supabase
          .from('prospect_step_status')
          .select('*', { count: 'exact', head: true })
          .eq('campaign_id', campaign.id);

        if (!totalRows) {
          const { data: prospects } = await supabase
            .from('prospects')
            .select('id')
            .eq('campaign_id', campaign.id);

          const { data: campaignSteps } = await supabase
            .from('campaign_steps')
            .select('id, step_number')
            .eq('campaign_id', campaign.id)
            .order('step_number', { ascending: true });

          if (prospects?.length && campaignSteps?.length) {
            const now = new Date().toISOString();
            const rows: any[] = [];
            for (const p of prospects) {
              for (const s of campaignSteps) {
                rows.push({
                  prospect_id: p.id,
                  campaign_id: campaign.id,
                  step_id: s.id,
                  status: s.step_number === 1 ? 'pending' : 'waiting',
                  scheduled_at: s.step_number === 1 ? now : null,
                });
              }
            }
            for (let i = 0; i < rows.length; i += 50) {
              await supabase.from('prospect_step_status').insert(rows.slice(i, i + 50));
            }
            console.log(`[Cron] Auto-enrolled ${prospects.length} prospects × ${campaignSteps.length} steps for "${campaign.name}"`);
          }
        }

        // Get ONE pending prospect_step_status for this campaign
        // Only get steps where scheduled_at <= now (respects delays)
        const now = new Date().toISOString();
        const { data: pendingSteps } = await supabase
          .from('prospect_step_status')
          .select(`
            id,
            prospect_id,
            step_id,
            status,
            campaign_steps!inner (
              step_number,
              step_type,
              name,
              message_template
            ),
            prospects!inner (
              linkedin_url,
              name,
              company
            )
          `)
          .eq('campaign_id', campaign.id)
          .eq('status', 'pending')
          .or(`scheduled_at.is.null,scheduled_at.lte.${now}`)
          .order('created_at', { ascending: true })
          .limit(1);

        if (!pendingSteps?.length) {
          // Check if all steps are done for this campaign
          const { count: remainingCount } = await supabase
            .from('prospect_step_status')
            .select('*', { count: 'exact', head: true })
            .eq('campaign_id', campaign.id)
            .in('status', ['pending', 'in_progress', 'waiting']);

          if (!remainingCount) {
            await supabase
              .from('campaigns')
              .update({ status: 'completed', completed_at: new Date().toISOString() })
              .eq('id', campaign.id);
            results.push({ campaign: campaign.name, status: 'completed' });
          }
          continue;
        }

        const pss = pendingSteps[0];
        const stepDef = (pss as any).campaign_steps;
        const prospect = (pss as any).prospects;

        if (!prospect?.linkedin_url) continue;

        const slug = prospect.linkedin_url.match(/\/in\/([^/?]+)/)?.[1];
        if (!slug) continue;

        const actionType = stepTypeToActionType(stepDef.step_type);
        if (!actionType) continue;

        // Check daily limit
        const dailyCount = await getDailyCount(userId, actionType);
        if (dailyCount >= DAILY_LIMITS[actionType]) {
          results.push({ campaign: campaign.name, prospect: prospect.name, skipped: `daily_limit_${actionType}` });
          continue;
        }

        // Atomic claim: only update if still 'pending' (prevents duplicate processing)
        const { data: claimed } = await supabase
          .from('prospect_step_status')
          .update({ status: 'in_progress' })
          .eq('id', pss.id)
          .eq('status', 'pending')
          .select('id');

        if (!claimed?.length) {
          // Another process already claimed this row — skip
          continue;
        }

        // Log "in_progress" activity for live visibility
        await supabase.from('activity_logs').insert({
          user_id: userId,
          team_id: campaign.team_id,
          campaign_id: campaign.id,
          action_type: actionType,
          status: 'in_progress',
          prospect_name: prospect.name || slug,
          linkedin_url: prospect.linkedin_url,
          executed_at: new Date().toISOString(),
        });

        let result: any = { success: false, error: 'unknown' };

        try {
          switch (actionType) {
            case 'visit':
              result = await visitProfile(session, slug);
              break;
            case 'connect': {
              const profile = await visitProfile(session, slug);
              if (profile.success && profile.profileId) {
                if (prospect.name && profile.name && !profileMatchesProspect(profile.name, prospect.name)) {
                  result = { success: false, error: `identity_mismatch: expected "${prospect.name}" got "${profile.name}"` };
                  break;
                }
                await new Promise(r => setTimeout(r, 2000 + Math.random() * 2000));
                const note = renderTemplate(stepDef.message_template || '', prospect);
                result = await sendInvite(session, profile.profileId, note);
              } else {
                result = { success: false, error: 'profile_not_found' };
              }
              break;
            }
            case 'message': {
              const profile = await visitProfile(session, slug);
              if (profile.success && profile.profileId) {
                if (prospect.name && profile.name && !profileMatchesProspect(profile.name, prospect.name)) {
                  result = { success: false, error: `identity_mismatch: expected "${prospect.name}" got "${profile.name}"` };
                  break;
                }
                const urn = `urn:li:fsd_profile:${profile.profileId}`;
                await new Promise(r => setTimeout(r, 2000 + Math.random() * 2000));
                const msg = renderTemplate(stepDef.message_template || '', prospect);
                result = await sendMessage(session, urn, msg);
              } else {
                result = { success: false, error: 'profile_not_found' };
              }
              break;
            }
          }
        } catch (e: any) {
          result = { success: false, error: e.message };
        }

        const finalStatus = result.success ? 'completed' : 'failed';

        // Update prospect_step_status
        await supabase
          .from('prospect_step_status')
          .update({
            status: finalStatus,
            executed_at: new Date().toISOString(),
            error_message: result.error || null,
          })
          .eq('id', pss.id);

        // Update the activity log — replace the in_progress entry with final status
        await supabase.from('activity_logs').insert({
          user_id: userId,
          team_id: campaign.team_id,
          campaign_id: campaign.id,
          action_type: actionType,
          status: finalStatus,
          prospect_name: prospect.name || slug,
          linkedin_url: prospect.linkedin_url,
          error_message: result.error || null,
          executed_at: new Date().toISOString(),
        });

        // If success, unlock next step for this prospect in this campaign
        if (result.success) {
          const currentStepNumber = stepDef.step_number;

          // Get next step definition
          const { data: nextStepDef } = await supabase
            .from('campaign_steps')
            .select('id, step_number, step_type, delay_days')
            .eq('campaign_id', campaign.id)
            .eq('step_number', currentStepNumber + 1)
            .single();

          if (nextStepDef) {
            // Calculate scheduled_at based on delay_days
            const delayDays = nextStepDef.delay_days || 0;
            const scheduledAt = delayDays > 0
              ? new Date(Date.now() + delayDays * 86400000).toISOString()
              : new Date().toISOString();

            // Unlock next step for this prospect
            const { data: unlocked } = await supabase
              .from('prospect_step_status')
              .update({ status: 'pending', scheduled_at: scheduledAt })
              .eq('prospect_id', pss.prospect_id)
              .eq('campaign_id', campaign.id)
              .eq('step_id', nextStepDef.id)
              .eq('status', 'waiting')
              .select('id');

            console.log(`[Cron] Step ${currentStepNumber}→${currentStepNumber+1} for ${prospect.name}: unlocked=${unlocked?.length || 0}`);
          }

          // Update prospect connection_status if invite was sent
          if (actionType === 'connect') {
            await supabase
              .from('prospects')
              .update({ connection_status: 'pending' })
              .eq('id', pss.prospect_id);
          }
        }

        // If session_expired, mark as pending again to retry later
        if (!result.success && result.error?.includes('session_expired')) {
          await supabase
            .from('prospect_step_status')
            .update({ status: 'pending', error_message: result.error })
            .eq('id', pss.id);
        }

        results.push({
          campaign: campaign.name,
          prospect: prospect.name || slug,
          action: actionType,
          stepNumber: stepDef.step_number,
          success: result.success,
          error: result.error || null,
        });

        // Abort if we're close to Vercel's 10s limit
        if (Date.now() - startTime > 8000) break;
      }

      if (Date.now() - startTime > 8000) break;
    }

    return res.json({ ok: true, processed: results.length, results });
  } catch (err: any) {
    console.error('[CampaignCron] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
