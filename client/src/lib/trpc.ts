import { supabase } from './supabase';

const BASE = '/api/trpc';

function getTokenFromLocalStorage(): string | null {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        const token = parsed?.access_token || parsed?.currentSession?.access_token;
        if (token) return token;
      }
    }
  } catch (e) {
    console.error('[trpc] localStorage token read failed:', e);
  }
  return null;
}

async function authHeaders(): Promise<Record<string, string>> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };

  // FAST PATH: read token from localStorage (instant, no hanging)
  const cachedToken = getTokenFromLocalStorage();
  if (cachedToken) {
    h['Authorization'] = `Bearer ${cachedToken}`;
    console.log('[trpc] Using cached token from localStorage');
    return h;
  }

  // SLOW PATH: fallback to getSession with timeout
  console.log('[trpc] No cached token, calling getSession...');
  try {
    const sessionPromise = supabase.auth.getSession();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('getSession timeout after 5s')), 5000)
    );
    const { data } = await Promise.race([sessionPromise, timeoutPromise]) as any;
    const token = data?.session?.access_token;
    if (token) h['Authorization'] = `Bearer ${token}`;
  } catch (e) {
    console.error('[trpc] authHeaders error:', e);
  }
  console.log('[trpc] authHeaders: done, hasAuth:', !!h.Authorization);
  return h;
}

function handle(j: any) {
  if (j?.error) {
    const code = j.error.data?.code;
    if (code === 'UNAUTHORIZED') {
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
  console.log('[trpc] trpcMutation called for:', name);
  console.log('[trpc] Getting auth headers...');
  const headers = await authHeaders();
  console.log('[trpc] Got headers, hasAuth:', !!headers.Authorization);
  console.log('[trpc] Sending fetch to:', `${BASE}/${name}`);
  const res = await fetch(`${BASE}/${name}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  });
  console.log('[trpc] Fetch returned, status:', res.status);
  const j = await res.json();
  console.log('[trpc] Parsed JSON response');
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
