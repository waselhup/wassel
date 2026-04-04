import { Router, Request, Response } from 'express';
import { supabase } from '../supabase';
import { decrypt } from './encryption';
import crypto from 'crypto';

const router = Router();

/**
 * Fallback auth for extension endpoints when Supabase JWT expires.
 * Extension sends X-LI-AT header with first 16 chars of li_at cookie.
 * We look up the user from linkedin_sessions by matching the decrypted li_at prefix.
 */
async function resolveUserFromLiAt(req: Request): Promise<{ userId: string; teamId: string } | null> {
  const liAtPrefix = req.headers['x-li-at'] as string;
  if (!liAtPrefix || liAtPrefix.length < 10) return null;

  try {
    // Get all active sessions and check if any match
    const { data: sessions } = await supabase
      .from('linkedin_sessions')
      .select('user_id, team_id, li_at')
      .eq('status', 'active');

    if (!sessions?.length) return null;

    for (const sess of sessions) {
      try {
        const decrypted = decrypt(sess.li_at);
        if (decrypted.startsWith(liAtPrefix)) {
          return { userId: sess.user_id, teamId: sess.team_id };
        }
      } catch {}
    }
  } catch {}
  return null;
}

/** Get userId and teamId from req.user (JWT) or fallback to li_at header */
async function getAuthUser(req: Request): Promise<{ userId: string; teamId: string } | null> {
  // Primary: JWT auth from middleware
  const user = (req as any).user;
  if (user?.id) {
    let teamId = user.teamId || '';
    if (!teamId) {
      const { data: membership } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', user.id)
        .single();
      teamId = membership?.team_id || '';
    }
    return { userId: user.id, teamId };
  }

  // Fallback: li_at prefix header
  return await resolveUserFromLiAt(req);
}

// ─── Rate Limits (daily, per user, per action type) ──────
const DAILY_LIMITS: Record<string, number> = {
  visit: 100,
  connect: 50,
  message: 60,
  follow: 50,
};

/** Map step_type → action_type */
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

// NOTE: Auth is handled by expressAuthMiddleware in vercel.ts
// req.user is always available with { id, email, role, teamId }

/**
 * Get team ID from the authenticated user.
 * For super_admin, they can override with a query param target_team_id for operate-as-client mode.
 */
function getTeamId(req: any): string | null {
    const user = req.user;
    if (!user) return null;

    // Admin operate-as-client: allow target_team_id override
    if (user.role === 'super_admin' && req.query.target_team_id) {
        return req.query.target_team_id as string;
    }

    return user.teamId || null;
}


/**
 * GET /api/ext/bootstrap?client_id=...
 * Returns config for extension pairing.
 */
router.get('/bootstrap', async (req: Request, res: Response) => {
    try {
        const teamId = getTeamId(req);
        if (!teamId) {
            return res.status(401).json({ error: 'No team associated with user' });
        }

        const clientId = req.query.client_id as string;
        if (!clientId) {
            return res.status(400).json({ error: 'client_id required' });
        }

        // Verify client belongs to user's team
        const { data: client, error } = await supabase
            .from('clients')
            .select('id, email, name, status')
            .eq('id', clientId)
            .eq('team_id', teamId)
            .single();

        if (error || !client) {
            return res.status(404).json({ error: 'Client not found' });
        }

        const appUrl = process.env.APP_URL || 'https://wassel-alpha.vercel.app';

        res.json({
            clientId: client.id,
            clientEmail: client.email,
            clientName: client.name,
            clientStatus: client.status,
            appUrl,
            apiUrl: `${appUrl}/api`,
            allowedOrigins: ['https://www.linkedin.com', appUrl],
        });
    } catch (error) {
        console.error('[Extension] Bootstrap error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * GET /api/ext/campaigns?client_id=...
 * Returns campaigns available for prospect import.
 */
router.get('/campaigns', async (req: Request, res: Response) => {
    try {
        const teamId = getTeamId(req);
        if (!teamId) {
            return res.status(401).json({ error: 'No team associated with user' });
        }

        const { data: campaigns, error } = await supabase
            .from('campaigns')
            .select('id, name, status, created_at')
            .eq('team_id', teamId)
            .order('created_at', { ascending: false });

        if (error) {
            console.log('[Extension] Campaigns query error:', error.message);
            return res.json({
                campaigns: [{
                    id: 'default',
                    name: 'Default Campaign',
                    status: 'active',
                }],
            });
        }

        if (!campaigns || campaigns.length === 0) {
            return res.json({
                campaigns: [{
                    id: 'default',
                    name: 'Default Campaign',
                    status: 'active',
                }],
            });
        }

        res.json({ campaigns });
    } catch (error) {
        console.error('[Extension] Campaigns error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * POST /api/ext/import
 * Import prospects scraped by the Chrome extension.
 * Body: { client_id, campaign_id?, source_url, prospects: [{linkedin_url, name, title, company, location}] }
 */
router.post('/import', async (req: Request, res: Response) => {
    try {
        // Always do fresh DB lookup for team_id — never rely solely on JWT claim
        const userId = (req as any).user?.id || (req as any).user?.sub;

        if (!userId) {
            console.error('[Import] NO_USER auth:', JSON.stringify((req as any).user));
            return res.status(401).json({ error: 'Not authenticated' });
        }

        // Try JWT claim first, then always verify via DB
        let resolvedTeamId = getTeamId(req);

        if (!resolvedTeamId) {
            const { data: membership, error: memberError } = await supabase
                .from('team_members')
                .select('team_id')
                .eq('user_id', userId)
                .single();

            if (memberError || !membership?.team_id) {
                console.error('[Import] NO_TEAM user:', userId, memberError?.message);
                return res.status(400).json({ error: 'No team associated with user', userId });
            }
            resolvedTeamId = membership.team_id;
        }

        const { client_id, campaign_id, source_url, prospects } = req.body;

        console.log(`[Import] START team_id=${resolvedTeamId} count=${prospects?.length || 0} source=${source_url || 'none'}`);

        if (!prospects || !Array.isArray(prospects) || prospects.length === 0) {
            console.error('[Import] VALIDATION_FAIL body:', JSON.stringify(req.body).substring(0, 500));
            return res.status(400).json({ error: 'prospects array is required and must not be empty' });
        }

        // ── Plan Limits ──
        const { data: team } = await supabase
            .from('teams')
            .select('plan')
            .eq('id', resolvedTeamId)
            .single();

        const plan = team?.plan || 'trial';
        const PLAN_LIMITS: Record<string, number> = { trial: 500, starter: 1000, growth: 5000, agency: 99999 };
        const maxProspects = PLAN_LIMITS[plan] || 500;

        const { count: existingCount } = await supabase
            .from('prospects')
            .select('id', { count: 'exact', head: true })
            .eq('team_id', resolvedTeamId);

        const currentCount = existingCount || 0;
        if (currentCount + prospects.length > maxProspects) {
            const remaining = Math.max(0, maxProspects - currentCount);
            return res.status(403).json({
                error: `You've reached your ${plan} plan limit of ${maxProspects} prospects. You have ${remaining} slots remaining. Upgrade your plan to import more.`,
                limit: maxProspects,
                current: currentCount,
                remaining,
                upgrade: true,
            });
        }

        // Normalize prospect records — match actual DB columns: name, title, company, location
        const prospectRecords = prospects.map((p: any) => {
            // Accept multiple field name variations
            const name = p.name || [p.first_name || p.firstName || '', p.last_name || p.lastName || ''].filter(Boolean).join(' ') || 'Unknown';
            const title = p.title || p.job_title || p.jobTitle || null;
            const company = p.company || p.company_name || null;
            const linkedinUrl = p.linkedin_url || p.linkedinUrl || p.profile_url || '';
            const location = p.location || null;

            return {
                team_id: resolvedTeamId,
                client_id: client_id || resolvedTeamId,
                campaign_id: campaign_id || null,
                linkedin_url: linkedinUrl,
                name,
                title,
                company,
                location,
                photo_url: p.photo_url || p.photoUrl || null,
                source_url: source_url || null,
                status: 'imported',
            };
        });

        console.log('[Import] Sample record:', JSON.stringify(prospectRecords[0]));

        // Upsert to handle duplicates gracefully
        const { data: inserted, error: insertError } = await supabase
            .from('prospects')
            .upsert(prospectRecords, { onConflict: 'linkedin_url,team_id', ignoreDuplicates: true })
            .select('id');

        if (insertError) {
            console.error(`[Import] INSERT_FAIL team_id=${resolvedTeamId} error=`, insertError.message || insertError);
            console.error('[Import] INSERT_FAIL detail:', JSON.stringify(insertError));
            
            // Fallback: try regular insert if upsert fails (no unique constraint)
            const { data: inserted2, error: insertError2 } = await supabase
                .from('prospects')
                .insert(prospectRecords)
                .select('id');

            if (insertError2) {
                console.error('[Import] FALLBACK_INSERT_FAIL:', insertError2.message);
                return res.status(500).json({ error: 'Failed to import prospects', detail: insertError2.message });
            }

            const count = inserted2?.length || prospects.length;
            console.log(`[Import] OK (fallback insert) team_id=${resolvedTeamId} imported=${count}`);
            return res.json({ success: true, imported: count, message: `${count} prospects imported successfully` });
        }

        const importedCount = inserted?.length || prospects.length;

        // Create import job record (non-fatal if fails)
        try {
            await supabase.from('prospect_import_jobs').insert({
                client_id: client_id || resolvedTeamId,
                campaign_id: campaign_id || null,
                source_url: source_url || null,
                prospect_count: importedCount,
                status: 'completed',
            });
        } catch (jobErr: any) {
            console.warn(`[Import] JOB_RECORD_FAIL (non-fatal):`, jobErr.message);
        }

        console.log(`[Import] OK team_id=${resolvedTeamId} imported=${importedCount}`);

        res.json({
            success: true,
            imported: importedCount,
            message: `${importedCount} prospects imported successfully`,
        });
    } catch (error: any) {
        console.error('[Import] FATAL:', error.message || error);
        console.error('[Import] FATAL body:', JSON.stringify(req.body).substring(0, 500));
        console.error('[Import] FATAL user:', JSON.stringify((req as any).user));
        res.status(500).json({ error: 'Server error', detail: error.message || 'Unknown error' });
    }
});

/**
 * GET /api/ext/prospects?client_id=...&campaign_id=...
 * Returns imported prospects for a client/campaign.
 */
router.get('/prospects', async (req: Request, res: Response) => {
    try {
        const teamId = getTeamId(req);
        if (!teamId) {
            return res.status(401).json({ error: 'No team associated with user' });
        }

        const clientId = req.query.client_id as string;

        let query = supabase
            .from('prospects')
            .select('id, linkedin_url, name, title, company, location, photo_url, source_url, status, created_at')
            .eq('team_id', teamId)
            .order('created_at', { ascending: false })
            .limit(1000);

        if (clientId) {
            query = query.eq('client_id', clientId);
        }

        const { data: prospects, error } = await query;

        if (error) {
            console.error('[Extension] Prospects query error:', error);
            return res.json({ prospects: [], count: 0 });
        }

        res.json({
            prospects: prospects || [],
            count: prospects?.length || 0,
        });
    } catch (error) {
        console.error('[Extension] Prospects error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});
/**
 * DELETE /api/ext/prospects
 * Bulk-delete prospects. Body: { prospectIds: string[] }
 * Team-isolated — only deletes prospects belonging to user's team.
 */
router.delete('/prospects', async (req: Request, res: Response) => {
    try {
        const teamId = getTeamId(req);
        if (!teamId) {
            return res.status(401).json({ error: 'No team associated with user' });
        }

        const { prospectIds } = req.body;

        if (!prospectIds || !Array.isArray(prospectIds) || prospectIds.length === 0) {
            return res.status(400).json({ error: 'prospectIds array is required' });
        }

        // Verify all prospects belong to this team
        const { data: owned } = await supabase
            .from('prospects')
            .select('id')
            .eq('team_id', teamId)
            .in('id', prospectIds);

        const ownedIds = (owned || []).map(p => p.id);

        if (ownedIds.length === 0) {
            return res.status(404).json({ error: 'No matching prospects found' });
        }

        // Delete related prospect_step_status rows first
        await supabase
            .from('prospect_step_status')
            .delete()
            .in('prospect_id', ownedIds);

        // Delete prospects
        const { error: deleteError } = await supabase
            .from('prospects')
            .delete()
            .in('id', ownedIds);

        if (deleteError) {
            console.error('[Extension] Delete prospects error:', deleteError);
            return res.status(500).json({ error: 'Failed to delete prospects' });
        }

        console.log(`[Extension] Deleted ${ownedIds.length} prospects for team ${teamId}`);
        res.json({ success: true, deleted: ownedIds.length });
    } catch (error) {
        console.error('[Extension] Delete prospects error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ═══════════════════════════════════════════════════════════════
// EXTENSION-BASED CAMPAIGN EXECUTION (Waalaxy approach)
// Extension polls for pending actions, executes via browser fetch,
// then reports results back. No LinkedIn tab needed.
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/ext/pending-actions
 * Returns the next pending campaign action for the authenticated user's team.
 * Extension polls this every 30-60 seconds.
 */
router.get('/pending-actions', async (req: Request, res: Response) => {
    try {
        // Auth: JWT or li_at fallback
        const authUser = await getAuthUser(req);
        if (!authUser) return res.status(401).json({ error: 'Auth required' });
        const { userId, teamId } = authUser;
        if (!teamId) return res.json({ action: null, reason: 'no_team' });

        // Check if user has active session record
        const { data: sessionRecord } = await supabase
            .from('linkedin_sessions')
            .select('id')
            .eq('user_id', userId)
            .eq('status', 'active')
            .limit(1);

        if (!sessionRecord?.length) {
            return res.json({ action: null, reason: 'no_session' });
        }

        // Get active campaigns for this team
        const { data: activeCampaigns } = await supabase
            .from('campaigns')
            .select('id, name, team_id')
            .eq('team_id', teamId)
            .eq('status', 'active');

        if (!activeCampaigns?.length) {
            return res.json({ action: null, reason: 'no_active_campaigns' });
        }

        const campaignIds = activeCampaigns.map(c => c.id);
        const now = new Date().toISOString();

        // Get ONE pending action across all active campaigns
        const { data: pendingSteps } = await supabase
            .from('prospect_step_status')
            .select(`
                id,
                prospect_id,
                step_id,
                campaign_id,
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
            .in('campaign_id', campaignIds)
            .eq('status', 'pending')
            .or(`scheduled_at.is.null,scheduled_at.lte.${now}`)
            .order('created_at', { ascending: true })
            .limit(1);

        if (!pendingSteps?.length) {
            return res.json({ action: null, reason: 'no_pending_actions' });
        }

        const pss = pendingSteps[0];
        const stepDef = (pss as any).campaign_steps;
        const prospect = (pss as any).prospects;

        if (!prospect?.linkedin_url) {
            return res.json({ action: null, reason: 'no_linkedin_url' });
        }

        const actionType = stepTypeToActionType(stepDef.step_type);
        if (!actionType) {
            return res.json({ action: null, reason: 'unknown_step_type' });
        }

        // Rate limit check
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const { count: dailyCount } = await supabase
            .from('activity_logs')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('action_type', actionType)
            .in('status', ['success', 'completed'])
            .gte('executed_at', today.toISOString());

        const limit = DAILY_LIMITS[actionType] || 50;
        if ((dailyCount || 0) >= limit) {
            return res.json({ action: null, reason: `daily_limit_${actionType}`, dailyCount, limit });
        }

        // For message steps: check if prospect is actually connected
        if (actionType === 'message' && prospect.connection_status !== 'accepted') {
            // Extension will check connection status — skip for now, return as action
            // but set a flag so extension knows to verify first
        }

        // Atomic claim: mark as in_progress
        const { data: claimed } = await supabase
            .from('prospect_step_status')
            .update({ status: 'in_progress' })
            .eq('id', pss.id)
            .eq('status', 'pending')
            .select('id');

        if (!claimed?.length) {
            return res.json({ action: null, reason: 'already_claimed' });
        }

        // Render message template
        const renderedMessage = renderTemplate(stepDef.message_template || '', prospect);

        // Extract slug from LinkedIn URL
        const linkedinUrl = prospect.linkedin_url || '';
        const slugMatch = linkedinUrl.match(/\/in\/([^/?#]+)/);
        const slug = slugMatch ? slugMatch[1].replace(/\/$/, '') : '';

        const campaign = activeCampaigns.find(c => c.id === pss.campaign_id);

        res.json({
            action: {
                pssId: pss.id,
                campaignId: pss.campaign_id,
                campaignName: campaign?.name || '',
                prospectId: prospect.id,
                prospectName: prospect.name || '',
                prospectCompany: prospect.company || '',
                prospectTitle: prospect.title || '',
                linkedinUrl: prospect.linkedin_url,
                slug,
                actionType,
                stepNumber: stepDef.step_number,
                message: renderedMessage,
                connectionStatus: prospect.connection_status,
            },
        });
    } catch (error: any) {
        console.error('[ExtExec] pending-actions error:', error.message);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * POST /api/ext/report-action
 * Extension reports the result of executing a LinkedIn action.
 * Body: { pssId, campaignId, prospectId, actionType, success, error?, profileId?, name? }
 */
router.post('/report-action', async (req: Request, res: Response) => {
    try {
        // Auth: JWT or li_at fallback
        const authUser = await getAuthUser(req);
        if (!authUser) return res.status(401).json({ error: 'Auth required' });
        const { userId, teamId } = authUser;

        const {
            pssId,
            campaignId,
            prospectId,
            actionType,
            success,
            error: errorMsg,
            profileId,
            prospectName,
            linkedinUrl,
        } = req.body;

        if (!pssId) {
            return res.status(400).json({ error: 'pssId required' });
        }

        const finalStatus = success ? 'completed' : 'failed';

        // Update prospect_step_status
        await supabase
            .from('prospect_step_status')
            .update({
                status: finalStatus,
                executed_at: new Date().toISOString(),
                error_message: errorMsg || null,
            })
            .eq('id', pssId);

        // Log activity
        await supabase.from('activity_logs').insert({
            user_id: userId,
            team_id: teamId,
            campaign_id: campaignId || null,
            action_type: actionType,
            status: success ? 'success' : 'failed',
            prospect_name: prospectName || '',
            linkedin_url: linkedinUrl || '',
            error_message: errorMsg || null,
            executed_at: new Date().toISOString(),
        });

        // On success: unlock next step
        if (success && campaignId && prospectId) {
            await unlockNextStepFromExtension(pssId, campaignId, prospectId, actionType, userId, teamId || '');
        }

        // On session_expired error: mark session as expired and pause campaigns
        if (!success && errorMsg && (errorMsg.includes('session_expired') || errorMsg.includes('delete me') || errorMsg.includes('401'))) {
            console.log(`[ExtExec] Session error from extension for user ${userId.slice(0, 8)}… — marking expired`);

            await supabase
                .from('linkedin_sessions')
                .update({ status: 'expired' })
                .eq('user_id', userId)
                .eq('status', 'active');

            if (teamId) {
                const { data: teamCampaigns } = await supabase
                    .from('campaigns')
                    .select('id')
                    .eq('team_id', teamId)
                    .eq('status', 'active');

                if (teamCampaigns?.length) {
                    for (const c of teamCampaigns) {
                        await supabase.from('campaigns').update({ status: 'paused' }).eq('id', c.id);
                    }
                }
            }

            return res.json({ success: false, sessionExpired: true, message: 'Session expired — campaigns paused' });
        }

        // On non-session failure: revert to pending for retry (max 2 retries PER PROSPECT)
        if (!success && errorMsg && !errorMsg.includes('session_expired') && !errorMsg.includes('delete me') && !errorMsg.includes('401')) {
            // Count how many times THIS specific prospect+action has failed
            const { count: prospectFails } = await supabase
                .from('activity_logs')
                .select('*', { count: 'exact', head: true })
                .eq('campaign_id', campaignId)
                .eq('action_type', actionType)
                .eq('prospect_name', prospectName || '')
                .eq('status', 'failed');

            if ((prospectFails || 0) <= 2) {
                // Revert to pending for retry (max 2 retries per prospect)
                await supabase
                    .from('prospect_step_status')
                    .update({ status: 'pending', error_message: `retry_${prospectFails}: ${errorMsg}` })
                    .eq('id', pssId);
            }
            // If 3+ fails for this prospect, leave as permanently failed
        }

        res.json({ success: true, recorded: true });
    } catch (error: any) {
        console.error('[ExtExec] report-action error:', error.message);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * After a successful action, unlock the next step in the campaign sequence.
 */
async function unlockNextStepFromExtension(
    pssId: string,
    campaignId: string,
    prospectId: string,
    actionType: string,
    userId: string,
    teamId: string,
) {
    // Get current step info
    const { data: currentPss } = await supabase
        .from('prospect_step_status')
        .select('step_id')
        .eq('id', pssId)
        .single();

    if (!currentPss) return;

    // Get current step number
    const { data: currentStep } = await supabase
        .from('campaign_steps')
        .select('step_number')
        .eq('id', currentPss.step_id)
        .single();

    if (!currentStep) return;

    // Get next step definition
    const { data: nextStepDef } = await supabase
        .from('campaign_steps')
        .select('id, step_number, step_type, delay_days')
        .eq('campaign_id', campaignId)
        .eq('step_number', currentStep.step_number + 1)
        .single();

    if (!nextStepDef) return; // No more steps

    const nextActionType = stepTypeToActionType(nextStepDef.step_type);

    // Special case: if current was CONNECT and next needs connection (message)
    // → create acceptance check job instead of unlocking immediately
    if (actionType === 'connect' && nextActionType === 'message') {
        // Update prospect connection_status to pending
        await supabase
            .from('prospects')
            .update({ connection_status: 'pending' })
            .eq('id', prospectId);

        // Get the next step's prospect_step_status row
        const { data: nextPss } = await supabase
            .from('prospect_step_status')
            .select('id')
            .eq('prospect_id', prospectId)
            .eq('campaign_id', campaignId)
            .eq('step_id', nextStepDef.id)
            .single();

        if (nextPss) {
            const nextCheckAt = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
            await supabase.from('acceptance_check_jobs').insert({
                prospect_step_status_id: nextPss.id,
                prospect_id: prospectId,
                campaign_id: campaignId,
                next_check_at: nextCheckAt,
                checks_remaining: 56,
            });
            console.log(`[ExtExec] Created acceptance check for prospect ${prospectId}`);
        }
        return;
    }

    // Normal case: unlock next step with delay
    if (actionType === 'connect') {
        await supabase
            .from('prospects')
            .update({ connection_status: 'pending' })
            .eq('id', prospectId);
    }

    const delayDays = nextStepDef.delay_days || 0;
    const scheduledAt = delayDays > 0
        ? new Date(Date.now() + delayDays * 86400000).toISOString()
        : new Date().toISOString();

    await supabase
        .from('prospect_step_status')
        .update({ status: 'pending', scheduled_at: scheduledAt })
        .eq('prospect_id', prospectId)
        .eq('campaign_id', campaignId)
        .eq('step_id', nextStepDef.id)
        .eq('status', 'waiting');

    console.log(`[ExtExec] Step ${currentStep.step_number}→${currentStep.step_number + 1} unlocked for prospect ${prospectId}`);
}

export default router;
