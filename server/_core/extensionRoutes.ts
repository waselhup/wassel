import { Router, Request, Response } from 'express';
import { supabase } from '../supabase';

const router = Router();

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
        const teamId = getTeamId(req);
        if (!teamId) {
            return res.status(401).json({ error: 'No team associated with user' });
        }

        const { client_id, campaign_id, source_url, prospects } = req.body;

        console.log(`[Import] START client_id=${client_id ? client_id.substring(0, 8) + '...' : 'MISSING'} count=${prospects?.length || 0} source=${source_url || 'none'}`);

        if (!client_id || !prospects || !Array.isArray(prospects) || prospects.length === 0) {
            console.log(`[Import] VALIDATION_FAIL client_id=${!!client_id} prospects_is_array=${Array.isArray(prospects)} count=${prospects?.length || 0}`);
            return res.status(400).json({ error: 'client_id and prospects array required', detail: `client_id=${!!client_id}, prospects=${prospects?.length || 0}` });
        }

        // Verify client belongs to team
        const { data: client } = await supabase
            .from('clients')
            .select('id')
            .eq('id', client_id)
            .eq('team_id', teamId)
            .single();

        if (!client) {
            console.log(`[Import] CLIENT_NOT_FOUND client_id=${client_id.substring(0, 8)}... team_id=${teamId}`);
            return res.status(404).json({ error: 'Client not found in your team', detail: `client_id=${client_id}` });
        }

        // Prepare prospect records
        const prospectRecords = prospects.map((p: any) => ({
            team_id: teamId,
            client_id,
            campaign_id: campaign_id || null,
            linkedin_url: p.linkedin_url || p.linkedinUrl || '',
            name: p.name || null,
            title: p.title || null,
            company: p.company || null,
            location: p.location || null,
            source_url: source_url || null,
            status: 'imported',
        }));

        // Insert prospects
        const { data: inserted, error: insertError } = await supabase
            .from('prospects')
            .insert(prospectRecords)
            .select('id');

        if (insertError) {
            console.error(`[Import] INSERT_FAIL client_id=${client_id.substring(0, 8)}... error=`, insertError.message || insertError);
            return res.status(500).json({ error: 'Failed to import prospects', detail: insertError.message || 'Database insert error' });
        }

        const importedCount = inserted?.length || prospects.length;

        // Create import job record (non-fatal if fails)
        try {
            await supabase.from('prospect_import_jobs').insert({
                client_id,
                campaign_id: campaign_id || null,
                source_url: source_url || null,
                prospect_count: importedCount,
                status: 'completed',
            });
        } catch (jobErr: any) {
            console.warn(`[Import] JOB_RECORD_FAIL (non-fatal):`, jobErr.message);
        }

        console.log(`[Import] OK client_id=${client_id.substring(0, 8)}... imported=${importedCount}`);

        res.json({
            success: true,
            imported: importedCount,
            message: `${importedCount} prospects imported successfully`,
        });
    } catch (error: any) {
        console.error('[Import] FATAL:', error.message || error);
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
            .select('id, linkedin_url, name, title, company, location, source_url, status, created_at')
            .eq('team_id', teamId)
            .order('created_at', { ascending: false })
            .limit(100);

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

export default router;
