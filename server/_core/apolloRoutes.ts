import { Router, Request, Response } from 'express';
import { supabase } from '../supabase';

const router = Router();

function getUserId(req: Request): string | null {
  return (req as any).userId || (req as any).user?.id || null;
}

function normalizeProspects(items: any[]): any[] {
  return items
    .map((p: any) => {
      // Extract connection degree from Apify/harvestapi response
      const rawDegree = p.connectionDegree || p.connection_degree || p.degree || p.connectionType || '';
      const degree = String(rawDegree).replace(/[^0-9]/g, ''); // "1st" → "1", "2nd" → "2"

      return {
        name: [
          p.firstName || p.first_name,
          p.lastName || p.last_name,
        ].filter(Boolean).join(' ') ||
          p.fullName || p.name || '',
        first_name: p.firstName || p.first_name || '',
        last_name: p.lastName || p.last_name || '',
        title: p.headline || p.title ||
               p.currentPosition?.[0]?.position || '',
        company: p.currentPosition?.[0]?.companyName ||
                 p.company || '',
        location: p.location?.linkedinText || p.location?.parsed?.text || p.location || p.city || '',
        linkedin_url: p.linkedinUrl || p.profileUrl || p.url || null,
        avatar_url: p.photo || p.profilePicture?.url || p.imageUrl || null,
        avatar_initials: (
          (p.firstName?.[0] || p.first_name?.[0] || '') +
          (p.lastName?.[0] || p.last_name?.[0] || '')
        ).toUpperCase() || '?',
        connection_degree: degree || null, // "1", "2", "3", or null
      };
    })
    // SAFETY: Filter out 1st-degree connections — these are already your connections!
    .filter(p => (p.name || p.linkedin_url) && p.connection_degree !== '1');
}

// POST /api/prospects/search
router.post('/search', async (req: Request, res: Response) => {
  try {
    const {
      jobTitles = [],
      locations = [],
      keywords = '',
      limit = 50,
    } = req.body;

    const token = process.env.APIFY_API_TOKEN ||
      'apify_api_CWdZMugTbgkgRByDMhsYDTAmCzez3g4EZ4S9';

    const maxItems = Math.min(Number(limit) || 50, 500);

    // Build search keywords
    const kw = [
      ...(jobTitles || []),
      keywords || '',
    ].filter(Boolean).join(' ');

    console.log('[Prospects] Search keywords:', kw);
    console.log('[Prospects] Locations:', locations);
    console.log('[Prospects] Max items:', maxItems);

    // Primary actor — run-sync
    const apifyUrl = `https://api.apify.com/v2/acts/harvestapi~linkedin-profile-search/run-sync-get-dataset-items?token=${token}&timeout=300&memory=1024`;

    const body = {
      searchQuery: kw || 'professional',
      maxItems: maxItems,
      locations: (locations || []).length > 0 ? locations.map((l: string) => l.toUpperCase()) : undefined,
    };

    console.log('[Prospects] Calling harvestapi actor...');

    const apifyRes = await fetch(apifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(280000),
    });

    console.log('[Prospects] Primary actor status:', apifyRes.status);

    if (!apifyRes.ok) {
      const errText = await apifyRes.text();
      console.error('[Prospects] Search failed:', apifyRes.status, errText.slice(0, 500));
      return res.status(502).json({ error: 'Search service error. Please try again.' });
    }

    const items = await apifyRes.json();
    console.log('[Prospects] Got items:', Array.isArray(items) ? items.length : typeof items);

    const prospects = normalizeProspects(Array.isArray(items) ? items : []);
    res.json({ prospects, total: prospects.length });

  } catch (err: any) {
    console.error('[Prospects] Fatal:', err.message);
    res.status(500).json({ error: 'Search failed: ' + err.message });
  }
});

// POST /api/prospects/import
router.post('/import', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { prospects } = req.body;
    if (!prospects?.length) return res.status(400).json({ error: 'No prospects provided' });

    const { data: member } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', userId)
      .limit(1)
      .single();

    if (!member?.team_id) return res.status(400).json({ error: 'No team found' });

    const records = prospects.map((p: any) => ({
      team_id: member.team_id,
      client_id: member.team_id,
      name: p.name || 'Unknown',
      title: p.title || null,
      company: p.company || null,
      location: p.location || null,
      linkedin_url: p.linkedin_url || null,
      photo_url: p.avatar_url || p.photo || null,
      source_url: null,
      status: 'imported',
    }));

    console.log('[Import] Importing', records.length, 'prospects for team', member.team_id);

    const BATCH = 50;
    let imported = 0;
    for (let i = 0; i < records.length; i += BATCH) {
      const batch = records.slice(i, i + BATCH);
      const { data: inserted, error } = await supabase
        .from('prospects')
        .upsert(batch, { onConflict: 'linkedin_url,team_id', ignoreDuplicates: true })
        .select('id');
      if (error) {
        console.error('[Import] Batch error:', error.message, error.code, error.details);
      } else {
        imported += inserted?.length || batch.length;
      }
    }

    console.log('[Import] Done. Imported:', imported);
    res.json({ success: true, imported });
  } catch (err: any) {
    console.error('[Import] Error:', err.message);
    res.status(500).json({ error: 'Import failed' });
  }
});

export default router;
