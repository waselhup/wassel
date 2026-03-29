import { Router, Request, Response } from 'express';
import { supabase } from '../supabase';

const router = Router();

function getUserId(req: Request): string | null {
  return (req as any).userId || (req as any).user?.id || null;
}

// POST /api/prospects/search
router.post('/search', async (req: Request, res: Response) => {
  try {
    const {
      jobTitles,
      locations,
      industries,
      companySizes,
      keywords,
      limit,
    } = req.body;

    const apiKey = process.env.APOLLO_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: 'Service temporarily unavailable' });
    }

    const query: any = {
      page: 1,
      per_page: Math.min(limit || 25, 100),
      person_titles: jobTitles || [],
      person_locations: locations || [],
      q_keywords: keywords || undefined,
    };

    const industryMap: Record<string, string> = {
      'Oil & Gas': 'oil_and_gas',
      'Technology': 'information_technology_and_services',
      'Healthcare': 'hospital_and_health_care',
      'Finance': 'financial_services',
      'Real Estate': 'real_estate',
      'Construction': 'construction',
      'Education': 'education_management',
      'Retail': 'retail',
      'Manufacturing': 'mechanical_or_industrial_engineering',
      'Government': 'government_administration',
    };

    if (industries?.length > 0) {
      const mapped = industries.map((i: string) => industryMap[i]).filter(Boolean);
      if (mapped.length) query.organization_industry_tag_ids = mapped;
    }

    const sizeMap: Record<string, string> = {
      '1-10': '1,10',
      '11-50': '11,50',
      '51-200': '51,200',
      '201-500': '201,500',
      '501-1000': '501,1000',
      '1000+': '1001,10000',
    };

    if (companySizes?.length > 0) {
      const mapped = companySizes.map((s: string) => sizeMap[s]).filter(Boolean);
      if (mapped.length) query.organization_num_employees_ranges = mapped;
    }

    const response = await fetch('https://api.apollo.io/api/v1/mixed_people/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(query),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[ProspectSearch] API error:', response.status, err);
      return res.status(502).json({ error: 'Search service error' });
    }

    const data = await response.json();
    const people = data.people || [];

    const prospects = people.map((p: any) => ({
      name: [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Unknown',
      first_name: p.first_name || '',
      last_name: p.last_name || '',
      title: p.title || '',
      company: p.organization?.name || '',
      location: [p.city, p.country].filter(Boolean).join(', ') || '',
      linkedin_url: p.linkedin_url
        ? (p.linkedin_url.startsWith('http') ? p.linkedin_url : `https://linkedin.com${p.linkedin_url}`)
        : null,
      industry: p.organization?.industry || '',
      avatar_initials: ((p.first_name?.[0] || '') + (p.last_name?.[0] || '')).toUpperCase(),
    }));

    res.json({
      prospects,
      total: data.pagination?.total_entries || prospects.length,
      page: 1,
    });
  } catch (err: any) {
    console.error('[ProspectSearch] Error:', err.message);
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
      const { error } = await supabase
        .from('leads')
        .upsert(leads.slice(i, i + BATCH), {
          onConflict: 'team_id,linkedin_url',
          ignoreDuplicates: true,
        });
      if (!error) imported += leads.slice(i, i + BATCH).length;
    }

    res.json({ success: true, imported });
  } catch (err: any) {
    console.error('[ProspectImport] Error:', err.message);
    res.status(500).json({ error: 'Import failed' });
  }
});

export default router;
