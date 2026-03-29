import { Router } from 'express';
import { supabase } from '../supabase';

const router = Router();

// Helper to get userId from request
function getUserId(req: any): string | null {
  return req.userId || req.user?.id || null;
}

// POST /api/apollo/search
router.post('/search', async (req: any, res: any) => {
  const apolloKey = process.env.APOLLO_API_KEY || 'PLACEHOLDER';
  if (apolloKey === 'PLACEHOLDER') {
    return res.status(503).json({
      error: 'Apollo API key not configured',
      message: 'Please add APOLLO_API_KEY to Vercel env variables',
    });
  }

  const { jobTitles = [], locations = [], industries = [], companySize = '', keywords = '', limit = 25 } = req.body;

  try {
    const body: Record<string, any> = {
      page: 1,
      per_page: Math.min(Number(limit) || 25, 100),
    };
    if (jobTitles?.length) body.person_titles = jobTitles;
    if (locations?.length) body.person_locations = locations;
    if (keywords) body.q_keywords = keywords;
    if (companySize) {
      const sizeMap: Record<string, string> = {
        '1-10': '1,10',
        '11-50': '11,50',
        '51-200': '51,200',
        '201-500': '201,500',
        '500+': '500,10000',
      };
      const range = sizeMap[companySize];
      if (range) body.organization_num_employees_ranges = [range];
    }

    const apolloRes = await fetch('https://api.apollo.io/api/v1/mixed_people/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apolloKey,
      },
      body: JSON.stringify(body),
    });

    if (!apolloRes.ok) {
      const errText = await apolloRes.text();
      return res.status(apolloRes.status).json({ error: 'Apollo API error', detail: errText });
    }

    const data = await apolloRes.json();
    const people = data.people || [];

    const prospects = people.map((p: any) => ({
      name: [p.first_name, p.last_name].filter(Boolean).join(' '),
      title: p.title || '',
      company: p.organization?.name || '',
      location: [p.city, p.country].filter(Boolean).join(', '),
      linkedin_url: p.linkedin_url || '',
      email: p.email || '',
      source: 'apollo',
      apollo_id: p.id || '',
    }));

    res.json({
      prospects,
      total: data.pagination?.total_entries || prospects.length,
      page: data.pagination?.page || 1,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/apollo/import — save selected prospects to leads table
router.post('/import', async (req: any, res: any) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { prospects } = req.body;
  if (!Array.isArray(prospects) || !prospects.length) {
    return res.status(400).json({ error: 'No prospects provided' });
  }

  try {
    // Get team_id for this user
    const { data: member } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', userId)
      .limit(1)
      .single();

    const teamId = member?.team_id || null;

    const rows = prospects.map((p: any) => ({
      user_id: userId,
      team_id: teamId,
      name: p.name || '',
      title: p.title || '',
      company: p.company || '',
      location: p.location || '',
      linkedin_url: p.linkedin_url || '',
      email: p.email || '',
      source: 'apollo',
      status: 'new',
    }));

    const { data, error } = await supabase.from('leads').insert(rows).select('id');
    if (error) return res.status(500).json({ error: error.message });

    res.json({ imported: data?.length || 0, ids: data?.map((r: any) => r.id) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
