// Snapchat Marketing API v1 — campaigns, ad squads, creatives, insights.
// Env-gated. Missing creds → stub mode (returns synthetic IDs), never crashes.
// Docs: https://marketingapi.snapchat.com/docs/

const BASE = 'https://adsapi.snapchat.com/v1';
const AD_ACCOUNT_ID = process.env.SNAP_AD_ACCOUNT_ID || '';
const ACCESS_TOKEN = process.env.SNAP_ACCESS_TOKEN || '';
const USD_PER_SAR = 1 / (parseFloat(process.env.USD_SAR_RATE || '3.75'));

export function isSnapConfigured(): boolean {
  return !!(AD_ACCOUNT_ID && ACCESS_TOKEN);
}

interface SnapResult<T = any> {
  ok: boolean;
  data?: T;
  error?: string;
  stub?: boolean;
}

async function snapFetch<T = any>(path: string, init?: RequestInit): Promise<SnapResult<T>> {
  if (!isSnapConfigured()) {
    return { ok: true, stub: true, data: {} as any };
  }
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: json?.error_description || json?.error || `HTTP ${res.status}` };
    return { ok: true, data: json };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

export interface CreateCampaignOpts {
  name: string;
  dailyBudgetSar: number;
  objective: 'AWARENESS' | 'WEB_CONVERSION' | 'APP_INSTALL' | 'LEAD_GENERATION';
}

export async function createCampaign(opts: CreateCampaignOpts) {
  const dailyBudgetMicroUsd = Math.round(opts.dailyBudgetSar * USD_PER_SAR * 1_000_000);
  const r = await snapFetch(`/adaccounts/${AD_ACCOUNT_ID}/campaigns`, {
    method: 'POST',
    body: JSON.stringify({
      campaigns: [{
        ad_account_id: AD_ACCOUNT_ID,
        name: opts.name,
        objective: opts.objective,
        status: 'PAUSED',
        daily_budget_micro: dailyBudgetMicroUsd,
        start_time: new Date().toISOString(),
      }],
    }),
  });
  if (r.stub) return { campaignId: `snap_${Date.now()}`, status: 'created', stub: true };
  const id = r.data?.campaigns?.[0]?.campaign?.id;
  return { campaignId: id, status: r.ok ? 'created' : 'failed', error: r.error };
}

export async function createAdSquad(opts: {
  campaignId: string;
  name: string;
  dailyBudgetSar: number;
  targeting?: any;
}) {
  const dailyBudgetMicroUsd = Math.round(opts.dailyBudgetSar * USD_PER_SAR * 1_000_000);
  const r = await snapFetch(`/campaigns/${opts.campaignId}/adsquads`, {
    method: 'POST',
    body: JSON.stringify({
      adsquads: [{
        campaign_id: opts.campaignId,
        name: opts.name,
        type: 'SNAP_ADS',
        daily_budget_micro: dailyBudgetMicroUsd,
        targeting: opts.targeting || { geos: [{ country_code: 'sa' }] },
        billing_event: 'IMPRESSION',
        optimization_goal: 'IMPRESSIONS',
      }],
    }),
  });
  if (r.stub) return { adSquadId: `sas_${Date.now()}`, stub: true };
  return { adSquadId: r.data?.adsquads?.[0]?.adsquad?.id, error: r.error };
}

export async function createCreative(opts: {
  adSquadId: string;
  headline: string;
  bodyText: string;
  mediaUrl?: string;
  ctaType?: string;
}) {
  const r = await snapFetch(`/adaccounts/${AD_ACCOUNT_ID}/creatives`, {
    method: 'POST',
    body: JSON.stringify({
      creatives: [{
        ad_account_id: AD_ACCOUNT_ID,
        name: opts.headline.slice(0, 100),
        type: 'SNAP_AD',
        headline: opts.headline,
        brand_name: 'Wassel',
        call_to_action: opts.ctaType || 'SIGN_UP',
      }],
    }),
  });
  if (r.stub) return { creativeId: `scr_${Date.now()}`, stub: true };
  return { creativeId: r.data?.creatives?.[0]?.creative?.id, error: r.error };
}

export async function pauseCampaign(campaignId: string) {
  const r = await snapFetch(`/campaigns/${campaignId}`, {
    method: 'PUT',
    body: JSON.stringify({ campaigns: [{ id: campaignId, status: 'PAUSED' }] }),
  });
  return { ok: r.ok, error: r.error, stub: r.stub };
}

export async function getInsights(opts: {
  campaignId: string;
  granularity?: 'DAY' | 'HOUR' | 'LIFETIME';
  startTime?: string;
  endTime?: string;
}) {
  const qs = new URLSearchParams({
    granularity: opts.granularity || 'DAY',
    fields: 'impressions,swipes,spend,conversions',
  });
  if (opts.startTime) qs.set('start_time', opts.startTime);
  if (opts.endTime) qs.set('end_time', opts.endTime);
  const r = await snapFetch(`/campaigns/${opts.campaignId}/stats?${qs.toString()}`);
  if (r.stub) return { impressions: 0, swipes: 0, spendSar: 0, conversions: 0, stub: true };
  const totals = r.data?.total_stats?.[0]?.total_stat || {};
  return {
    impressions: totals.impressions || 0,
    swipes: totals.swipes || 0,
    spendSar: (totals.spend || 0) / 1_000_000 / USD_PER_SAR,
    conversions: totals.conversions || 0,
  };
}

// Legacy export for back-compat with Batch 1 stub callers.
export interface SnapCampaignSpec {
  name: string;
  dailyBudgetSar: number;
  objective: string;
  audience: string;
  creatives: Array<{ headline: string; body: string }>;
}

export async function createSnapCampaign(spec: SnapCampaignSpec): Promise<{ campaignId: string; status: string }> {
  const c = await createCampaign({
    name: spec.name,
    dailyBudgetSar: spec.dailyBudgetSar,
    objective: 'WEB_CONVERSION',
  });
  return { campaignId: c.campaignId || `snap_${Date.now()}`, status: c.status || 'failed' };
}

export async function pauseSnapCampaign(campaignId: string): Promise<{ ok: boolean }> {
  const r = await pauseCampaign(campaignId);
  return { ok: !!r.ok };
}
