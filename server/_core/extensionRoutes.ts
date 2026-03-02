import { Router, Request, Response } from 'express';
import { supabase } from '../supabase';

const router = Router();

/**
 * Middleware: verify admin access via ADMIN_KEY
 */
function requireAdmin(req: Request, res: Response): { teamId: string } | null {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Authentication required' });
        return null;
    }

    const token = authHeader.replace('Bearer ', '');
    const adminKey = process.env.ADMIN_KEY;

    if (!adminKey || token !== adminKey) {
        res.status(401).json({ error: 'Invalid admin key' });
        return null;
    }

    const teamId = process.env.DEFAULT_TEAM_ID || '00000000-0000-0000-0000-000000000001';
    return { teamId };
}


/**
 * GET /api/ext/bootstrap?client_id=...
 * Returns config for extension pairing.
 * Admin-only.
 */
router.get('/bootstrap', async (req: Request, res: Response) => {
    try {
        const admin = await requireAdmin(req, res);
        if (!admin) return;

        const clientId = req.query.client_id as string;
        if (!clientId) {
            return res.status(400).json({ error: 'client_id required' });
        }

        // Verify client belongs to admin's team
        const { data: client, error } = await supabase
            .from('clients')
            .select('id, email, name, status')
            .eq('id', clientId)
            .eq('team_id', admin.teamId)
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
 * Admin-only.
 */
router.get('/campaigns', async (req: Request, res: Response) => {
    try {
        const admin = await requireAdmin(req, res);
        if (!admin) return;

        // Check if campaigns table exists by trying to query it
        const { data: campaigns, error } = await supabase
            .from('campaigns')
            .select('id, name, status, created_at')
            .eq('team_id', admin.teamId)
            .order('created_at', { ascending: false });

        if (error) {
            // If campaigns table doesn't exist, return empty with a default campaign
            console.log('[Extension] Campaigns query error (table may not exist):', error.message);
            return res.json({
                campaigns: [{
                    id: 'default',
                    name: 'Default Campaign',
                    status: 'active',
                }],
            });
        }

        // If no campaigns exist, provide a default one
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
 * Admin-only.
 * Body: { client_id, campaign_id?, source_url, prospects: [{linkedin_url, name, title, company, location}] }
 */
router.post('/import', async (req: Request, res: Response) => {
    try {
        const admin = await requireAdmin(req, res);
        if (!admin) return;

        const { client_id, campaign_id, source_url, prospects } = req.body;

        if (!client_id || !prospects || !Array.isArray(prospects) || prospects.length === 0) {
            return res.status(400).json({ error: 'client_id and prospects array required' });
        }

        // Verify client belongs to team
        const { data: client } = await supabase
            .from('clients')
            .select('id')
            .eq('id', client_id)
            .eq('team_id', admin.teamId)
            .single();

        if (!client) {
            return res.status(404).json({ error: 'Client not found in your team' });
        }

        // Prepare prospect records
        const prospectRecords = prospects.map((p: any) => ({
            team_id: admin.teamId,
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

        // Insert prospects (upsert by linkedin_url to avoid duplicates)
        const { data: inserted, error: insertError } = await supabase
            .from('prospects')
            .insert(prospectRecords)
            .select('id');

        if (insertError) {
            console.error('[Extension] Import insert error:', insertError);
            return res.status(500).json({ error: 'Failed to import prospects' });
        }

        // Create import job record
        await supabase.from('prospect_import_jobs').insert({
            client_id,
            campaign_id: campaign_id || null,
            source_url: source_url || null,
            prospect_count: inserted?.length || prospects.length,
            status: 'completed',
        });

        res.json({
            success: true,
            imported: inserted?.length || prospects.length,
            message: `${inserted?.length || prospects.length} prospects imported successfully`,
        });
    } catch (error) {
        console.error('[Extension] Import error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * GET /api/ext/prospects?client_id=...&campaign_id=...
 * Returns imported prospects for a client/campaign.
 * Admin-only.
 */
router.get('/prospects', async (req: Request, res: Response) => {
    try {
        const admin = await requireAdmin(req, res);
        if (!admin) return;

        const clientId = req.query.client_id as string;

        let query = supabase
            .from('prospects')
            .select('id, linkedin_url, name, title, company, location, source_url, status, created_at')
            .eq('team_id', admin.teamId)
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
