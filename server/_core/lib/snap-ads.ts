// Snapchat Ads API client.
// TODO Batch 2: real API integration. For now this is a stub that returns
// realistic mock data so the UI/routers can compile and exercise the flow.

export interface SnapCampaignSpec {
  name: string;
  dailyBudgetSar: number;
  objective: string;
  audience: string;
  creatives: Array<{ headline: string; body: string }>;
}

export async function createSnapCampaign(spec: SnapCampaignSpec): Promise<{ campaignId: string; status: 'created' }> {
  // TODO Batch 2: POST https://adsapi.snapchat.com/v1/adaccounts/{id}/campaigns
  return { campaignId: `snap_${Date.now()}`, status: 'created' };
}

export async function pauseSnapCampaign(campaignId: string): Promise<{ ok: true }> {
  // TODO Batch 2: PATCH /campaigns/{id} {status: 'PAUSED'}
  console.log('[snap-ads stub] would pause', campaignId);
  return { ok: true };
}
