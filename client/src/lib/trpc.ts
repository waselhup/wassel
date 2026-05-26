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
    balance: () => trpcQuery<{ balance: number; plan?: string; serverTimestamp?: string; profileUpdatedAt?: string | null }>('token.balance'),
    getMyBalance: () => trpcQuery<{ balance: number; plan?: string; serverTimestamp?: string; profileUpdatedAt?: string | null }>('token.getMyBalance'),
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
  finance: {
    pulse: () => trpcQuery<{
      mrr: { today: number; lastMonth: number; spark: number[] };
      arr: { today: number; lastMonth: number; spark: number[] };
      newRevenue: { today: number; lastMonth: number; spark: number[] };
      churn: { today: number; lostMrr: number; lastMonth: number; spark: number[] };
      netMargin: { today: number; lastMonth: number; spark: number[] };
      cashOnHand: { today: number; lastMonth: number; spark: number[] };
    }>('finance.pulse'),
    waterfall: () => trpcQuery<{
      startingMrr: number; newMrr: number; expansionMrr: number; churnedMrr: number; endingMrr: number;
    }>('finance.waterfall'),
    planBreakdown: () => trpcQuery<{
      breakdown: Array<{ plan: string; users: number; mrr: number; percentOfMrr: number; avgTokensPerMonth: number; costPerUserSar: number; marginPercent: number | null }>;
      totalMrr: number;
    }>('finance.planBreakdown'),
    payments: (input?: { limit?: number }) => trpcQuery<{
      successful: any[]; failed: any[]; refunds: any[];
    }>('finance.payments', input || {}),
    costControl: () => trpcQuery<{
      apiBreakdown: Array<{ key: string; tokens: number; cost_usd: number; cost_sar: number }>;
      totalCostUsd: number; totalCostSar: number;
      topDrivers: Array<{ id: string; email: string | null; full_name: string | null; plan: string; tokens_consumed: number; cost_sar: number; revenue_sar: number; net_margin_sar: number }>;
      negativeMarginAlert: any | null;
    }>('finance.costControl'),
    exportCsv: (input: { month: string }) => trpcQuery<{
      csv: string; filename: string; totalRows: number; totalAmountSar: number; totalVatSar: number;
    }>('finance.exportCsv', input),
    updateSetting: (input: { key: 'cash_on_hand_sar' | 'usd_sar_rate' | 'apify_monthly_cost_usd' | 'infra_monthly_cost_usd'; value: number }) =>
      trpcMutation<{ success: boolean; key: string; value: number }>('finance.updateSetting', input),
    generateInvoice: (input: { userId: string; amountSar: number; description: string }) =>
      trpcMutation<{ paymentId: string; invoiceUrl: string; invoiceId: string }>('finance.generateInvoice', input),
    refundPayment: (input: { moyasarPaymentId: string; reason: string }) =>
      trpcMutation<{ success: boolean; paymentId: string; amountSar: number; note: string }>('finance.refundPayment', input),
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
    dashboardOverview: () => trpcQuery<{
      signups: { today: number; yesterday: number; spark: number[] };
      activated: { today: number; yesterday: number; spark: number[] };
      paying: { today: number; yesterday: number; spark: number[] };
      mrr: { today: number; yesterday: number; spark: number[] };
      tokensBurned: { today: number; yesterday: number; spark: number[] };
      fires: { today: number; yesterday: number; spark: number[]; breakdown: { errors: number; banned: number; failedPayments: number } };
    }>('admin.dashboardOverview'),
    funnel: () => trpcQuery<{
      stages: Array<{ key: string; count: number }>;
      biggestDropIdx: number;
      biggestDropPct: number;
    }>('admin.funnel'),
    cohorts: () => trpcQuery<{
      hotProspects: Array<any>;
      churnRisk: Array<any>;
      heroes: Array<any>;
    }>('admin.cohorts'),
    tokenEconomy: () => trpcQuery<{
      burnByCategory: Array<{ key: string; tokens: number; cost_usd: number }>;
      top10Consumers: Array<any>;
      totalCostUSD: number;
      marginAlert: any | null;
    }>('admin.tokenEconomy'),
    growthSignals: () => trpcQuery<{
      activationRate30d: number;
      ttfvMinutes: number | null;
      kbExportRate: number;
      localeSplit: { ar: number; en: number; other: number };
      activationSpark: number[];
      signupsCount: number;
      activatedCount: number;
    }>('admin.growthSignals'),
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
    pulse: () => trpcQuery<{
      signups: { today: number; yesterday: number; spark: number[] };
      activeSubs: { today: number; lastWeek: number; spark: number[] };
      expiringSoon: { today: number; lastWeek: number; spark: number[] };
      failedHooks: { today: number; yesterday: number; spark: number[] };
      apiErrors1h: { today: number; yesterday: number; spark: number[] };
      openIncidents: { today: number; yesterday: number; spark: number[]; signupsLastWeek: number };
    }>('ops.pulse'),
    signupFunnel: (input?: { days?: number }) =>
      trpcQuery<{ stages: Array<{ key: string; count: number }>; biggestDropIdx: number; biggestDropPct: number }>('ops.signupFunnel', input || {}),
    signupFeed: (input?: { limit?: number }) =>
      trpcQuery<{ events: Array<any>; abandonedLastHour: number }>('ops.signupFeed', input || {}),
    subscriptions: (input?: { status?: 'active' | 'expiring' | 'past_due' | 'canceled' | 'new_month'; limit?: number; offset?: number }) =>
      trpcQuery<{ rows: Array<any>; total: number }>('ops.subscriptions', input || {}),
    subscriptionAction: (input: { subscriptionId: string; action: 'extend' | 'cancel' | 'mark_paid'; days?: number }) =>
      trpcMutation<{ success: boolean; action: string }>('ops.subscriptionAction', input),
    servicesHealth: () => trpcQuery<{
      checkedAt: string;
      services: Array<{ key: string; status: 'healthy' | 'watch' | 'critical'; metric: any; last_checked: string }>;
    }>('ops.servicesHealth'),
    runHealthCheck: (input: { service: string }) =>
      trpcMutation<{ success: boolean; service: string }>('ops.runHealthCheck', input),
    webhooks: (input?: { limit?: number }) =>
      trpcQuery<{ rows: Array<any> }>('ops.webhooks', input || {}),
    retryFulfillment: (input: { paymentTransactionId: string }) =>
      trpcMutation<{ success: boolean; note: string }>('ops.retryFulfillment', input),
    crons: () => trpcQuery<{
      crons: Array<{ name: string; path: string; schedule: string; last_run: string | null; last_status: 'ok' | 'fail' | 'unknown' }>;
    }>('ops.crons'),
    triggerCron: (input: { endpoint: string }) =>
      trpcMutation<{ success: boolean; status: number; error?: string }>('ops.triggerCron', input),
    incidents: (input?: { status?: 'open' | 'investigating' | 'resolved' | 'dismissed' | 'all' }) =>
      trpcQuery<{ rows: Array<any> }>('ops.incidents', input || {}),
    createIncident: (input: { severity: 'info' | 'warning' | 'error' | 'critical'; title: string; description?: string; affected_service?: string }) =>
      trpcMutation<{ success: boolean; id: string }>('ops.createIncident', input),
    updateIncident: (input: { id: string; status: 'investigating' | 'resolved' | 'dismissed'; resolution_notes?: string }) =>
      trpcMutation<{ success: boolean }>('ops.updateIncident', input),
    broadcastEmail: (input: { subject_ar: string; subject_en: string; body_ar: string; body_en: string; audience: 'all' | 'paid' | 'free' }) =>
      trpcMutation<{ success: boolean; recipientCount: number; note: string }>('ops.broadcastEmail', input),
    toggleMaintenanceMode: (input: { enabled: boolean; message_ar?: string; message_en?: string }) =>
      trpcMutation<{ success: boolean; enabled: boolean }>('ops.toggleMaintenanceMode', input),
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
  document: {
    parse: (input: { fileBase64: string; fileName: string; mimeType: string }) =>
      trpcMutation<{
        text: string;
        method: 'pdf-text' | 'pdf-ocr' | 'docx' | 'image-ocr' | 'text';
        documentType: 'pdf' | 'docx' | 'image' | 'text';
        pageCount: number;
        confidence: number;
        warnings: string[];
        textLength: number;
      }>('document.parse', input),
  },
  pricing: {
    getPlans: () => trpcQuery<Array<{
      id: string;
      name_ar: string; name_en: string;
      tagline_ar: string | null; tagline_en: string | null;
      monthly_price_sar: string; annual_price_sar: string | null;
      monthly_tokens: number;
      display_order: number;
      is_featured: boolean; is_custom: boolean; is_free: boolean;
      badge_ar: string | null; badge_en: string | null;
      features: Array<{
        id: string; plan_id: string; feature_key: string;
        feature_ar: string; feature_en: string;
        is_included: boolean; is_coming_soon: boolean; is_highlighted: boolean;
        display_order: number;
      }>;
    }>>('pricing.getPlans'),
    getProducts: () => trpcQuery<Array<{
      id: string;
      name_ar: string; name_en: string;
      description_ar: string | null; description_en: string | null;
      price_sar: string;
      category: string;
      token_cost: number;
      is_bundle: boolean;
      bundle_items: any | null;
      display_order: number;
    }>>('pricing.getProducts'),
    createGuestAccount: (input: { fullName: string; phone: string; email: string }) =>
      trpcMutation<
        | { kind: 'existing_email'; email: string }
        | {
            kind: 'created';
            userId: string;
            session: { access_token: string; refresh_token: string };
          }
      >('pricing.createGuestAccount', input),
    getCurrentSubscription: () => trpcQuery<any | null>('pricing.getCurrentSubscription'),
    getTokenBalance: () => trpcQuery<{
      balance: number; totalPurchased: number; totalUsed: number; lastUpdated: string | null;
    }>('pricing.getTokenBalance'),
    getTransactionHistory: (input?: { limit?: number; offset?: number }) =>
      trpcQuery<{ tokenTransactions: any[]; paymentTransactions: any[] }>(
        'pricing.getTransactionHistory', input || {}
      ),
    subscribeToPlan: (input: { planId: string; billingCycle: 'monthly' | 'annual' }) =>
      trpcMutation<{
        paymentId: string; amount: number; currency: 'SAR';
        planId: string; billingCycle: 'monthly' | 'annual';
        muyassarCheckoutUrl: string | null;
      }>('pricing.subscribeToPlan', input),
    cancelSubscription: () => trpcMutation<{ success: boolean }>('pricing.cancelSubscription'),
    purchaseTokens: (input: { quantity: number }) =>
      trpcMutation<{
        paymentId: string; amount: number; currency: 'SAR';
        quantity: number; muyassarCheckoutUrl: string | null;
      }>('pricing.purchaseTokens', input),
    purchaseProduct: (input: { productId: string }) =>
      trpcMutation<{
        paymentId: string; amount: number; currency: 'SAR';
        productId: string; muyassarCheckoutUrl: string | null;
      }>('pricing.purchaseProduct', input),
    getPaymentStatus: (input: { transactionId: string }) =>
      trpcQuery<{
        id: string;
        status: 'pending' | 'completed' | 'failed' | 'cancelled' | string;
        type: 'subscription' | 'token_topup' | 'product' | string;
        amount_sar: string | number;
        currency: string;
        completed_at: string | null;
        metadata: Record<string, any> | null;
        reference_id: string | null;
        reference_type: string | null;
      }>('pricing.getPaymentStatus', input),
  },
  faris: {
    listAgents: () => trpcQuery<Array<{
      id: string; name_ar: string; name_en: string; role_ar: string; role_en: string;
      portal: string; approval_mode: 'approval_required' | 'suggest_only' | 'auto_with_bounds' | 'auto';
      argue_mode_enabled: boolean; monthly_token_budget: number; is_active: boolean;
      avatar_color: string; avatar_icon: string;
      tokens_this_month: number; cost_sar_this_month: number;
      pending_tasks: number; completed_this_month: number; over_budget: boolean;
    }>>('faris.listAgents'),
    getApprovalQueue: (input?: { filter?: 'pending' | 'edited' | 'executing' | 'all'; agentId?: string; limit?: number }) =>
      trpcQuery<{ rows: any[] }>('faris.getApprovalQueue', input || {}),
    getTask: (input: { taskId: string }) =>
      trpcQuery<{ task: any; arguments: any[] }>('faris.getTask', input),
    approveTask: (input: { taskId: string; editedPayload?: Record<string, any> }) =>
      trpcMutation<{ success: boolean; taskId: string }>('faris.approveTask', input),
    rejectTask: (input: { taskId: string; reason: string }) =>
      trpcMutation<{ success: boolean }>('faris.rejectTask', input),
    replyToArgue: (input: { taskId: string; message: string }) =>
      trpcMutation<{ agentReply: string | null; note?: string }>('faris.replyToArgue', input),
    morningBrief: () =>
      trpcQuery<{ signups: number; paid: number; pending: number; adSpendSar: number; generatedAt: string }>('faris.morningBrief'),
    dailyVitals: () =>
      trpcQuery<{
        signupsToday: number; paidToday: number; mrrSar: number; adSpendSar: number;
        pendingApprovals: number; agentTokenSpendSar: number; errors24h: number; churnedThisMonth: number;
      }>('faris.dailyVitals'),
    agentCostReport: (input?: { agentId?: string; days?: number }) =>
      trpcQuery<{
        sinceDays: number;
        breakdown: Array<{ agentId: string; tokens: number; calls: number; costUsd: number; costSar: number }>;
        totalCostSar: number; totalCostUsd: number;
      }>('faris.agentCostReport', input || {}),
    readContextFile: () => trpcQuery<{ content: string }>('faris.readContextFile'),
    updateContextFile: (input: { content: string }) =>
      trpcMutation<{ success: boolean }>('faris.updateContextFile', input),
    toggleAgentMode: (input: { agentId: string; mode: 'approval_required' | 'suggest_only' | 'auto_with_bounds' | 'auto' }) =>
      trpcMutation<{ success: boolean }>('faris.toggleAgentMode', input),
    updateAgentBudget: (input: { agentId: string; monthlyTokenBudget: number }) =>
      trpcMutation<{ success: boolean }>('faris.updateAgentBudget', input),
  },
  sayed: {
    generateMonthlyBatch: (input: { platforms: string[]; themes?: string[]; postsPerPlatform?: number }) =>
      trpcMutation<{ tasksCreated: number; totalEstimatedCostSar: number }>('sayed.generateMonthlyBatch', input),
    draftSinglePost: (input: { platform: string; topic: string; sourceUrl?: string }) =>
      trpcMutation<{ taskId: string }>('sayed.draftSinglePost', input),
    draftAdCampaign: (input: { channel: string; objective: string; dailyBudgetSar: number; targetAudience: string }) =>
      trpcMutation<{ campaignTaskId: string; creativeVariants: number }>('sayed.draftAdCampaign', input),
    listContentCalendar: (input?: { startDate?: string; endDate?: string; platform?: string }) =>
      trpcQuery<{ items: any[] }>('sayed.listContentCalendar', input || {}),
    listAdCampaigns: (input?: { status?: string }) =>
      trpcQuery<{ campaigns: any[] }>('sayed.listAdCampaigns', input || {}),
    publishApprovedContent: (input: { contentId: string }) =>
      trpcMutation<{ success: boolean; note: string }>('sayed.publishApprovedContent', input),
    killCampaign: (input: { campaignId: string; reason: string }) =>
      trpcMutation<{ success: boolean }>('sayed.killCampaign', input),
    repurposeFromRss: (input: { feedUrl: string }) =>
      trpcMutation<{ itemsRead: number; tasksQueued: number }>('sayed.repurposeFromRss', input),
  },
  alMukhadram: {
    draftWelcomeSequence: () => trpcMutation<{ tasksCreated: number; sequenceId: string | null }>('alMukhadram.draftWelcomeSequence', {}),
    draftDailyRescues: (input?: { limit?: number }) => trpcMutation<{ tasksCreated: number; cohorts: any }>('alMukhadram.draftDailyRescues', input || {}),
    draftSupportReply: (input: { userId: string; inboundMessage: string; channel: 'whatsapp' | 'email' }) =>
      trpcMutation<{ taskId: string }>('alMukhadram.draftSupportReply', input),
    flagVips: () => trpcMutation<{ count: number }>('alMukhadram.flagVips', {}),
    listEnrollments: (input?: { status?: string; sequenceName?: string }) => trpcQuery<any[]>('alMukhadram.listEnrollments', input || {}),
    enrollUser: (input: { userId: string; sequenceName: string }) => trpcMutation<any>('alMukhadram.enrollUser', input),
    exitUser: (input: { userId: string; sequenceName: string; reason?: string }) => trpcMutation<any>('alMukhadram.exitUser', input),
    healthScore: (input: { userId: string }) => trpcMutation<any>('alMukhadram.healthScore', input),
    recomputeAllScores: (input?: { limit?: number }) => trpcMutation<{ updated: number }>('alMukhadram.recomputeAllScores', input || {}),
    healthCohorts: () => trpcQuery<Record<string, number>>('alMukhadram.healthCohorts'),
    listHealthScores: (input?: { segment?: string; limit?: number }) => trpcQuery<any[]>('alMukhadram.listHealthScores', input || {}),
    listWhatsappMessages: (input?: { userId?: string; limit?: number }) => trpcQuery<any[]>('alMukhadram.listWhatsappMessages', input || {}),
    listEmailMessages: (input?: { userId?: string; limit?: number }) => trpcQuery<any[]>('alMukhadram.listEmailMessages', input || {}),
    sendApprovedMessage: (input: { taskId: string }) => trpcMutation<{ sent: number; errors: string[] }>('alMukhadram.sendApprovedMessage', input),
  },
  hassan: {
    draftHotUpgradePitches: (input?: { limit?: number; minPropensity?: number }) =>
      trpcMutation<{ tasksCreated: number }>('hassan.draftHotUpgradePitches', input || {}),
    draftPitchForUser: (input: { userId: string; trigger: string; surface: string; experimentId?: string }) =>
      trpcMutation<{ pitchId: string | null; taskId: string | null }>('hassan.draftPitchForUser', input),
    listPendingPitches: () => trpcQuery<any[]>('hassan.listPendingPitches'),
    approvePitch: (input: { pitchId: string }) => trpcMutation<{ ok: boolean }>('hassan.approvePitch', input),
    rejectPitch: (input: { pitchId: string }) => trpcMutation<{ ok: boolean }>('hassan.rejectPitch', input),
    listExperiments: (input?: { status?: string }) => trpcQuery<any[]>('hassan.listExperiments', input || {}),
    proposeExperiment: (input: { surface: string; hypothesis: string }) =>
      trpcMutation<{ experimentId: string | null; taskId: string }>('hassan.proposeExperiment', input),
    startExperiment: (input: { experimentId: string }) => trpcMutation<{ ok: boolean }>('hassan.startExperiment', input),
    killExperiment: (input: { experimentId: string; reason?: string }) => trpcMutation<{ ok: boolean }>('hassan.killExperiment', input),
    hotLeads: (input?: { limit?: number }) => trpcQuery<any[]>('hassan.hotLeads', input || {}),
    referralCodes: (input?: { userId?: string }) => trpcQuery<any[]>('hassan.referralCodes', input || {}),
    createReferralCode: (input?: { userId?: string; rewardInviter?: number; rewardInvitee?: number; maxUses?: number }) =>
      trpcMutation<{ code: string }>('hassan.createReferralCode', input || {}),
    redeemReferralCode: (input: { code: string; inviteeUserId: string }) =>
      trpcMutation<any>('hassan.redeemReferralCode', input),
    servePitch: (input: { surface: string }) => trpcQuery<any>('hassan.servePitch', input),
    recordPitchClick: (input: { pitchId: string }) => trpcMutation<{ ok: boolean }>('hassan.recordPitchClick', input),
    recordConversion: (input: { userId: string; amountSar: number; pitchId?: string }) =>
      trpcMutation<{ ok: boolean }>('hassan.recordConversion', input),
  },
  fatima: {
    detectFrictionPatterns: (input?: { lookbackDays?: number }) =>
      trpcMutation<{ patternsFound: number }>('fatima.detectFrictionPatterns', input || {}),
    listFrictionPatterns: (input?: { severity?: string; status?: string }) =>
      trpcQuery<any[]>('fatima.listFrictionPatterns', input || {}),
    acknowledgePattern: (input: { patternId: string }) => trpcMutation<{ ok: boolean }>('fatima.acknowledgePattern', input),
    dismissPattern: (input: { patternId: string; reason?: string }) => trpcMutation<{ ok: boolean }>('fatima.dismissPattern', input),
    generateWeeklyReport: () => trpcMutation<{ reportId: string | null }>('fatima.generateWeeklyReport', {}),
    latestWeeklyReport: () => trpcQuery<any>('fatima.latestWeeklyReport'),
    computeFunnel: (input: { feature: string; startDate: string; endDate: string }) =>
      trpcMutation<{ stages: Array<{ name: string; users: number }> }>('fatima.computeFunnel', input),
    digestUserVoice: () => trpcMutation<{ themes: any[] }>('fatima.digestUserVoice', {}),
    captureEvent: (input: { event: string; properties?: any; distinctId?: string; sessionId?: string; pageUrl?: string }) =>
      trpcMutation<{ ok: boolean }>('fatima.captureEvent', input),
  },
  dhai: {
    scanNewSignup: (input: { userId: string }) => trpcMutation<any>('dhai.scanNewSignup', input),
    moderateContent: (input: { contentId: string; contentType: string; scannedText: string; language?: string; sourceAgent?: string }) =>
      trpcMutation<{ decision: 'approved' | 'flagged' | 'blocked'; violations: string[] }>('dhai.moderateContent', input),
    checkLinkedinTos: (input: { text: string }) => trpcMutation<{ ok: boolean; hits: string[] }>('dhai.checkLinkedinTos', input),
    listFraudSignals: (input?: { status?: string; severity?: string; limit?: number }) =>
      trpcQuery<any[]>('dhai.listFraudSignals', input || {}),
    reviewSignal: (input: { signalId: string; decision: 'confirmed_fraud' | 'false_positive' | 'resolved'; notes?: string }) =>
      trpcMutation<{ ok: boolean }>('dhai.reviewSignal', input),
    logPdplEvent: (input: { eventType: string; userId?: string; dataCategory?: string; details?: any }) =>
      trpcMutation<{ ok: boolean }>('dhai.logPdplEvent', input),
    pdplAuditLog: (input?: { userId?: string; eventType?: string; limit?: number }) =>
      trpcQuery<any[]>('dhai.pdplAuditLog', input || {}),
    contentModerationLog: (input?: { decision?: 'approved' | 'flagged' | 'blocked'; limit?: number }) =>
      trpcQuery<any[]>('dhai.contentModerationLog', input || {}),
    dailySweep: () => trpcMutation<{ openSignals: number; flaggedContent: number; pdplEvents: number }>('dhai.dailySweep', {}),
  },
  hussein: {
    listKnownPatterns: () => trpcQuery<any[]>('hussein.listKnownPatterns'),
    seedDefaultPatterns: () => trpcMutation<{ seeded: number }>('hussein.seedDefaultPatterns', {}),
    autoResolveErrors: () => trpcMutation<{ scanned: number; resolved: number; novel: number }>('hussein.autoResolveErrors', {}),
    servicesHealthCheck: () => trpcMutation<Record<string, any>>('hussein.servicesHealthCheck', {}),
    recentResolutions: (input?: { limit?: number }) => trpcQuery<any[]>('hussein.recentResolutions', input || {}),
    createIncident: (input: { error: string; severity: 'low' | 'medium' | 'high' | 'critical'; service?: string }) =>
      trpcMutation<{ incidentId: string | null }>('hussein.createIncident', input),
  },
  mohammed: {
    reconcileMoyasarDaily: () => trpcMutation<{ checked: number; new: number; mismatches: number }>('mohammed.reconcileMoyasarDaily', {}),
    generateInvoice: (input: { paymentTransactionId: string }) =>
      trpcMutation<{ invoiceId: string; invoiceNumber: string; qrBase64: string } | null>('mohammed.generateInvoice', input),
    listInvoices: (input?: { status?: string; userId?: string; limit?: number }) =>
      trpcQuery<any[]>('mohammed.listInvoices', input || {}),
    myInvoices: () => trpcQuery<any[]>('mohammed.myInvoices'),
    dailySnapshot: () => trpcMutation<{ snapshotId: string | null }>('mohammed.dailySnapshot', {}),
    financeKpis: (input?: { days?: number }) => trpcQuery<any[]>('mohammed.financeKpis', input || {}),
    predictRunway: () => trpcMutation<{ runwayDays: number; dailyBurnSar: number; cashSar: number }>('mohammed.predictRunway', {}),
    marginAlerts: () => trpcMutation<{ alerts: any[] }>('mohammed.marginAlerts', {}),
    weeklyReport: () => trpcMutation<{ summary: string }>('mohammed.weeklyReport', {}),
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
  careerProfile: {
    get: () => trpcQuery<{ profile: any | null }>('careerProfile.get'),
    wallets: () => trpcQuery<{
      bonus:        { balance: number; expires_at: string | null; expired: boolean };
      subscription: { balance: number; renews_at:  string | null };
      topup:        { balance: number };
      total:        number;
    }>('careerProfile.wallets'),
    create: (input: {
      goal: 'job_search' | 'promotion' | 'personal_brand' | 'opportunities' | 'career_change';
      level: 'entry' | 'mid' | 'senior' | 'executive';
      target_role: string;
      industry: string;
      primary_language: 'ar' | 'en';
      linkedin_url?: string | null;
      manual_about?: string | null;
      manual_top_skills?: string[] | null;
      manual_current_role?: string | null;
      manual_years_experience?: number | null;
      manual_education?: string | null;
    }) => trpcMutation<{ profile: any }>('careerProfile.create', input),
    update: (input: Record<string, unknown>) =>
      trpcMutation<{ profile: any }>('careerProfile.update', input),
    delete: () => trpcMutation<{ success: boolean }>('careerProfile.delete', {}),
    listOverrides: () => trpcQuery<{ overrides: any[] }>('careerProfile.listOverrides'),
    sectionOverride: (input: {
      section: 'radar' | 'resume' | 'content';
      payload: Record<string, unknown>;
      expires_in_hours?: number;
    }) => trpcMutation<{ override: any }>('careerProfile.sectionOverride', input),
    deleteOverride: (input: { id: string }) =>
      trpcMutation<{ success: boolean }>('careerProfile.deleteOverride', input),
    export: () => trpcMutation<{ data: Record<string, unknown> }>('careerProfile.export', {}),
    deleteAllData: () =>
      trpcMutation<{ success: boolean; errors: string[] }>('careerProfile.deleteAllData', { confirm: true }),
  },
  warRoom: {
    getPersonalities: () =>
      trpcQuery<{ personalities: Array<{
        agent_id: string;
        age: number;
        speech_style_ar: string; speech_style_en: string;
        catchphrases_ar: string[] | null; catchphrases_en: string[] | null;
        expressions: string[];
        default_expression: string;
        table_seat: number;
        voice_pitch: number; voice_rate: number;
        signature_animation: string | null;
        system_prompt_extension_ar: string; system_prompt_extension_en: string;
      }> }>('warRoom.getPersonalities'),
    startSession: (input: { language?: 'ar' | 'en'; voiceEnabled?: boolean }) =>
      trpcMutation<{ sessionId: string }>('warRoom.startSession', input),
    endSession: (input: { sessionId: string }) =>
      trpcMutation<{ success: boolean }>('warRoom.endSession', input),
    sessionStats: () =>
      trpcQuery<{ totalSessions: number; totalMessages: number; totalDecisions: number }>('warRoom.sessionStats'),
    morningBrief: (input: { sessionId: string; language?: 'ar' | 'en' }) =>
      trpcMutation<{ briefs: Array<{ agentId: string; message: string; expression: string; turnId: string }> }>('warRoom.morningBrief', input),
    sendMessage: (input: { sessionId: string; message: string; language?: 'ar' | 'en'; voiceEnabled?: boolean }) =>
      trpcMutation<{
        aliTurnId: string;
        replies: Array<{ agentId: string; message: string; expression: string; turnId: string }>;
      }>('warRoom.sendMessage', input),
    listMessages: (input: { sessionId: string; limit?: number }) =>
      trpcQuery<{ turns: Array<{
        id: string; speaker_type: 'ali' | 'agent'; speaker_id: string | null;
        message: string; language: 'ar' | 'en'; expression: string | null; created_at: string;
      }> }>('warRoom.listMessages', input),
    recordDecision: (input: {
      agentId: string;
      conversationId?: string | null;
      decisionType: 'approve' | 'reject' | 'edit' | 'approve_with_changes' | 'ask_question' | 'defer';
      originalProposal: string;
      aliResponse?: string;
      aliEdit?: string;
      rejectionReason?: string;
      topicTags?: string[];
    }) => trpcMutation<{ id: string }>('warRoom.recordDecision', input),
    getDecisionMemory: (input: { agentId: string; limit?: number; topicTags?: string[] }) =>
      trpcQuery<{ decisions: Array<{
        decision_type: string;
        original_proposal: string;
        ali_response: string | null;
        ali_edit: string | null;
        topic_tags: string[] | null;
        created_at: string;
      }> }>('warRoom.getDecisionMemory', input),
    agentMemoryStats: () =>
      trpcQuery<{ counts: Array<{ agentId: string; count: number }> }>('warRoom.agentMemoryStats'),
    attachScreenContent: (input: {
      conversationId: string;
      contentType: 'chart' | 'table' | 'text' | 'image' | 'funnel' | 'kpi' | 'comparison';
      titleAr?: string;
      titleEn?: string;
      payload: Record<string, unknown>;
      displayDurationSeconds?: number;
    }) => trpcMutation<{ id: string }>('warRoom.attachScreenContent', input),
    getScreenContent: (input: { conversationId: string }) =>
      trpcQuery<{ content: Array<{
        id: string;
        conversation_id: string;
        content_type: string;
        title_ar: string | null;
        title_en: string | null;
        payload: any;
        display_duration_seconds: number;
        created_at: string;
      }> }>('warRoom.getScreenContent', input),
    weeklyJournal: (input?: { weekStart?: string }) =>
      trpcQuery<{ journal: {
        id: string;
        week_start: string;
        observations_ar: string;
        observations_en: string;
        patterns_detected: any;
        decisions_analyzed: number;
        created_at: string;
      } | null }>('warRoom.weeklyJournal', input || {}),
    generateWeeklyJournal: (input?: { language?: 'ar' | 'en' }) =>
      trpcMutation<{ id: string; created: boolean }>('warRoom.generateWeeklyJournal', input || {}),
  },
  radar: {
    preflight: () => trpcQuery<{
      ready: boolean;
      profile: {
        target_role: string;
        industry: string;
        linkedin_url: string | null;
        primary_language: 'ar' | 'en';
      } | null;
      cost: number;
      hasCache: boolean;
      latestCacheId: string | null;
      latestCachedAt: string | null;
      triggers: Array<{ type: string; metadata?: Record<string, unknown> }>;
    }>('radar.preflight'),
    run: (input?: { overrideTargetRole?: string; language?: 'ar' | 'en'; forceRefresh?: boolean }) =>
      trpcMutation<{
        cacheId: string;
        analysisId: string;
        isCacheHit: boolean;
        tokensCharged: number;
        walletUsed: 'bonus' | 'subscription' | 'topup' | 'mixed' | null;
        result: RadarResultShape;
      }>('radar.run', input ?? {}),
    getCached: (input?: { cacheId?: string }) =>
      trpcQuery<{
        cacheId: string;
        targetRole: string;
        language: 'ar' | 'en';
        result: RadarResultShape;
        currentScore: number;
        targetScore: number;
        sourceLinkedinUrl: string | null;
        hitCount: number;
        createdAt: string;
        lastAccessedAt: string;
      }>('radar.getCached', input ?? {}),
    history: (input?: { limit?: number }) =>
      trpcQuery<{
        analyses: Array<{
          id: string;
          cache_id: string | null;
          target_role: string;
          is_cache_hit: boolean;
          tokens_charged: number;
          wallet_used: string | null;
          current_score: number | null;
          target_score: number | null;
          language: 'ar' | 'en';
          duration_ms: number | null;
          created_at: string;
        }>;
      }>('radar.history', input ?? {}),
    applyFix: (input: { cacheId: string; fixIndex: number }) =>
      trpcMutation<{ success: boolean; appliedFixId: string }>('radar.applyFix', input),
    revertFix: (input: { appliedFixId: string }) =>
      trpcMutation<{ success: boolean }>('radar.revertFix', input),
    refreshTriggers: () =>
      trpcQuery<{
        hasTriggered: boolean;
        triggers: Array<{ type: string; metadata?: Record<string, unknown> }>;
      }>('radar.refreshTriggers'),
    markTriggerActedUpon: (input: { triggerId: string }) =>
      trpcMutation<{ success: boolean }>('radar.markTriggerActedUpon', input),
    sessionOverride: (input: { targetRole: string; expiresInHours?: number }) =>
      trpcMutation<{ override: { id: string; section: string; payload: Record<string, unknown>; expires_at: string } }>(
        'radar.sessionOverride',
        input,
      ),
    clearOverride: (input: { overrideId: string }) =>
      trpcMutation<{ success: boolean }>('radar.clearOverride', input),
  },
  resume: {
    preflight: (input?: { language?: 'ar' | 'en' }) =>
      trpcQuery<{
        ready: boolean;
        profile: {
          target_role: string;
          industry: string;
          level: 'entry' | 'mid' | 'senior' | 'executive';
          linkedin_url: string | null;
          primary_language: 'ar' | 'en';
        } | null;
        recommendedTemplate: ResumeTemplateShape | null;
        alternativeTemplates: ResumeTemplateShape[];
        hasCache: boolean;
        latestCacheId: string | null;
        latestVersionId: string | null;
        estimatedCost: number;
        activeVersionsCount: number;
        archivedCount: number;
        legacyCount: number;
      }>('resume.preflight', input ?? {}),
    listVersions: (input?: { status?: 'active' | 'archived' | 'legacy' | 'all'; limit?: number }) =>
      trpcQuery<{ versions: ResumeVersionRow[] }>('resume.listVersions', input ?? {}),
    getVersion: (input: { versionId: string }) =>
      trpcQuery<{
        version: ResumeVersionRow & { cache_id: string | null };
        cache: {
          id: string;
          result: ResumeShape;
          ats_score: number;
          ats_breakdown: ResumeAtsBreakdownShape;
          created_at: string;
          template_id: string;
        } | null;
        refinementsUsed: number;
        freeRefinementsPerVersion: number;
        paidRefinementCost: number;
      }>('resume.getVersion', input),
    getCached: (input: { cacheId: string }) =>
      trpcQuery<{
        cacheId: string;
        targetRole: string;
        templateId: string;
        language: 'ar' | 'en';
        result: ResumeShape;
        atsScore: number;
        atsBreakdown: ResumeAtsBreakdownShape;
        isFullBuild: boolean;
        parentResumeId: string | null;
        hitCount: number;
        createdAt: string;
        lastAccessedAt: string;
      }>('resume.getCached', input),
    listTemplates: (input?: { language?: 'ar' | 'en' }) =>
      trpcQuery<{ templates: ResumeTemplateShape[] }>('resume.listTemplates', input ?? {}),
    recommendTemplate: (input?: { overrideTargetRole?: string; language?: 'ar' | 'en' }) =>
      trpcQuery<{ primary: ResumeTemplateShape; alternatives: ResumeTemplateShape[] }>(
        'resume.recommendTemplate',
        input ?? {},
      ),
    build: (input: {
      templateId: string;
      overrideTargetRole?: string;
      language?: 'ar' | 'en';
      forceRefresh?: boolean;
    }) => trpcMutation<{
      cacheId: string;
      versionId: string;
      isCacheHit: boolean;
      tokensCharged: number;
      walletUsed: 'bonus' | 'subscription' | 'topup' | 'mixed' | null;
      atsScore: number;
      atsBreakdown: ResumeAtsBreakdownShape;
      result: ResumeShape;
    }>('resume.build', input),
    createNewVersion: (input: {
      parentCacheId: string;
      newTargetRole: string;
      templateId: string;
      language?: 'ar' | 'en';
    }) => trpcMutation<{
      cacheId: string;
      versionId: string;
      isCacheHit: boolean;
      tokensCharged: number;
      walletUsed: 'bonus' | 'subscription' | 'topup' | 'mixed' | null;
      atsScore: number;
      atsBreakdown: ResumeAtsBreakdownShape;
      result: ResumeShape;
    }>('resume.createNewVersion', input),
    refine: (input: {
      versionId: string;
      chipType: string;
      customPrompt?: string;
      targetSection?: string;
      language?: 'ar' | 'en';
    }) => trpcMutation<{
      result: ResumeShape;
      atsScore: number;
      atsBreakdown: ResumeAtsBreakdownShape;
      tokensCharged: number;
      refinementIndex: number;
      isFreeWindow: boolean;
      remainingFree: number;
      cacheId: string;
    }>('resume.refine', input),
    archive: (input: { versionId: string }) =>
      trpcMutation<{ success: boolean }>('resume.archive', input),
    restore: (input: { versionId: string }) =>
      trpcMutation<{ success: boolean }>('resume.restore', input),
    exportPdf: (input: { versionId: string }) =>
      trpcMutation<{ filename: string; mimeType: string; base64: string }>('resume.exportPdf', input),
    exportDocx: (input: { versionId: string }) =>
      trpcMutation<{ filename: string; mimeType: string; base64: string }>('resume.exportDocx', input),
    exportJson: (input: { versionId: string }) =>
      trpcMutation<{ filename: string; mimeType: string; base64: string }>('resume.exportJson', input),
    history: (input?: { limit?: number }) =>
      trpcQuery<{ versions: ResumeVersionRow[] }>('resume.history', input ?? {}),
    sessionOverride: (input: { targetRole: string; expiresInHours?: number }) =>
      trpcMutation<{ override: { id: string; section: string; payload: Record<string, unknown>; expires_at: string } }>(
        'resume.sessionOverride',
        input,
      ),
  },
  content: {
    preflight: (input: {
      contentType: ContentTypeShape;
      topic?: string;
      sourcePostId?: string;
      language?: 'ar' | 'en';
    }) => trpcQuery<{
      hasCareerProfile: boolean;
      profile: {
        goal: string;
        level: string;
        target_role: string;
        industry: string;
        primary_language: 'ar' | 'en';
      } | null;
      contentType: ContentTypeShape;
      estimatedCost: number;
      hasCacheHit: boolean;
      latestCacheId: string | null;
      latestVersionId: string | null;
      suggestions: TopicSuggestionShape[];
      activeContentCount: number;
      archivedCount: number;
      legacyCount: number;
    }>('content.preflight', input),
    listVersions: (input?: {
      contentType?: ContentTypeShape;
      status?: 'active' | 'archived' | 'published_externally' | 'legacy' | 'all';
      limit?: number;
    }) => trpcQuery<{ versions: ContentVersionRow[] }>('content.listVersions', input ?? {}),
    getVersion: (input: { versionId: string }) =>
      trpcQuery<{
        version: ContentVersionRow & { cache_id: string | null };
        cache: {
          id: string;
          result: ContentResultShape;
          content_type: ContentTypeShape;
          topic: string;
          source_post_id: string | null;
          created_at: string;
          expires_at: string;
          hit_count: number;
        } | null;
        refinementsUsed: number;
        freeRefinementsPerVersion: number;
        paidRefinementCost: number;
        pendingReminder: {
          id: string;
          remind_at: string;
          status: string;
          notification_channel: string[];
        } | null;
      }>('content.getVersion', input),
    getCached: (input: { cacheId: string }) =>
      trpcQuery<{
        cacheId: string;
        contentType: ContentTypeShape;
        topic: string;
        sourcePostId: string | null;
        language: 'ar' | 'en';
        result: ContentResultShape;
        tokensCharged: number;
        hitCount: number;
        createdAt: string;
        lastAccessedAt: string;
        expiresAt: string;
      }>('content.getCached', input),
    generatePost: (input: { topic: string; language?: 'ar' | 'en'; forceRefresh?: boolean }) =>
      trpcMutation<ContentGenerateResultShape>('content.generatePost', input),
    generateCarousel: (input: { topic: string; language?: 'ar' | 'en'; forceRefresh?: boolean }) =>
      trpcMutation<ContentGenerateResultShape>('content.generateCarousel', input),
    generateRepurpose: (input: { sourcePostId: string; language?: 'ar' | 'en'; forceRefresh?: boolean }) =>
      trpcMutation<ContentGenerateResultShape>('content.generateRepurpose', input),
    refine: (input: { versionId: string; chipType: string; customPrompt?: string; language?: 'ar' | 'en' }) =>
      trpcMutation<{
        result: ContentResultShape;
        tokensCharged: number;
        refinementIndex: number;
        isFreeWindow: boolean;
        remainingFree: number;
        cacheId: string;
      }>('content.refine', input),
    archive: (input: { versionId: string }) =>
      trpcMutation<{ success: boolean }>('content.archive', input),
    restore: (input: { versionId: string }) =>
      trpcMutation<{ success: boolean }>('content.restore', input),
    markPublished: (input: { versionId: string; externalUrl?: string }) =>
      trpcMutation<{ success: boolean }>('content.markPublished', input),
    setReminder: (input: { versionId: string; remindAt: string; channels?: Array<'in_app' | 'email'> }) =>
      trpcMutation<{ reminderId: string }>('content.setReminder', input),
    dismissReminder: (input: { reminderId: string }) =>
      trpcMutation<{ success: boolean }>('content.dismissReminder', input),
    exportCarouselPdf: (input: { versionId: string }) =>
      trpcMutation<{ filename: string; mimeType: string; base64: string }>('content.exportCarouselPdf', input),
    topicSuggestions: (input?: { language?: 'ar' | 'en' }) =>
      trpcQuery<{ suggestions: TopicSuggestionShape[]; profileHash: string; isCacheHit: boolean }>(
        'content.topicSuggestions',
        input ?? {},
      ),
    history: (input?: { limit?: number }) =>
      trpcQuery<{ versions: ContentVersionRow[] }>('content.history', input ?? {}),
  },
};

// ─────────────────────────────────────────────
// Resume shapes — mirror server/_core/lib/resume-engine.ts so the client
// bundle doesn't pull in the engine itself.
// ─────────────────────────────────────────────

export type ResumeVersionRow = {
  id: string;
  cache_id: string | null;
  target_role: string;
  display_name: string;
  template_id: string;
  status: 'active' | 'archived' | 'legacy';
  ats_score: number | null;
  tokens_charged: number;
  wallet_used: 'bonus' | 'subscription' | 'topup' | 'mixed' | null;
  language: 'ar' | 'en';
  legacy_source: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ResumeTemplateShape = {
  id: string;
  display_name_ar: string;
  display_name_en: string;
  description_ar: string | null;
  description_en: string | null;
  layout_type: 'classic' | 'modern' | 'creative' | 'executive';
  region_fit: string[];
  language_fit: string[];
  level_fit: string[];
  industry_boost: string[] | null;
  is_active: boolean;
  preview_url: string | null;
};

export type ResumeAtsBreakdownShape = {
  keywords: number;
  sections: number;
  format: number;
  quantified: number;
  matched_keywords: string[];
  missing_keywords: string[];
  issues: string[];
};

export type ResumeShape = {
  header: {
    name: string;
    title: string;
    location: string | null;
    phone: string | null;
    email: string | null;
    linkedin_url: string | null;
  };
  summary: string;
  experience: Array<{
    role: string;
    company: string;
    location: string | null;
    start: string;
    end: string;
    bullets: string[];
  }>;
  education: Array<{
    degree: string;
    institution: string;
    graduated: string;
    honors: string | null;
  }>;
  skills: { hard: string[]; soft: string[] };
  certifications: Array<{ name: string; issuer: string; year: string }>;
  languages: Array<{ name: string; proficiency: string }>;
  meta: {
    target_role: string;
    template_id: string;
    profile_hash: string;
    language: 'ar' | 'en';
    version_label: string;
    generated_at: string;
  };
};

// ─────────────────────────────────────────────
// Content shapes — mirror server/_core/lib/content-engine.ts
// ─────────────────────────────────────────────

export type ContentTypeShape = 'post' | 'carousel' | 'repurpose_bundle';

export type PostShape = {
  body: string;
  hashtags: string[];
  language: 'ar' | 'en';
  topic: string;
  meta: { generated_at: string; content_type: 'post' };
};

export type CarouselShape = {
  slides: Array<{ title: string; body: string; image_prompt: string | null }>;
  caption: string;
  hashtags: string[];
  language: 'ar' | 'en';
  topic: string;
  meta: { generated_at: string; content_type: 'carousel' };
};

export type RepurposeBundleShape = {
  source_post_id: string;
  carousel: {
    slides: Array<{ title: string; body: string; image_prompt: string | null }>;
    caption: string;
    hashtags: string[];
  };
  short_video_script: {
    hook: string;
    beats: string[];
    cta: string;
  };
  follow_up_post: {
    body: string;
    hashtags: string[];
  };
  language: 'ar' | 'en';
  meta: { generated_at: string; content_type: 'repurpose_bundle' };
};

export type ContentResultShape = PostShape | CarouselShape | RepurposeBundleShape;

export type TopicSuggestionShape = {
  topic: string;
  recommended_type: ContentTypeShape;
  reason: string;
};

export type ContentVersionRow = {
  id: string;
  cache_id: string | null;
  content_type: ContentTypeShape;
  display_title: string;
  topic: string;
  status: 'active' | 'archived' | 'published_externally' | 'legacy';
  tokens_charged: number;
  wallet_used: 'bonus' | 'subscription' | 'topup' | 'mixed' | null;
  language: 'ar' | 'en';
  legacy_source: string | null;
  external_url: string | null;
  archived_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ContentGenerateResultShape = {
  cacheId: string;
  versionId: string;
  isCacheHit: boolean;
  tokensCharged: number;
  walletUsed: 'bonus' | 'subscription' | 'topup' | 'mixed' | null;
  result: ContentResultShape;
  toneViolations: string[];
};

/**
 * Shape of the RadarResult returned by `radar.run` and `radar.getCached`.
 * Mirrors server/_core/lib/radar-engine.ts RadarResultSchema. Kept here
 * (rather than imported) so the client bundle doesn't pull in the engine.
 */
export type RadarResultShape = {
  strengths: Array<{ title: string; detail: string }>;
  gaps: Array<{ title: string; detail: string; severity: 'low' | 'medium' | 'high' }>;
  included_fixes: Array<{
    title: string;
    field: 'headline' | 'about' | 'experience' | 'skills';
    suggestion: string;
    rationale: string;
    impact_weight: number;
  }>;
  suggested_actions: Array<{
    title: string;
    detail: string;
    pillar: 'resume' | 'content' | 'profile';
    deeplink: string;
  }>;
  quick_wins: Array<{
    title: string;
    impact: 'high' | 'medium' | 'low';
    effort: 'very_low' | 'low' | 'medium' | 'high';
    area: string;
    score: number;
  }>;
  meta: {
    current_score: number;
    target_score: number;
    target_role: string;
    profile_hash: string;
    language: 'ar' | 'en';
    generated_at: string;
  };
};
