// LinkedIn Ads API client.
// TODO Batch 2: real API integration.

export interface LinkedInCampaignSpec {
  name: string;
  dailyBudgetSar: number;
  objective: string;
  audience: string;
  creatives: Array<{ headline: string; body: string }>;
}

export async function createLinkedInCampaign(spec: LinkedInCampaignSpec): Promise<{ campaignId: string; status: 'created' }> {
  // TODO Batch 2: POST https://api.linkedin.com/v2/adCampaignsV2
  return { campaignId: `li_${Date.now()}`, status: 'created' };
}
