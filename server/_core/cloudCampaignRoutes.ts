/**
 * Cloud Campaign Routes — Execute LinkedIn actions via Voyager API.
 * No extension needed. Uses stored li_at/JSESSIONID cookies.
 */
import { Router, Request, Response } from 'express';
import { supabase } from '../supabase';
import { decrypt } from './encryption';
import { visitProfile, sendInvite, sendMessage, publishPost, type LinkedInSession } from './linkedinApi';

const router = Router();

// ─── Helper: get user's decrypted LinkedIn session ─────────────
async function getUserSession(userId: string): Promise<LinkedInSession | null> {
  const { data } = await supabase
    .from('linkedin_sessions')
    .select('li_at, jsessionid, status, expires_at')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();

  if (!data || !data.li_at) return null;

  // Check expiry
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    await supabase
      .from('linkedin_sessions')
      .update({ status: 'expired' })
      .eq('user_id', userId);
    return null;
  }

  try {
    return {
      liAt: decrypt(data.li_at),
      jsessionId: data.jsessionid ? decrypt(data.jsessionid) : '',
    };
  } catch (err: any) {
    console.error('[Cloud] Decrypt failed:', err.message);
    return null;
  }
}

function getUserId(req: Request): string | null {
  return (req as any).user?.id || null;
}

function getTeamId(req: Request): string | null {
  return (req as any).user?.teamId || null;
}

// ─── GET /session-check ───────────────────────────────────────
router.get('/session-check', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.json({ hasSession: false });

  const session = await getUserSession(userId);
  res.json({ hasSession: !!session });
});

// ─── POST /execute — single LinkedIn action ──────────────────
router.post('/execute', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Auth required' });

    const { actionType, targetUrl, message, campaignId, prospectName } = req.body;

    const session = await getUserSession(userId);
    if (!session) {
      return res.status(400).json({
        error: 'No LinkedIn session. Open LinkedIn and reload the extension to sync cookies.',
      });
    }

    // Extract profile slug from URL
    const slugMatch = (targetUrl || '').match(/\/in\/([^/?#]+)/);
    const slug = slugMatch ? slugMatch[1] : '';

    let result: { success: boolean; error?: string; profileName?: string } = {
      success: false,
      error: 'unknown_action',
    };

    // Human-like delay before action
    await new Promise(r => setTimeout(r, 2000 + Math.random() * 3000));

    switch (actionType) {
      case 'visit': {
        result = await visitProfile(session, slug);
        break;
      }
      case 'connect': {
        // Visit first to get profileId
        const profile = await visitProfile(session, slug);
        if (profile.success && profile.profileId) {
          await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));
          const inviteResult = await sendInvite(session, profile.profileId, message || undefined);
          result = { ...inviteResult, profileName: profile.name };
        } else {
          result = { success: false, error: `Profile not found: ${slug}` };
        }
        break;
      }
      case 'message': {
        const profile = await visitProfile(session, slug);
        if (profile.success && profile.profileId) {
          const profileUrn = `urn:li:fsd_profile:${profile.profileId}`;
          await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));
          result = await sendMessage(session, profileUrn, message || '');
        } else {
          result = { success: false, error: `Profile not found: ${slug}` };
        }
        break;
      }
      case 'post': {
        // For posts, we need the author URN — visit own profile or use stored one
        // For now, use a generic approach
        const postResult = await publishPost(session, message || '', '');
        result = postResult;
        break;
      }
    }

    // Log activity
    try {
      await supabase.from('activity_logs').insert({
        user_id: userId,
        team_id: getTeamId(req),
        campaign_id: campaignId || null,
        action_type: actionType,
        status: result.success ? 'success' : 'failed',
        prospect_name: prospectName || result.profileName || slug,
        linkedin_url: targetUrl || null,
        error_message: result.error || null,
        executed_at: new Date().toISOString(),
      });
    } catch (logErr: any) {
      console.error('[Cloud] Activity log failed:', logErr.message);
    }

    res.json(result);
  } catch (err: any) {
    console.error('[Cloud] Execute error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /campaign/:id/launch — launch entire campaign ──────
router.post('/campaign/:id/launch', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Auth required' });

    const campaignId = req.params.id;

    // Check session
    const session = await getUserSession(userId);
    if (!session) {
      return res.status(400).json({ error: 'No LinkedIn session. Open LinkedIn and reload the extension.' });
    }

    // Get campaign
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();

    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    // Get steps
    const { data: steps } = await supabase
      .from('campaign_steps')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('step_order', { ascending: true });

    // Get pending prospects
    const { data: campaignProspects } = await supabase
      .from('campaign_prospects')
      .select('*, prospect:prospects(*)')
      .eq('campaign_id', campaignId)
      .in('status', ['pending', 'in_progress']);

    if (!campaignProspects?.length) {
      return res.status(400).json({ error: 'No pending prospects in this campaign' });
    }

    // Update campaign status
    await supabase
      .from('campaigns')
      .update({ status: 'active' })
      .eq('id', campaignId);

    // Execute in background (non-blocking response)
    executeCampaignInBackground(userId, getTeamId(req), campaignId, steps || [], campaignProspects, session);

    res.json({
      success: true,
      message: 'Campaign launched in cloud',
      prospects: campaignProspects.length,
      steps: steps?.length || 0,
    });
  } catch (err: any) {
    console.error('[Cloud] Campaign launch error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Background campaign execution ───────────────────────────
async function executeCampaignInBackground(
  userId: string,
  teamId: string | null,
  campaignId: string,
  steps: any[],
  prospects: any[],
  session: LinkedInSession
) {
  const DAILY_LIMITS: Record<string, number> = { visit: 80, connect: 20, message: 30 };
  const counters: Record<string, number> = { visit: 0, connect: 0, message: 0 };

  console.log(`[Cloud] Campaign ${campaignId}: processing ${prospects.length} prospects, ${steps.length} steps`);

  for (const cp of prospects) {
    const prospect = cp.prospect;
    if (!prospect?.linkedin_url) continue;

    const slug = prospect.linkedin_url.match(/\/in\/([^/?#]+)/)?.[1];
    if (!slug) continue;

    for (const step of steps) {
      const actionType =
        step.step_type === 'visit' ? 'visit' :
        step.step_type === 'invite' ? 'connect' :
        step.step_type === 'connect' ? 'connect' :
        step.step_type === 'message' ? 'message' : null;

      if (!actionType) continue;

      // Check daily limits
      if (counters[actionType] >= DAILY_LIMITS[actionType]) {
        console.log(`[Cloud] Daily limit reached for ${actionType}, skipping`);
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
              await new Promise(r => setTimeout(r, 2000 + Math.random() * 3000));
              result = await sendInvite(session, profile.profileId, step.message_template || undefined);
            } else {
              result = { success: false, error: 'profile_not_found' };
            }
            break;
          }
          case 'message': {
            const profile = await visitProfile(session, slug);
            if (profile.success && profile.profileId) {
              const urn = `urn:li:fsd_profile:${profile.profileId}`;
              await new Promise(r => setTimeout(r, 2000 + Math.random() * 3000));
              result = await sendMessage(session, urn, step.message_template || '');
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
          team_id: teamId,
          campaign_id: campaignId,
          action_type: actionType,
          status: result?.success ? 'success' : 'failed',
          prospect_name: prospect.name || slug,
          linkedin_url: prospect.linkedin_url,
          error_message: result?.error || null,
          executed_at: new Date().toISOString(),
        });

        // Update prospect status
        await supabase
          .from('campaign_prospects')
          .update({
            status: result?.success ? 'completed' : 'failed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', cp.id);

        console.log(`[Cloud] ${actionType} ${slug}: ${result?.success ? 'OK' : result?.error}`);
      } catch (err: any) {
        console.error(`[Cloud] Action failed for ${slug}:`, err.message);
      }
    }
  }

  // Mark campaign completed
  await supabase
    .from('campaigns')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', campaignId);

  console.log(`[Cloud] Campaign ${campaignId} completed`);
}

export default router;
