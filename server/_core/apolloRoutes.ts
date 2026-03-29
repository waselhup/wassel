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
             p.currentPositions?.[0]?.title || '',
      company: p.currentPositions?.[0]?.companyName ||
               p.currentCompany?.name ||
               p.company || '',
      location: p.location || p.city || '',
      linkedin_url: p.linkedinUrl ||
                    p.profileUrl || p.url || null,
      avatar_url: p.profilePicture ||
                  p.photoUrl || p.imageUrl || null,
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

    // Build LinkedIn people search URL (for fallback)
    const geoMap: Record<string, string> = {
      'Saudi Arabia': '101452733',
      'UAE': '104305776',
      'Kuwait': '101355337',
      'Qatar': '103600532',
      'Bahrain': '100446943',
      'Oman': '102713980',
      'Egypt': '106112106',
      'Jordan': '100218280',
      'Lebanon': '100377861',
      'Morocco': '102787409',
    };

    const geoIds = (locations || [])
      .map((l: string) => geoMap[l])
      .filter(Boolean);

    const urlParams = new URLSearchParams();
    if (kw) urlParams.set('keywords', kw);
    if (geoIds.length) {
      urlParams.set('geoUrn', JSON.stringify(geoIds));
    }
    urlParams.set('origin', 'FACETED_SEARCH');
    urlParams.set('sid', 'abc');

    const linkedinUrl =
      'https://www.linkedin.com/search/results/people/?' +
      urlParams.toString();

    console.log('[Prospects] Search URL:', linkedinUrl);
    console.log('[Prospects] Max items:', maxItems);
    console.log('[Prospects] Token prefix:', token.slice(0, 20));

    // Primary actor — run-sync
    const apifyUrl = `https://api.apify.com/v2/acts/curious_coder~linkedin-people-search-scraper/run-sync-get-dataset-items?token=${token}&timeout=300&memory=1024`;

    const body = {
      searchTerms: kw ? [kw] : ['professional'],
      locations: (locations || []).length > 0 ? locations : undefined,
      maxResults: maxItems,
      proxyConfiguration: { useApifyProxy: true },
    };

    console.log('[Prospects] Calling primary Apify actor...');

    const apifyRes = await fetch(apifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(280000),
    });

    console.log('[Prospects] Primary actor status:', apifyRes.status);

    if (!apifyRes.ok) {
      const errText = await apifyRes.text();
      console.error('[Prospects] Primary failed:', apifyRes.status, errText.slice(0, 500));

      // Fallback actor
      console.log('[Prospects] Trying fallback actor...');
      const fallbackUrl = `https://api.apify.com/v2/acts/bebity~linkedin-profile-scraper/run-sync-get-dataset-items?token=${token}&timeout=300&memory=1024`;

      const fallbackRes = await fetch(fallbackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startUrls: [{ url: linkedinUrl }],
          maxItems,
          proxyConfiguration: { useApifyProxy: true },
        }),
        signal: AbortSignal.timeout(280000),
      });

      if (!fallbackRes.ok) {
        const fbErr = await fallbackRes.text();
        console.error('[Prospects] Fallback failed:', fbErr.slice(0, 200));
        return res.status(502).json({ error: 'Search service error. Please try again.' });
      }

      const fbItems = await fallbackRes.json();
      const fbProspects = normalizeProspects(Array.isArray(fbItems) ? fbItems : []);
      return res.json({ prospects: fbProspects, total: fbProspects.length });
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
