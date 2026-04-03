/**
 * Campaign Cron Runner
 * Vercel Cron: runs every minute via GET /api/cron/campaign-runner
 * Processes one pending action per active campaign per user.
 * Replaces background execution that gets killed on Vercel Serverless.
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
    .eq('is_valid', true)
    .single();

  if (!data) return null;
  return {
    liAt: decrypt(data.li_at),
    jsessionId: data.jsession_id ? decrypt(data.jsession_id) : '',
    userAgent: data.user_agent || '',
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

// GET /api/cron/campaign-runner
// Called by Vercel Cron every minute
router.get('/campaign-runner', async (req: any, res: any) => {
  // Verify cron secret if set
  const authHeader = req.headers['authorization'] || '';
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const results: any[] = [];
  const startTime = Date.now();

  try {
    // Get all active campaigns
    const { data: activeCampaigns } = await supabase
      .from('campaigns')
      .select('id, user_id, name')
      .eq('status', 'active');

    if (!activeCampaigns?.length) {
      return res.json({ ok: true, message: 'No active campaigns', processed: 0 });
    }

    // Group by user to manage sessions efficiently
    const userCampaigns: Record<string, any[]> = {};
    for (const campaign of activeCampaigns) {
      if (!userCampaigns[campaign.user_id]) userCampaigns[campaign.user_id] = [];
      userCampaigns[campaign.user_id].push(campaign);
    }

    for (const [userId, campaigns] of Object.entries(userCampaigns)) {
      // Get user's LinkedIn session
      const session = await getUserSession(userId);
      if (!session) {
        results.push({ userId, error: 'no_session' });
        continue;
      }

      for (const campaign of campaigns) {
        // Get campaign steps
        const { data: steps } = await supabase
          .from('campaign_steps')
          .select('*')
          .eq('campaign_id', campaign.id)
          .order('step_order', { ascending: true });

        if (!steps?.length) continue;

        // Get ONE pending prospect for this campaign
        const { data: pendingProspects } = await supabase
          .from('campaign_prospects')
          .select('*, prospect:prospects(*)')
          .eq('campaign_id', campaign.id)
          .eq('status', 'pending')
          .limit(1);

        if (!pendingProspects?.length) {
          // No more pending — check if all done
          const { count: remainingCount } = await supabase
            .from('campaign_prospects')
            .select('*', { count: 'exact', head: true })
            .eq('campaign_id', campaign.id)
            .in('status', ['pending', 'in_progress']);

          if (!remainingCount) {
            await supabase
              .from('campaigns')
              .update({ status: 'completed', completed_at: new Date().toISOString() })
              .eq('id', campaign.id);
            results.push({ campaign: campaign.name, status: 'completed' });
          }
          continue;
        }

        const cp = pendingProspects[0];
        const prospect = cp.prospect;
        if (!prospect?.linkedin_url) continue;

        const slug = prospect.linkedin_url.match(/\/in\/([^/?]+)/)?.[1];
        if (!slug) continue;

        // Mark as in_progress to avoid double-processing
        await supabase
          .from('campaign_prospects')
          .update({ status: 'in_progress' })
          .eq('id', cp.id);

        // Process each step in order
        let allStepsDone = true;
        for (const step of steps) {
          const actionType = step.step_type === 'visit' ? 'visit'
            : step.step_type === 'invite' ? 'connect'
              : step.step_type === 'message' ? 'message' : null;

          if (!actionType) continue;

          // Check daily limit
          const dailyCount = await getDailyCount(userId, actionType);
          if (dailyCount >= DAILY_LIMITS[actionType]) {
            results.push({ campaign: campaign.name, prospect: prospect.name, skipped: `daily_limit_${actionType}` });
            allStepsDone = false;
            // Put back to pending so it's retried tomorrow
            await supabase
              .from('campaign_prospects')
              .update({ status: 'pending' })
              .eq('id', cp.id);
            break;
          }

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
                  const note = renderTemplate(step.message_template || '', prospect);
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
                  const msg = renderTemplate(step.message_template || '', prospect);
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

          // Log activity
          await supabase.from('activity_logs').insert({
            user_id: userId,
            campaign_id: campaign.id,
            action_type: actionType,
            status: result.success ? 'success' : 'failed',
            prospect_name: prospect.name || slug,
            linkedin_url: prospect.linkedin_url,
            error_message: result.error || null,
            executed_at: new Date().toISOString(),
          });

          results.push({
            campaign: campaign.name,
            prospect: prospect.name || slug,
            action: actionType,
            success: result.success,
            error: result.error || null,
          });

          // Stop on failure to avoid wasting quota
          if (!result.success) {
            allStepsDone = false;
            break;
          }

          // Small delay between steps
          await new Promise(r => setTimeout(r, 1000));
        }

        // Update prospect status
        await supabase
          .from('campaign_prospects')
          .update({
            status: allStepsDone ? 'completed' : 'failed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', cp.id);

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
