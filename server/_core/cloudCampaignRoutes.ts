import { Router } from 'express';
import { supabase } from '../supabase';
import { visitProfile, sendInvite, sendMessage } from './linkedinApi';
import crypto from 'crypto';

const router = Router();

const ENCRYPTION_KEY = process.env.SESSION_ENCRYPTION_KEY || 'wassel-session-key-2026-secure!!';

function decrypt(text: string): string {
  if (!text) return '';
  if (!text.includes(':')) return text;
  try {
    const [ivHex, encrypted] = text.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc',
      crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32), iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return text;
  }
}

// Helper: render template variables from prospect data
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

// Helper: validate LinkedIn profile matches stored prospect
function profileMatchesProspect(profileName: string, prospectName: string): boolean {
  if (!profileName || !prospectName) return true;
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z\u0600-\u06ff0-9]/g, '');
  const pn = normalize(profileName);
  const sn = normalize(prospectName);
  return pn.includes(sn) || sn.includes(pn) || pn === sn;
}

// Helper: get user's LinkedIn session
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

// Helper: get user's team_id
async function getUserTeamId(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('team_members')
    .select('team_id')
    .eq('user_id', userId)
    .single();
  return data?.team_id || null;
}

// POST /api/cloud/execute — Execute a single LinkedIn action
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

    // Extract profile slug
    const slugMatch = (targetUrl || '').match(/\/in\/([^/?]+)/);
    const slug = slugMatch ? slugMatch[1] : '';

    let result: any = { success: false, error: 'unknown_action' };

    // Random delay (2-5 seconds) to mimic human behavior
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
          result.profileName = profile.name;
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
    }

    // Log activity with team_id
    const teamId = await getUserTeamId(userId);
    await supabase.from('activity_logs').insert({
      user_id: userId,
      team_id: teamId,
      campaign_id: campaignId || null,
      action_type: actionType,
      status: result.success ? 'success' : 'failed',
      prospect_name: prospectName || result.profileName || slug,
      linkedin_url: targetUrl,
      error_message: result.error || null,
      executed_at: new Date().toISOString(),
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/cloud/campaign/:id/launch — Launch campaign (cron handles execution)
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

    // If no enrollment rows exist, auto-enroll all prospects in this campaign
    let pendingCount = existingCount || 0;
    if (!pendingCount) {
      const { data: prospects } = await supabase
        .from('prospects')
        .select('id')
        .eq('campaign_id', campaignId);

      if (!prospects || prospects.length === 0) {
        return res.status(400).json({ error: 'No prospects in this campaign' });
      }

      // Create prospect_step_status rows for each prospect × each step
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

      // Insert in chunks of 50
      for (let i = 0; i < statusRows.length; i += 50) {
        const chunk = statusRows.slice(i, i + 50);
        await supabase.from('prospect_step_status').insert(chunk);
      }

      pendingCount = statusRows.length;
      console.log(`[CloudLaunch] Auto-enrolled ${prospects.length} prospects × ${steps.length} steps = ${statusRows.length} rows`);
    }

    // Reset any stuck in_progress back to pending
    await supabase
      .from('prospect_step_status')
      .update({ status: 'pending' })
      .eq('campaign_id', campaignId)
      .eq('status', 'in_progress');

    // Update campaign status to active
    await supabase
      .from('campaigns')
      .update({ status: 'active', started_at: new Date().toISOString() })
      .eq('id', campaignId);

    // Log campaign launch activity
    const teamId = campaign.team_id || await getUserTeamId(userId);
    await supabase.from('activity_logs').insert({
      user_id: userId,
      team_id: teamId,
      campaign_id: campaignId,
      action_type: 'visit',
      status: 'success',
      prospect_name: `Campaign "${campaign.name}" launched`,
      executed_at: new Date().toISOString(),
    });

    // Return immediately — cron will handle execution every minute
    res.json({
      success: true,
      message: 'Campaign launched — cloud cron will process actions every minute',
      prospects: pendingCount,
      steps: steps?.length || 0,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/cloud/campaign/:id/tick — Process one pending step (client-driven)
// Frontend polls this every ~10s while campaign is active, since Vercel Hobby
// only allows daily cron. This is the real-time processing engine.
router.post('/campaign/:id/tick', async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Auth required' });

    const campaignId = req.params.id;

    const session = await getUserSession(userId);
    if (!session) return res.json({ processed: false, reason: 'no_session' });

    // Get campaign
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id, team_id, name, status')
      .eq('id', campaignId)
      .single();

    if (!campaign || campaign.status !== 'active') {
      return res.json({ processed: false, reason: 'not_active' });
    }

    // Get ONE pending prospect_step_status
    const now = new Date().toISOString();
    const { data: pendingSteps } = await supabase
      .from('prospect_step_status')
      .select(`
        id, prospect_id, step_id, status,
        campaign_steps!inner ( step_number, step_type, name, message_template ),
        prospects!inner ( linkedin_url, name, company )
      `)
      .eq('campaign_id', campaignId)
      .eq('status', 'pending')
      .or(`scheduled_at.is.null,scheduled_at.lte.${now}`)
      .order('created_at', { ascending: true })
      .limit(1);

    if (!pendingSteps?.length) {
      // Check if campaign is done
      const { count } = await supabase
        .from('prospect_step_status')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaignId)
        .in('status', ['pending', 'in_progress', 'waiting']);

      if (!count) {
        await supabase
          .from('campaigns')
          .update({ status: 'completed', completed_at: now })
          .eq('id', campaignId);
        return res.json({ processed: false, reason: 'campaign_completed' });
      }
      return res.json({ processed: false, reason: 'no_pending_steps' });
    }

    const pss = pendingSteps[0];
    const stepDef = (pss as any).campaign_steps;
    const prospect = (pss as any).prospects;

    if (!prospect?.linkedin_url) return res.json({ processed: false, reason: 'no_url' });

    const slug = prospect.linkedin_url.match(/\/in\/([^/?]+)/)?.[1];
    if (!slug) return res.json({ processed: false, reason: 'bad_url' });

    const actionType = stepDef.step_type === 'invitation' ? 'connect'
      : stepDef.step_type === 'message' ? 'message' : 'visit';

    // Mark as in_progress
    await supabase
      .from('prospect_step_status')
      .update({ status: 'in_progress' })
      .eq('id', pss.id);

    // Log in_progress for live UI
    await supabase.from('activity_logs').insert({
      user_id: userId,
      team_id: campaign.team_id,
      campaign_id: campaignId,
      action_type: actionType,
      status: 'in_progress',
      prospect_name: prospect.name || slug,
      linkedin_url: prospect.linkedin_url,
      executed_at: new Date().toISOString(),
    });

    let result: any = { success: false, error: 'unknown' };

    try {
      // Random delay to mimic human behavior
      await new Promise(r => setTimeout(r, 2000 + Math.random() * 3000));

      switch (actionType) {
        case 'visit':
          result = await visitProfile(session, slug);
          break;
        case 'connect': {
          const profile = await visitProfile(session, slug);
          if (profile.success && profile.profileId) {
            if (prospect.name && profile.name && !profileMatchesProspect(profile.name, prospect.name)) {
              result = { success: false, error: `identity_mismatch` };
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
              result = { success: false, error: `identity_mismatch` };
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
      .update({ status: finalStatus, executed_at: new Date().toISOString(), error_message: result.error || null })
      .eq('id', pss.id);

    // Log final status
    await supabase.from('activity_logs').insert({
      user_id: userId,
      team_id: campaign.team_id,
      campaign_id: campaignId,
      action_type: actionType,
      status: finalStatus,
      prospect_name: prospect.name || slug,
      linkedin_url: prospect.linkedin_url,
      error_message: result.error || null,
      executed_at: new Date().toISOString(),
    });

    // If success, unlock next step
    if (result.success) {
      const { data: nextStepDef } = await supabase
        .from('campaign_steps')
        .select('id, delay_days')
        .eq('campaign_id', campaignId)
        .eq('step_number', stepDef.step_number + 1)
        .single();

      if (nextStepDef) {
        const delayDays = nextStepDef.delay_days || 0;
        const scheduledAt = delayDays > 0
          ? new Date(Date.now() + delayDays * 86400000).toISOString()
          : new Date().toISOString();

        await supabase
          .from('prospect_step_status')
          .update({ status: 'pending', scheduled_at: scheduledAt })
          .eq('prospect_id', pss.prospect_id)
          .eq('campaign_id', campaignId)
          .eq('step_id', nextStepDef.id)
          .eq('status', 'waiting');
      }

      if (actionType === 'connect') {
        await supabase.from('prospects').update({ connection_status: 'pending' }).eq('id', pss.prospect_id);
      }
    }

    res.json({
      processed: true,
      prospect: prospect.name || slug,
      action: actionType,
      step: stepDef.step_number,
      success: result.success,
      error: result.error || null,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/cloud/session-check
router.get('/session-check', async (req, res) => {
  const userId = (req as any).user?.id;
  if (!userId) return res.json({ hasSession: false });

  const session = await getUserSession(userId);
  res.json({ hasSession: !!session });
});

export default router;
