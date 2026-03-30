import { Router, Request, Response } from 'express';
import { supabase } from '../supabase';

const router = Router();

function getUserId(req: Request): string | null {
  return (req as any).userId || (req as any).user?.id || null;
}

function normalizeProspects(items: any[]): any[] {
  return items
    .map((p: any) => ({
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
    }))
    .filter(p => p.name || p.linkedin_url);
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
      maxProfiles: maxItems,
      locations: (locations || []).length > 0 ? locations : undefined,
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

    const leads = prospects.map((p: any) => ({
      team_id: member.team_id,
      name: p.name,
      title: p.title || null,
      company: p.company || null,
      location: p.location || null,
      linkedin_url: p.linkedin_url || null,
      source: 'discovery',
      status: 'new',
    }));

    const BATCH = 50;
    let imported = 0;
    for (let i = 0; i < leads.length; i += BATCH) {
      const batch = leads.slice(i, i + BATCH);
      const { error } = await supabase
        .from('leads')
        .upsert(batch, { onConflict: 'team_id,linkedin_url', ignoreDuplicates: true });
      if (!error) imported += batch.length;
    }

    res.json({ success: true, imported });
  } catch (err: any) {
    console.error('[Import] Error:', err.message);
    res.status(500).json({ error: 'Import failed' });
  }
});

export default router;
