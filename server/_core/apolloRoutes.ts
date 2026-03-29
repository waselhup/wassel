// Vercel env var needed: APIFY_API_TOKEN
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
      limit = 25,
    } = req.body;

    const apifyToken = process.env.APIFY_API_TOKEN;
    if (!apifyToken) {
      return res.status(503).json({ error: 'Service temporarily unavailable' });
    }

    const searchUrl = buildLinkedInSearchUrl({ jobTitles, locations, keywords });
    const maxProfiles = Math.min(Number(limit) || 25, 100);

    // Start Apify actor run
    const startRes = await fetch(
      'https://api.apify.com/v2/acts/dev_fusion~Linkedin-Profile-Scraper/runs',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apifyToken}`,
        },
        body: JSON.stringify({
          searchUrl,
          maxProfiles,
          proxyConfiguration: { useApifyProxy: true },
        }),
      }
    );

    if (!startRes.ok) {
      const err = await startRes.text();
      console.error('[Prospects] Apify start error:', startRes.status, err);
      return res.status(502).json({ error: 'Search service error' });
    }

    const runData = await startRes.json();
    const runId = runData.data?.id;
    const datasetId = runData.data?.defaultDatasetId;

    if (!runId) {
      return res.status(502).json({ error: 'Failed to start search' });
    }

    // Poll for completion (max 90s, 30 attempts × 3s)
    let attempts = 0;
    let runStatus = 'RUNNING';

    while ((runStatus === 'RUNNING' || runStatus === 'READY') && attempts < 30) {
      await new Promise(r => setTimeout(r, 3000));
      attempts++;

      const statusRes = await fetch(
        `https://api.apify.com/v2/actor-runs/${runId}`,
        { headers: { Authorization: `Bearer ${apifyToken}` } }
      );
      const statusData = await statusRes.json();
      runStatus = statusData.data?.status || 'RUNNING';
      console.log(`[Prospects] Run ${runId} status: ${runStatus} (attempt ${attempts})`);
    }

    if (runStatus !== 'SUCCEEDED') {
      return res.status(202).json({
        prospects: [],
        total: 0,
        message: 'Search is still processing, try again shortly',
      });
    }

    // Fetch results from dataset
    const resultsRes = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?limit=${maxProfiles}`,
      { headers: { Authorization: `Bearer ${apifyToken}` } }
    );
    const items = await resultsRes.json();

    const prospects = (Array.isArray(items) ? items : [])
      .map((p: any) => ({
        name: [p.firstName, p.lastName].filter(Boolean).join(' ') ||
              p.fullName || p.name || 'Unknown',
        first_name: p.firstName || '',
        last_name: p.lastName || '',
        title: p.headline || p.title || '',
        company: p.currentCompany?.name || p.company || '',
        location: p.location || p.city || '',
        linkedin_url: p.linkedinUrl || p.url || null,
        industry: p.industry || '',
        avatar_url: p.profilePicture || p.photoUrl || null,
        avatar_initials: (
          (p.firstName?.[0] || '') + (p.lastName?.[0] || '')
        ).toUpperCase() || '?',
      }))
      .filter((p: any) => p.name !== 'Unknown' || p.linkedin_url);

    res.json({ prospects, total: prospects.length, page: 1 });

  } catch (err: any) {
    console.error('[Prospects] Error:', err.message);
    res.status(500).json({ error: 'Search failed' });
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
