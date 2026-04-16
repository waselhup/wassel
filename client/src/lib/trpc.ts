import { supabase } from './supabase';

const BASE = '/api/trpc';

async function authHeaders(): Promise<Record<string, string>> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const { data } = await supabase.auth.getSession();
    let token = data.session?.access_token;
    if (!token) {
      const { data: r } = await supabase.auth.refreshSession();
      token = r.session?.access_token;
    }
    if (token) h['Authorization'] = `Bearer ${token}`;
  } catch {}
  return h;
}

function handle(j: any) {
  if (j?.error) {
    const code = j.error.data?.code;
    if (code === 'UNAUTHORIZED') {
      window.location.href = '/login';
      throw new Error('غير مصرّح - يرجى تسجيل الدخول');
    }
    throw new Error(j.error.message || 'Request failed');
  }
  return j?.result?.data ?? j?.result ?? j;
}

export async function trpcQuery<T = any>(name: string, input?: any): Promise<T> {
  const url = input !== undefined
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
    analyzeDeep: (input: { linkedinUrl?: string; imageBase64?: string; mediaType?: string }) =>
      trpcMutation<any>('linkedin.analyzeDeep', input),
    history: () => trpcQuery<any[]>('linkedin.history'),
  },
  cv: {
    generate: (fields: string[], context?: Record<string, string>) =>
      trpcMutation<{ versions: any[]; tokensRemaining: number }>('cv.generate', { fields, context }),
    parseUpload: (fileBase64: string, fileName: string) =>
      trpcMutation<{ name: string; email: string; phone: string; currentRole: string; experience: string; skills: string; education: string; achievements: string; languages: string }>('cv.parseUpload', { fileBase64, fileName }),
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
    discoverProspects: (input: {
      jobTitle: string;
      industry: string;
      location: string;
    }) => trpcMutation<{ prospects: any[] }>('campaign.discoverProspects', input),
    generateMessages: (input: {
      prospects: Array<{ name: string; title: string; company: string; linkedinUrl: string }>;
      jobTitle: string;
      language: 'ar' | 'en';
    }) => trpcMutation<{ messages: Array<{ prospectName: string; company: string; subject: string; body: string }> }>('campaign.generateMessages', input),
    send: (input: {
      campaignId: string;
      messages: Array<{ email: string; subject: string; body: string }>;
    }) => trpcMutation<{ sent: number; failed: number }>('campaign.send', input),
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
