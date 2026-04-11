import { supabase } from './supabase';

const BASE = '/api/trpc';

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

function handle(j: any) {
  if (j?.error) {
    throw new Error(j.error.message || 'Request failed');
  }
  return j?.result?.data;
}

export async function trpcQuery<T = any>(name: string, input?: any): Promise<T> {
  const url =
    input !== undefined
      ? `${BASE}/${name}?input=${encodeURIComponent(JSON.stringify(input))}`
      : `${BASE}/${name}`;
  const res = await fetch(url, { headers: await authHeaders() });
  const j = await res.json();
  return handle(j);
}

export async function trpcMutation<T = any>(name: string, input: any = {}): Promise<T> {
  const res = await fetch(`${BASE}/${name}`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(input),
  });
  const j = await res.json();
  return handle(j);
}

export const trpc = {
  token: {
    balance: () => trpcQuery<{ balance: number }>('token.balance'),
    history: () => trpcQuery<any[]>('token.history'),
  },
  linkedin: {
    analyze: (profileUrl: string) =>
      trpcMutation<any>('linkedin.analyze', { profileUrl }),
    history: () => trpcQuery<any[]>('linkedin.history'),
  },
  cv: {
    generate: (fields: string[], context?: Record<string, string>) =>
      trpcMutation<{ versions: any[]; tokensRemaining: number }>('cv.generate', { fields, context }),
    history: () => trpcQuery<any[]>('cv.history'),
  },
  campaign: {
    list: () => trpcQuery<any[]>('campaign.list'),
    previewMessages: (input: {
      jobTitle: string;
      targetCompanies: string[];
      language: 'ar' | 'en';
    }) => trpcMutation<{ messages: Array<{ company: string; subject: string; body: string }> }>('campaign.previewMessages', input),
    create: (input: {
      campaignName: string;
      jobTitle: string;
      targetCompanies: string[];
      recipientCount: number;
      language: 'ar' | 'en';
    }) => trpcMutation<any>('campaign.create', input),
  },
  admin: {
    stats: () => trpcQuery<any>('admin.stats'),
  },
  knowledge: {
    list: () => trpcQuery<any[]>('knowledge.list'),
    save: (input: { type: string; title: string; content: any; tags?: string[] }) =>
      trpcMutation<any>('knowledge.save', input),
    delete: (id: string) => trpcMutation<any>('knowledge.delete', { id }),
    export: () => trpcQuery<any>('knowledge.export'),
  },
};
