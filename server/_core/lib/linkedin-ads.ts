// LinkedIn Marketing API (REST) — campaigns, creatives, analytics.
// Env-gated. Missing creds → stub mode, never crashes.
// Docs: https://learn.microsoft.com/en-us/linkedin/marketing/

const BASE = 'https://api.linkedin.com/rest';
const VERSION = '202410';
const AD_ACCOUNT_ID = process.env.LINKEDIN_AD_ACCOUNT_ID || '';
const ACCESS_TOKEN = process.env.LINKEDIN_ACCESS_TOKEN || '';
const USD_PER_SAR = 1 / (parseFloat(process.env.USD_SAR_RATE || '3.75'));

export function isLinkedInAdsConfigured(): boolean {
  return !!(AD_ACCOUNT_ID && ACCESS_TOKEN);
}

interface LIResult<T = any> {
  ok: boolean;
  data?: T;
  error?: string;
  stub?: boolean;
}

async function liFetch<T = any>(path: string, init?: RequestInit): Promise<LIResult<T>> {
  if (!isLinkedInAdsConfigured()) return { ok: true, stub: true };
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        'LinkedIn-Version': VERSION,
        'X-Restli-Protocol-Version': '2.0.0',
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: json?.message || `HTTP ${res.status}` };
    return { ok: true, data: json };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

export async function createCampaign(opts: {
  name: string;
  dailyBudgetSar: number;
  objective: 'WEBSITE_VISIT' | 'LEAD_GENERATION' | 'BRAND_AWARENESS' | 'WEBSITE_CONVERSION';
  targeting?: any;
}) {
  const dailyBudgetUsd = opts.dailyBudgetSar * USD_PER_SAR;
  const r = await liFetch(`/adAccounts/${AD_ACCOUNT_ID}/adCampaigns`, {
    method: 'POST',
    body: JSON.stringify({
      name: opts.name,
      type: 'SPONSORED_UPDATES',
      objectiveType: opts.objective,
      status: 'PAUSED',
      dailyBudget: { amount: dailyBudgetUsd.toFixed(2), currencyCode: 'USD' },
      targetingCriteria: opts.targeting || {
        include: { and: [{ or: { 'urn:li:adTargetingFacet:locations': ['urn:li:geo:103644278'] } }] },
      },
    }),
  });
  if (r.stub) return { campaignId: `li_${Date.now()}`, status: 'created', stub: true };
  return { campaignId: r.data?.id, status: r.ok ? 'created' : 'failed', error: r.error };
}

export async function createCreative(opts: {
  campaignId: string;
  headline: string;
  bodyText: string;
  destinationUrl: string;
}) {
  const r = await liFetch(`/creatives`, {
    method: 'POST',
    body: JSON.stringify({
      campaign: `urn:li:sponsoredCampaign:${opts.campaignId}`,
      intendedStatus: 'PAUSED',
      content: { reference: opts.destinationUrl },
    }),
  });
  if (r.stub) return { creativeId: `licr_${Date.now()}`, stub: true };
  return { creativeId: r.data?.id, error: r.error };
}

export async function pauseCampaign(campaignId: string) {
  const r = await liFetch(`/adAccounts/${AD_ACCOUNT_ID}/adCampaigns/${campaignId}`, {
    method: 'POST',
    headers: { 'X-RestLi-Method': 'PARTIAL_UPDATE' },
    body: JSON.stringify({ patch: { $set: { status: 'PAUSED' } } }),
  });
  return { ok: r.ok, error: r.error, stub: r.stub };
}

export async function getInsights(opts: {
  campaignId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;
}) {
  const qs = new URLSearchParams({
    q: 'analytics',
    pivot: 'CAMPAIGN',
    campaigns: `List(urn:li:sponsoredCampaign:${opts.campaignId})`,
    timeGranularity: 'DAILY',
    'dateRange.start.year': opts.startDate.slice(0, 4),
    'dateRange.start.month': String(parseInt(opts.startDate.slice(5, 7), 10)),
    'dateRange.start.day': String(parseInt(opts.startDate.slice(8, 10), 10)),
    'dateRange.end.year': opts.endDate.slice(0, 4),
    'dateRange.end.month': String(parseInt(opts.endDate.slice(5, 7), 10)),
    'dateRange.end.day': String(parseInt(opts.endDate.slice(8, 10), 10)),
    fields: 'impressions,clicks,costInUsd,externalWebsiteConversions',
  });
  const r = await liFetch(`/adAnalytics?${qs.toString()}`);
  if (r.stub) return { impressions: 0, clicks: 0, spendSar: 0, conversions: 0, stub: true };
  const els = r.data?.elements || [];
  const sum = els.reduce((acc: any, e: any) => ({
    impressions: acc.impressions + (e.impressions || 0),
    clicks: acc.clicks + (e.clicks || 0),
    costUsd: acc.costUsd + parseFloat(e.costInUsd || '0'),
    conversions: acc.conversions + (e.externalWebsiteConversions || 0),
  }), { impressions: 0, clicks: 0, costUsd: 0, conversions: 0 });
  return {
    impressions: sum.impressions,
    clicks: sum.clicks,
    spendSar: sum.costUsd / USD_PER_SAR,
    conversions: sum.conversions,
  };
}

// Legacy export
export interface LinkedInCampaignSpec {
  name: string;
  dailyBudgetSar: number;
  objective: string;
  audience: string;
  creatives: Array<{ headline: string; body: string }>;
}

export async function createLinkedInCampaign(spec: LinkedInCampaignSpec): Promise<{ campaignId: string; status: string }> {
  const c = await createCampaign({
    name: spec.name,
    dailyBudgetSar: spec.dailyBudgetSar,
    objective: 'WEBSITE_VISIT',
  });
  return { campaignId: c.campaignId || `li_${Date.now()}`, status: c.status || 'failed' };
}
