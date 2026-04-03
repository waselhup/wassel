import { Router } from 'express';
import { supabase } from '../supabase';
import { visitProfile, sendInvite, sendMessage } from './linkedinApi';
import crypto from 'crypto';

const router = Router();

const ENCRYPTION_KEY = process.env.SESSION_ENCRYPTION_KEY || 'wassel-session-key-2026-secure!!';

function decrypt(text: string): string {
  const [ivHex, encrypted] = text.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc',
    crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32), iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
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
  if (!profileName || !prospectName) return true; // can't validate, allow
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z\u0600-\u06ff0-9]/g, '');
  const pn = normalize(profileName);
  const sn = normalize(prospectName);
  // Accept if either name contains the other (handles partial names)
  return pn.includes(sn) || sn.includes(pn) || pn === sn;
}

// Helper: get user's LinkedIn session
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
        // First visit to get profileId
        const profile = await visitProfile(session, slug);
        if (profile.success && profile.profileId) {
          // Identity validation
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
          // Identity validation
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

    // Log activity
    await supabase.from('activity_logs').insert({
      user_id: userId,
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

// POST /api/cloud/campaign/:id/launch — Launch entire campaign
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

    // Get campaign with steps and prospects
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();

    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const { data: steps } = await supabase
      .from('campaign_steps')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('step_order', { ascending: true });

    const { data: campaignProspects } = await supabase
      .from('campaign_prospects')
      .select('*, prospect:prospects(*)')
      .eq('campaign_id', campaignId)
      .in('status', ['pending', 'in_progress']);

    if (!campaignProspects?.length) {
      return res.status(400).json({ error: 'No pending prospects' });
    }

    // Update campaign status
    await supabase
      .from('campaigns')
      .update({ status: 'active' })
      .eq('id', campaignId);

    // Execute in background (non-blocking)
    executeCampaignInBackground(userId, campaignId, steps || [], campaignProspects, session);

    res.json({ 
      success: true, 
      message: 'Campaign launched in cloud',
      prospects: campaignProspects.length,
      steps: steps?.length || 0,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Background execution function
async function executeCampaignInBackground(
  userId: string, 
  campaignId: string,
  steps: any[], 
  prospects: any[],
  session: any
) {
  const DAILY_LIMITS = { visit: 80, connect: 20, message: 30 };
  const counters = { visit: 0, connect: 0, message: 0 };

  for (const cp of prospects) {
    const prospect = cp.prospect;
    if (!prospect?.linkedin_url) continue;

    const slug = prospect.linkedin_url.match(/\/in\/([^/?]+)/)?.[1];
    if (!slug) continue;

    for (const step of steps) {
      const actionType = step.step_type === 'visit' ? 'visit' :
                        step.step_type === 'invite' ? 'connect' :
                        step.step_type === 'message' ? 'message' : null;
      if (!actionType) continue;

      // Check daily limits
      if (counters[actionType] >= DAILY_LIMITS[actionType]) {
        console.log(`[Cloud] Daily limit reached for ${actionType}`);
        continue;
      }

      // Random delay between actions (30-90 seconds)
      const delay = 30000 + Math.random() * 60000;
      await new Promise(r => setTimeout(r, delay));

      try {
        let result: any;

        switch (actionType) {
          case 'visit':
            result = await visitProfile(session, slug);
            break;
          case 'connect': {
            const profile = await visitProfile(session, slug);
            if (profile.success && profile.profileId) {
              // Identity validation
              if (prospect.name && profile.name && !profileMatchesProspect(profile.name, prospect.name)) {
                result = { success: false, error: `identity_mismatch: expected "${prospect.name}" but got "${profile.name}"` };
                break;
              }
              await new Promise(r => setTimeout(r, 2000 + Math.random() * 3000));
              const renderedNote = renderTemplate(step.message_template || '', prospect);
              result = await sendInvite(session, profile.profileId, renderedNote);
            } else {
              result = { success: false, error: 'profile_not_found' };
            }
            break;
          }
          case 'message': {
            const profile = await visitProfile(session, slug);
            if (profile.success && profile.profileId) {
              // Identity validation
              if (prospect.name && profile.name && !profileMatchesProspect(profile.name, prospect.name)) {
                result = { success: false, error: `identity_mismatch: expected "${prospect.name}" but got "${profile.name}"` };
                break;
              }
              const urn = `urn:li:fsd_profile:${profile.profileId}`;
              await new Promise(r => setTimeout(r, 2000 + Math.random() * 3000));
              const renderedMsg = renderTemplate(step.message_template || '', prospect);
              result = await sendMessage(session, urn, renderedMsg);
            } else {
              result = { success: false, error: 'profile_not_found' };
            }
            break;
          }
        }

        counters[actionType]++;

        // Log activity
        await supabase.from('activity_logs').insert({
          user_id: userId,
          campaign_id: campaignId,
          action_type: actionType,
          status: result?.success ? 'success' : 'failed',
          prospect_name: prospect.name || slug,
          linkedin_url: prospect.linkedin_url,
          error_message: result?.error || null,
        });

        // Update prospect status
        await supabase
          .from('campaign_prospects')
          .update({ 
            status: result?.success ? 'completed' : 'failed',
            [`${step.step_type}_completed_at`]: new Date().toISOString(),
          })
          .eq('id', cp.id);

      } catch (err: any) {
        console.error(`[Cloud] Action failed:`, err.message);
      }
    }
  }

  // Campaign complete
  await supabase
    .from('campaigns')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', campaignId);
}

// GET /api/cloud/session-check
router.get('/session-check', async (req, res) => {
  const userId = (req as any).user?.id;
  if (!userId) return res.json({ hasSession: false });

  const session = await getUserSession(userId);
  res.json({ hasSession: !!session });
});

export default router;
