/**
 * Cloud Campaign Routes
 * - /execute — Manual single action (for testing/ad-hoc)
 * - /campaign/:id/launch — Launch campaign (cron handles execution)
 * - /campaign/:id/tick — DISABLED (cron-only execution)
 * - /session-check — Check if user has active LinkedIn session
 */

import { Router } from 'express';
import { supabase } from '../supabase';
import { visitProfile, sendInvite, sendMessage, followProfile, extractSlug } from './linkedinApi';
import type { LinkedInSession } from './linkedinApi';
import { decrypt } from './encryption';

const router = Router();

function renderTemplate(template: string, prospect: any): string {
  if (!template) return '';
  const name = prospect?.name || '';
  const firstName = name.split(' ')[0] || '';
  const company = prospect?.company || '';
  return template
    .replace(/\{\{firstName\}\}/gi, firstName)
    .replace(/\{\{name\}\}/gi, name)
    .replace(/\{\{fullName\}\}/gi, name)
    .replace(/\{\{company\}\}/gi, company);
}

function profileMatchesProspect(profileName: string, prospectName: string): boolean {
  if (!profileName || !prospectName) return true;
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z\u0600-\u06ff0-9]/g, '');
  const pn = normalize(profileName);
  const sn = normalize(prospectName);
  return pn.includes(sn) || sn.includes(pn) || pn === sn;
}

async function getUserSession(userId: string): Promise<LinkedInSession | null> {
  const { data } = await supabase
    .from('linkedin_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();

  if (!data) return null;

  try {
    const liAt = decrypt(data.li_at);
    const jsessionId = data.jsessionid ? decrypt(data.jsessionid) : '';
    if (!liAt) return null;

    return {
      liAt,
      jsessionId,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    };
  } catch (e: any) {
    console.error('[Cloud] Failed to decrypt session:', e.message);
    return null;
  }
}

async function getUserTeamId(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('team_members')
    .select('team_id')
    .eq('user_id', userId)
    .single();
  return data?.team_id || null;
}

// ─── POST /api/cloud/execute — Manual single action ────────

router.post('/execute', async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Auth required' });

    const { actionType, targetUrl, message, campaignId, prospectName } = req.body;

    const session = await getUserSession(userId);
    if (!session) {
      return res.status(400).json({
        error: 'No LinkedIn session. Please open LinkedIn and reload the extension.'
      });
    }

    const slug = extractSlug(targetUrl || '');
    if (!slug) return res.status(400).json({ error: 'Invalid LinkedIn URL' });

    let result: any = { success: false, error: 'unknown_action' };

    // Human-like delay (2-5 seconds)
    await new Promise(r => setTimeout(r, 2000 + Math.random() * 3000));

    switch (actionType) {
      case 'visit': {
        result = await visitProfile(session, slug);
        break;
      }
      case 'connect': {
        const profile = await visitProfile(session, slug);
        if (profile.success && profile.profileId) {
          if (prospectName && profile.name && !profileMatchesProspect(profile.name, prospectName)) {
            result = { success: false, error: `identity_mismatch: expected "${prospectName}" but got "${profile.name}"` };
            break;
          }
          await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));
          const renderedMessage = renderTemplate(message || '', { name: prospectName });
          result = await sendInvite(session, profile.profileId, renderedMessage);
        } else {
          result = { success: false, error: 'Profile not found: ' + slug };
        }
        break;
      }
      case 'message': {
        const profile = await visitProfile(session, slug);
        if (profile.success && profile.profileId) {
          if (prospectName && profile.name && !profileMatchesProspect(profile.name, prospectName)) {
            result = { success: false, error: `identity_mismatch: expected "${prospectName}" but got "${profile.name}"` };
            break;
          }
          const profileUrn = `urn:li:fsd_profile:${profile.profileId}`;
          await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));
          const renderedMessage = renderTemplate(message || '', { name: prospectName });
          result = await sendMessage(session, profileUrn, renderedMessage);
        } else {
          result = { success: false, error: 'Profile not found: ' + slug };
        }
        break;
      }
      case 'follow': {
        result = await followProfile(session, slug);
        break;
      }
    }

    // Log activity
    const teamId = await getUserTeamId(userId);
    await supabase.from('activity_logs').insert({
      user_id: userId,
      team_id: teamId,
      campaign_id: campaignId || null,
      action_type: actionType,
      status: result.success ? 'success' : 'failed',
      prospect_name: prospectName || result.name || slug,
      linkedin_url: targetUrl,
      error_message: result.error || null,
      executed_at: new Date().toISOString(),
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/cloud/campaign/:id/launch ───────────────────

router.post('/campaign/:id/launch', async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Auth required' });

    const campaignId = req.params.id;

    // Check session
    const session = await getUserSession(userId);
    if (!session) {
      return res.status(400).json({ error: 'No LinkedIn session' });
    }

    // Get campaign
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();

    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    // Get campaign steps
    const { data: steps } = await supabase
      .from('campaign_steps')
      .select('id, step_number, step_type, delay_days')
      .eq('campaign_id', campaignId)
      .order('step_number', { ascending: true });

    if (!steps || steps.length === 0) {
      return res.status(400).json({ error: 'Campaign has no steps configured' });
    }

    // Count existing prospect_step_status rows
    const { count: existingCount } = await supabase
      .from('prospect_step_status')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .in('status', ['pending', 'waiting', 'in_progress']);

    let pendingCount = existingCount || 0;

    // If no enrollment rows exist, auto-enroll all prospects
    if (!pendingCount) {
      const { data: prospects } = await supabase
        .from('prospects')
        .select('id')
        .eq('campaign_id', campaignId);

      if (!prospects || prospects.length === 0) {
        return res.status(400).json({ error: 'No prospects in this campaign' });
      }

      const now = new Date().toISOString();
      const statusRows: any[] = [];
      for (const prospect of prospects) {
        for (const step of steps) {
          statusRows.push({
            prospect_id: prospect.id,
            campaign_id: campaignId,
            step_id: step.id,
            status: step.step_number === 1 ? 'pending' : 'waiting',
            scheduled_at: step.step_number === 1 ? now : null,
          });
        }
      }

      for (let i = 0; i < statusRows.length; i += 50) {
        await supabase.from('prospect_step_status').insert(statusRows.slice(i, i + 50));
      }

      pendingCount = statusRows.length;
      console.log(`[CloudLaunch] Auto-enrolled ${prospects.length} prospects × ${steps.length} steps`);
    }

    // Reset any stuck in_progress back to pending
    await supabase
      .from('prospect_step_status')
      .update({ status: 'pending' })
      .eq('campaign_id', campaignId)
      .eq('status', 'in_progress');

    // Activate campaign
    await supabase
      .from('campaigns')
      .update({ status: 'active', started_at: new Date().toISOString() })
      .eq('id', campaignId);

    // Log launch
    const teamId = campaign.team_id || await getUserTeamId(userId);
    await supabase.from('activity_logs').insert({
      user_id: userId,
      team_id: teamId,
      campaign_id: campaignId,
      action_type: 'campaign_launch',
      status: 'success',
      prospect_name: `Campaign "${campaign.name}" launched`,
      executed_at: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: 'Campaign launched — cron will process actions every minute',
      prospects: pendingCount,
      steps: steps.length,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/cloud/campaign/:id/tick — DISABLED ──────────
// All execution handled by /api/cron/campaign-runner

router.post('/campaign/:id/tick', async (_req, res) => {
  return res.json({
    ok: true,
    disabled: true,
    message: 'Cron handles all execution. /tick is disabled to prevent duplicate actions.',
  });
});

// ─── GET /api/cloud/session-check ──────────────────────────

router.get('/session-check', async (req, res) => {
  const userId = (req as any).user?.id;
  if (!userId) return res.json({ hasSession: false });

  const session = await getUserSession(userId);
  res.json({ hasSession: !!session });
});

export default router;
