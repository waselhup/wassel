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
    parseUpload: (input: { fileBase64: string; fileName: string; mimeType: string }) =>
      trpcMutation<{ success: boolean; extracted: any; textLength: number; parseMethod: 'docx' | 'pdf-text' | 'pdf-ocr' | 'manual' }>('cv.parseUpload', input),
    generate: (input: {
      userData: any;
      targetRole: string;
      targetCompany?: string;
      jobDescription?: string;
      template: 'mit-classic' | 'harvard-executive';
      language: 'ar' | 'en';
      includeCoverLetter?: boolean;
      calculateATS?: boolean;
      sourceParseMethod?: 'docx' | 'pdf-text' | 'pdf-ocr' | 'manual';
    }) => trpcMutation<{
      id: string;
      cvData: any;
      docxUrl: string | null;
      pdfUrl: string | null;
      atsScore: any | null;
      coverLetter: { docxUrl: string | null; pdfUrl: string | null } | null;
      tokensUsed: number;
      tokensRemaining: number;
    }>('cv.generate', input),
    compareCvs: (input: { olderId: string; newerId: string }) =>
      trpcQuery<{
        older: { id: string; template: string; targetRole: string; createdAt: string; atsScore: number | null };
        newer: { id: string; template: string; targetRole: string; createdAt: string; atsScore: number | null };
        segments: Array<{ type: 'added' | 'removed' | 'unchanged'; text: string }>;
        metrics: { wordsAdded: number; wordsRemoved: number; atsDelta: number | null };
      }>('cv.compareCvs', input),
    list: () => trpcQuery<any[]>('cv.list'),
    getById: (input: { id: string }) => trpcQuery<any>('cv.getById', input),
    deleteById: (input: { id: string }) => trpcMutation<{ success: boolean }>('cv.deleteById', input),
  },
  campaign: {
    list: () => trpcQuery<any[]>('campaign.list'),
    get: (input: { id: string }) =>
      trpcQuery<{ campaign: any; recipients: any[] }>('campaign.get', input),
    previewMessages: (input: {
      senderRole: string;
      goal: string;
      tone?: 'professional' | 'friendly' | 'concise';
      language: 'ar' | 'en';
      companyIds: string[];
    }) => trpcMutation<{ messages: Array<{ companyId: string; companyName: string; subject: string; body: string }> }>('campaign.previewMessages', input),
    create: (input: {
      campaignName: string;
      senderRole: string;
      goal: string;
      tone?: 'professional' | 'friendly' | 'concise';
      language: 'ar' | 'en';
      companyIds: string[];
      dailyLimit?: number;
    }) => trpcMutation<any>('campaign.create', input),
    launch: (input: { id: string }) => trpcMutation<any>('campaign.launch', input),
    pause: (input: { id: string }) => trpcMutation<any>('campaign.pause', input),
    updateRecipient: (input: { recipientId: string; subject?: string; body?: string }) =>
      trpcMutation<any>('campaign.updateRecipient', input),
    processBatch: (input: { batchSize: number }) =>
      trpcMutation<{ processed: number; active: number; dryRun: boolean }>('campaign.processBatch', input),
  },
  companies: {
    list: (input?: { industry?: string; city?: string; size?: string; search?: string; limit?: number }) =>
      trpcQuery<any[]>('companies.list', input || {}),
    industries: () => trpcQuery<string[]>('companies.industries'),
    get: (input: { id: string }) => trpcQuery<any>('companies.get', input),
    create: (input: { name: string; name_ar?: string; website?: string; industry?: string; city?: string; size?: string; primary_email?: string }) =>
      trpcMutation<any>('companies.create', input),
    update: (input: { id: string; patch: Record<string, any> }) =>
      trpcMutation<any>('companies.update', input),
    enrich: (input: { id: string }) =>
      trpcMutation<{ company: any; emailsFound: number; note: string }>('companies.enrich', input),
    delete: (input: { id: string }) => trpcMutation<any>('companies.delete', input),
  },
  admin: {
    stats: () => trpcQuery<any>('admin.stats'),
    users: (input?: { search?: string; limit?: number }) =>
      trpcQuery<any[]>('admin.users', input || {}),
    addTokens: (input: { userId: string; amount: number; reason: string }) =>
      trpcMutation<{ success: boolean; newBalance: number }>('admin.addTokens', input),
    toggleBan: (input: { userId: string }) =>
      trpcMutation<{ success: boolean; banned: boolean }>('admin.toggleBan', input),
    campaigns: () => trpcQuery<any[]>('admin.campaigns'),
    systemStatus: () => trpcQuery<any>('admin.systemStatus'),
  },
  reviews: {
    list: () => trpcQuery<any[]>('reviews.list'),
    submit: (input: { rating: number; comment: string }) =>
      trpcMutation<any>('reviews.submit', input),
    myReviews: () => trpcQuery<any[]>('reviews.myReviews'),
    listPending: () => trpcQuery<any[]>('reviews.listPending'),
    listAll: () => trpcQuery<any[]>('reviews.listAll'),
    approve: (input: { id: string }) => trpcMutation<any>('reviews.approve', input),
    reject: (input: { id: string }) => trpcMutation<any>('reviews.reject', input),
    delete: (input: { id: string }) => trpcMutation<any>('reviews.delete', input),
  },
  feedback: {
    submit: (input: { category: string; subject: string; description: string; priority?: string; pageUrl?: string }) =>
      trpcMutation<any>('feedback.submit', input),
    myTickets: () => trpcQuery<any[]>('feedback.myTickets'),
    listAll: () => trpcQuery<any[]>('feedback.listAll'),
    respond: (input: { id: string; response: string; status?: string }) =>
      trpcMutation<any>('feedback.respond', input),
    updateStatus: (input: { id: string; status: string }) =>
      trpcMutation<any>('feedback.updateStatus', input),
  },
  ops: {
    anthropicHealth: () => trpcQuery<{
      status: 'healthy' | 'error' | 'unreachable';
      httpCode: number;
      message: string;
      creditExhausted: boolean;
      latencyMs: number;
      timestamp: string;
    }>('ops.anthropicHealth'),
  },
  aiFeedback: {
    submit: (input: { feature: string; outputId?: string; rating: number; comment?: string }) =>
      trpcMutation<{ id: string; success: boolean }>('aiFeedback.submit', input),
    list: (input?: { feature?: string; rating?: number; limit?: number }) =>
      trpcQuery<any[]>('aiFeedback.list', input || {}),
    stats: () => trpcQuery<Record<string, { total: number; avg: number; sum: number }>>('aiFeedback.stats'),
    listPrompts: (input?: { feature?: string }) =>
      trpcQuery<any[]>('aiFeedback.listPrompts', input || {}),
    savePrompt: (input: { feature: string; promptText: string; activate?: boolean }) =>
      trpcMutation<any>('aiFeedback.savePrompt', input),
    activatePrompt: (input: { promptId: string }) =>
      trpcMutation<any>('aiFeedback.activatePrompt', input),
  },
  executor: {
    list: () => trpcQuery<any[]>('executor.list'),
    startConversation: (input: { agentId: string; title?: string }) =>
      trpcMutation<any>('executor.startConversation', input),
    listConversations: () => trpcQuery<any[]>('executor.listConversations'),
    getConversation: (input: { conversationId: string }) =>
      trpcQuery<{ conversation: any; messages: any[]; actions: any[] }>('executor.getConversation', input),
    deleteConversation: (input: { conversationId: string }) =>
      trpcMutation<any>('executor.deleteConversation', input),
    sendMessage: (input: { conversationId: string; content: string }) =>
      trpcMutation<{ content: string; pendingActions: any[]; error?: string }>('executor.sendMessage', input),
    approveAction: (input: { actionId: string }) =>
      trpcMutation<any>('executor.approveAction', input),
    rejectAction: (input: { actionId: string }) =>
      trpcMutation<any>('executor.rejectAction', input),
    listActions: (input?: { conversationId?: string }) =>
      trpcQuery<any[]>('executor.listActions', input || {}),
  },
  analytics: {
    overview: (input: { range: 'today' | 'week' | 'month' | 'all' }) =>
      trpcQuery<{
        range: string;
        kpis: {
          profile_analyses: number;
          cvs_generated: number;
          posts_generated: number;
          campaigns_active: number;
          messages_sent: number;
          connections_accepted: number;
          response_rate: number;
          jobs_applied: number;
        };
        tokens: { balance: number; used_total: number };
      }>('analytics.overview', input),
    activityTimeseries: (input: { days: number }) =>
      trpcQuery<Array<{ date: string; analyses: number; cvs: number; posts: number }>>(
        'analytics.activityTimeseries',
        input
      ),
    campaignPerformance: () =>
      trpcQuery<Array<{
        id: string;
        name: string;
        status: string;
        prospects_count: number;
        sent: number;
        accepted: number;
        acceptance_rate: number;
      }>>('analytics.campaignPerformance'),
    prospectStatusDistribution: () =>
      trpcQuery<Array<{ status: string; count: number }>>(
        'analytics.prospectStatusDistribution'
      ),
    tokensBreakdown: (input: { range: 'today' | 'week' | 'month' | 'all' }) =>
      trpcQuery<Array<{ feature: string; total: number }>>(
        'analytics.tokensBreakdown',
        input
      ),
  },
  posts: {
    generate: (input: {
      topic: string;
      tones: string[];
      dialect: string;
      audience?: string;
      goal?: string;
      length?: 'short' | 'medium' | 'long';
      extras?: {
        hashtags?: boolean;
        callToAction?: boolean;
        emojis?: boolean;
        endingQuestion?: boolean;
        personalStory?: boolean;
      };
      useStyleSamples?: boolean;
      inspirationUrl?: string;
    }) =>
      trpcMutation<{
        id: string;
        dna: {
          topic: string;
          tones: string[];
          dialect: string;
          language: string;
          audience: string;
          goal: string;
          length: string;
          dnaScore: number;
        };
        variations: Array<{
          id: 'safe' | 'balanced' | 'bold';
          label: string;
          content: string;
          charCount: number;
          hook: string;
          hashtags: string[];
        }>;
        tips: string[];
        tokensUsed: number;
      }>('posts.generate', input),
    selectVariation: (input: {
      postId: string;
      variationId: 'safe' | 'balanced' | 'bold';
    }) => trpcMutation<{ success: boolean }>('posts.selectVariation', input),
    addStyleSample: (input: { content: string }) =>
      trpcMutation<{ id: string; styleAnalysis: any }>(
        'posts.addStyleSample',
        input
      ),
    listStyleSamples: () =>
      trpcQuery<
        Array<{
          id: string;
          content: string;
          style_analysis: any;
          created_at: string;
        }>
      >('posts.listStyleSamples'),
    deleteStyleSample: (input: { id: string }) =>
      trpcMutation<{ success: boolean }>('posts.deleteStyleSample', input),
    previewInspiration: (input: { url: string }) =>
      trpcMutation<{
        source: 'youtube' | 'article' | 'text';
        title: string;
        preview: string;
      }>('posts.previewInspiration', input),
    list: () => trpcQuery<any[]>('posts.list'),
    delete: (input: { id: string }) =>
      trpcMutation<{ success: boolean }>('posts.delete', input),
    update: (input: { id: string; patch: Record<string, any> }) =>
      trpcMutation<any>('posts.update', input),
  },
  agents: {
    list: () => trpcQuery<any[]>('agents.list'),
    startConversation: (input: { agentId: string; title?: string }) =>
      trpcMutation<any>('agents.startConversation', input),
    listConversations: (input?: { agentId?: string }) =>
      trpcQuery<any[]>('agents.listConversations', input || {}),
    getConversation: (input: { conversationId: string }) =>
      trpcQuery<{ conversation: any; messages: any[] }>('agents.getConversation', input),
    sendMessage: (input: { conversationId: string; content: string }) =>
      trpcMutation<{ content: string; tokensUsed: number }>('agents.sendMessage', input),
    deleteConversation: (input: { conversationId: string }) =>
      trpcMutation<any>('agents.deleteConversation', input),
    listTrainingNotes: (input: { agentId: string }) =>
      trpcQuery<any[]>('agents.listTrainingNotes', input),
    addTrainingNote: (input: { agentId: string; note: string }) =>
      trpcMutation<any>('agents.addTrainingNote', input),
    deleteTrainingNote: (input: { noteId: string }) =>
      trpcMutation<any>('agents.deleteTrainingNote', input),
  },
};
