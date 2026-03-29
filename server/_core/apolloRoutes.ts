import { Router, Request, Response } from 'express';
import { supabase } from '../supabase';

const router = Router();

function getUserId(req: Request): string | null {
  return (req as any).userId || (req as any).user?.id || null;
}

const LOCATION_GEO_IDS: Record<string, string> = {
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

function mapToProspects(items: any[]): any[] {
  return (Array.isArray(items) ? items : [])
    .map((p: any) => ({
      name: [p.firstName, p.lastName].filter(Boolean).join(' ') ||
            p.fullName || p.name || 'Unknown',
      first_name: p.firstName || '',
      last_name: p.lastName || '',
      title: p.headline || p.currentPositions?.[0]?.title || p.title || '',
      company: p.currentPositions?.[0]?.companyName || p.currentCompany?.name || p.company || '',
      location: p.location || p.city || '',
      linkedin_url: p.linkedinUrl || p.profileUrl || p.url || null,
      industry: p.industry || '',
      avatar_url: p.profilePicture || p.photoUrl || null,
      avatar_initials: (
        (p.firstName?.[0] || '') + (p.lastName?.[0] || '')
      ).toUpperCase() || '?',
    }))
    .filter((p: any) => p.name !== 'Unknown' || p.linkedin_url);
}

async function searchWithPrimaryActor(
  searchTerms: string,
  maxItems: number,
  token: string
): Promise<any[] | null> {
  const actorId = 'curious_coder~linkedin-people-search-scraper';
  try {
    const runRes = await fetch(
      `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${token}&timeout=120&memory=512`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          searchTerms: [searchTerms],
          maxResults: maxItems,
          searchType: 'people',
          proxyConfiguration: { useApifyProxy: true },
        }),
      }
    );

    if (!runRes.ok) {
      const errText = await runRes.text();
      console.error('[Prospects] Primary actor error:', runRes.status, errText.slice(0, 200));
      return null;
    }

    const items = await runRes.json();
    console.log(`[Prospects] Primary actor returned ${Array.isArray(items) ? items.length : 0} items`);
    return Array.isArray(items) ? items : null;
  } catch (err: any) {
    console.error('[Prospects] Primary actor exception:', err.message);
    return null;
  }
}

async function searchWithFallbackActor(
  searchUrl: string,
  maxItems: number,
  token: string
): Promise<any[]> {
  const actorId = 'dev_fusion~Linkedin-Profile-Scraper';
  const runRes = await fetch(
    `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${token}&timeout=120&memory=512`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        searchUrl,
        maxProfiles: maxItems,
        proxyConfiguration: { useApifyProxy: true },
      }),
    }
  );

  if (!runRes.ok) {
    const errText = await runRes.text();
    console.error('[Prospects] Fallback actor error:', runRes.status, errText.slice(0, 200));
    throw new Error(`Fallback actor failed: ${runRes.status}`);
  }

  const items = await runRes.json();
  console.log(`[Prospects] Fallback actor returned ${Array.isArray(items) ? items.length : 0} items`);
  return Array.isArray(items) ? items : [];
}

function buildLinkedInSearchUrl(filters: {
  jobTitles: string[];
  locations: string[];
  keywords: string;
}): string {
  const urlParams = new URLSearchParams();

  const kw = [
    ...(filters.jobTitles || []),
    filters.keywords || '',
  ].filter(Boolean).join(' OR ');

  if (kw) urlParams.set('keywords', kw);

  const geoIds = (filters.locations || [])
    .map(l => LOCATION_GEO_IDS[l])
    .filter(Boolean);

  if (geoIds.length) {
    urlParams.set('geoUrn', `["${geoIds.join('","')}"]`);
  }

  urlParams.set('origin', 'FACETED_SEARCH');
  return 'https://www.linkedin.com/search/results/people/?' + urlParams.toString();
}

// POST /api/prospects/search
router.post('/search', async (req: Request, res: Response) => {
  try {
    const {
      jobTitles = [],
      locations = [],
      industries = [],
      companySizes = [],
      keywords = '',
      limit = 50,
    } = req.body;

    const apifyToken = process.env.APIFY_API_TOKEN;
    if (!apifyToken) {
      console.error('[Prospects] APIFY_API_TOKEN not set');
      return res.status(503).json({ error: 'Search service not configured' });
    }

    const maxItems = Math.min(Number(limit) || 50, 500);

    // Build search terms for primary actor
    const searchTerms = [
      ...(jobTitles || []),
      keywords || '',
    ].filter(Boolean).join(' ');

    if (!searchTerms && !locations.length) {
      return res.status(400).json({ error: 'Provide at least one filter' });
    }

    // Try primary actor first
    let rawItems = await searchWithPrimaryActor(searchTerms || 'professional', maxItems, apifyToken);

    // Fallback if primary returned null or empty
    if (!rawItems || rawItems.length === 0) {
      console.log('[Prospects] Falling back to secondary actor');
      const searchUrl = buildLinkedInSearchUrl({ jobTitles, locations, keywords });
      rawItems = await searchWithFallbackActor(searchUrl, maxItems, apifyToken);
    }

    const prospects = mapToProspects(rawItems);
    res.json({ prospects, total: prospects.length, page: 1 });

  } catch (err: any) {
    console.error('[Prospects] Error:', err.message);
    res.status(500).json({ error: 'Search failed. Please try again.' });
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
