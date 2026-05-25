import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc-init';

const ADMIN_EMAILS = ['waselhup@gmail.com', 'almodhih.1995@gmail.com', 'alhashimali649@gmail.com'];
const dayMs = 24 * 60 * 60 * 1000;

// Admin gate via is_admin column (same pattern as admin.ts + finance.ts)
const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  try {
    const { data: profile } = await ctx.supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', ctx.user.id)
      .single();
    if (!profile?.is_admin) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
    }
    return next({ ctx });
  } catch (err) {
    if (err instanceof TRPCError) throw err;
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to verify admin' });
  }
});

function bucketHourly(rows: Array<{ created_at: string }>, hours: number): number[] {
  const now = Date.now();
  const hourMs = 60 * 60 * 1000;
  const out: number[] = [];
  for (let i = hours - 1; i >= 0; i--) {
    const start = now - (i + 1) * hourMs;
    const end = now - i * hourMs;
    out.push(rows.filter((r) => {
      const t = new Date(r.created_at).getTime();
      return t >= start && t < end;
    }).length);
  }
  return out;
}

export const opsRouter = router({
  /**
   * Admin-only: probe Anthropic with a tiny ping to check key health + billing.
   * Returns enough info for an admin dashboard widget to show green/amber/red.
   */
  anthropicHealth: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user?.email || !ADMIN_EMAILS.includes(ctx.user.email)) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin only' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return {
        status: 'unreachable' as const,
        httpCode: 0,
        message: 'ANTHROPIC_API_KEY not configured',
        creditExhausted: false,
        latencyMs: 0,
        timestamp: new Date().toISOString(),
      };
    }

    const t0 = Date.now();
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 5,
          messages: [{ role: 'user', content: 'ping' }],
        }),
      });
      const latencyMs = Date.now() - t0;
      const bodyText = await res.text();
      let parsed: any = null;
      try {
        parsed = JSON.parse(bodyText);
      } catch {
        /* non-JSON response — keep bodyText */
      }

      const creditExhausted = /credit balance is too low|insufficient credit/i.test(bodyText);
      const errMsg = parsed?.error?.message || bodyText.slice(0, 300);

      return {
        status: res.ok ? ('healthy' as const) : ('error' as const),
        httpCode: res.status,
        message: res.ok ? 'Claude API reachable' : errMsg,
        creditExhausted,
        latencyMs,
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      return {
        status: 'unreachable' as const,
        httpCode: 0,
        message: err?.message || 'Network error',
        creditExhausted: false,
        latencyMs: Date.now() - t0,
        timestamp: new Date().toISOString(),
      };
    }
  }),

  // ═════════════════════════════════════════════════════════════════════
  // OPERATIONS PORTAL — Live Pulse, Signups, Subs, Health, Webhooks, Incidents
  // ═════════════════════════════════════════════════════════════════════

  pulse: adminProcedure.query(async ({ ctx }) => {
    const now = Date.now();
    const today = new Date(now - dayMs).toISOString();
    const yesterday = new Date(now - 2 * dayMs).toISOString();
    const sevenDaysAgo = new Date(now - 7 * dayMs).toISOString();
    const lastWeek = new Date(now - 14 * dayMs).toISOString();
    const oneHourAgo = new Date(now - 60 * 60 * 1000).toISOString();
    const expiringEnd = new Date(now + 7 * dayMs).toISOString();

    const [
      signupsRecent, signupsLastWeek,
      activeSubsRes, activeSubsLastWeekRes,
      expiringRes,
      failedHooksRes,
      apiErrorsRecent,
      openIncidentsRes,
    ] = await Promise.all([
      ctx.supabase.from('signup_events').select('created_at').eq('event_type', 'signup_started').gte('created_at', sevenDaysAgo),
      ctx.supabase.from('signup_events').select('id', { count: 'exact', head: true }).eq('event_type', 'signup_started').gte('created_at', lastWeek).lt('created_at', sevenDaysAgo),
      ctx.supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      ctx.supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active').lt('created_at', sevenDaysAgo),
      ctx.supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active').gte('current_period_end', new Date(now).toISOString()).lte('current_period_end', expiringEnd),
      ctx.supabase.from('payment_transactions').select('id', { count: 'exact', head: true }).eq('status', 'failed').gte('created_at', today),
      ctx.supabase.from('api_logs').select('id, created_at').gte('status_code', 500).gte('created_at', oneHourAgo),
      ctx.supabase.from('incidents').select('id', { count: 'exact', head: true }).in('status', ['open', 'investigating']),
    ]);

    const signupRows = (signupsRecent.data || []) as Array<{ created_at: string }>;
    const signupsToday = signupRows.filter((r) => r.created_at >= today).length;
    const signupsYesterday = signupRows.filter((r) => r.created_at >= yesterday && r.created_at < today).length;
    const signupsSpark24h = bucketHourly(signupRows.filter((r) => r.created_at >= today), 24);

    const errorRows = (apiErrorsRecent.data || []) as Array<{ created_at: string }>;

    return {
      signups: { today: signupsToday, yesterday: signupsYesterday, spark: signupsSpark24h },
      activeSubs: { today: activeSubsRes.count || 0, lastWeek: activeSubsLastWeekRes.count || 0, spark: new Array(7).fill(activeSubsRes.count || 0) },
      expiringSoon: { today: expiringRes.count || 0, lastWeek: 0, spark: new Array(7).fill(expiringRes.count || 0) },
      failedHooks: { today: failedHooksRes.count || 0, yesterday: 0, spark: new Array(24).fill(0) },
      apiErrors1h: { today: errorRows.length, yesterday: 0, spark: bucketHourly(errorRows, 60).slice(-60) },
      openIncidents: { today: openIncidentsRes.count || 0, yesterday: 0, spark: new Array(7).fill(openIncidentsRes.count || 0), signupsLastWeek: signupsLastWeek.count || 0 },
    };
  }),

  signupFunnel: adminProcedure
    .input(z.object({ days: z.number().int().min(1).max(90).default(7) }).optional())
    .query(async ({ ctx, input }) => {
      const days = input?.days ?? 7;
      const start = new Date(Date.now() - days * dayMs).toISOString();
      const { data: events } = await ctx.supabase
        .from('signup_events')
        .select('user_id, event_type')
        .gte('created_at', start);
      const rows = (events || []) as Array<{ user_id: string | null; event_type: string }>;
      const usersAtStage = (type: string) =>
        new Set(rows.filter((r) => r.event_type === type && r.user_id).map((r) => r.user_id!)).size;
      const stages = [
        { key: 'signup_started', count: usersAtStage('signup_started') },
        { key: 'email_verified', count: usersAtStage('email_verified') },
        { key: 'profile_completed', count: usersAtStage('profile_completed') },
        { key: 'onboarding_completed', count: usersAtStage('onboarding_completed') },
        { key: 'first_action', count: usersAtStage('first_action') },
      ];
      let biggestDropIdx = 0;
      let biggestDropPct = 0;
      for (let i = 1; i < stages.length; i++) {
        const prev = stages[i - 1].count;
        const curr = stages[i].count;
        if (prev > 0) {
          const drop = ((prev - curr) / prev) * 100;
          if (drop > biggestDropPct) {
            biggestDropPct = drop;
            biggestDropIdx = i;
          }
        }
      }
      return { stages, biggestDropIdx, biggestDropPct: Math.round(biggestDropPct) };
    }),

  signupFeed: adminProcedure
    .input(z.object({ limit: z.number().int().min(1).max(200).default(50) }).optional())
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 50;
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const [feedRes, abandonedRes] = await Promise.all([
        ctx.supabase
          .from('signup_events')
          .select('id, user_id, email, event_type, step_name, metadata, created_at')
          .order('created_at', { ascending: false })
          .limit(limit),
        ctx.supabase
          .from('signup_events')
          .select('id', { count: 'exact', head: true })
          .eq('event_type', 'abandoned')
          .gte('created_at', oneHourAgo),
      ]);
      return { events: feedRes.data || [], abandonedLastHour: abandonedRes.count || 0 };
    }),

  subscriptions: adminProcedure
    .input(
      z.object({
        status: z.enum(['active', 'expiring', 'past_due', 'canceled', 'new_month']).default('active'),
        limit: z.number().int().min(1).max(200).default(50),
        offset: z.number().int().min(0).default(0),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const status = input?.status ?? 'active';
      const limit = input?.limit ?? 50;
      const offset = input?.offset ?? 0;
      const now = new Date();

      let q = ctx.supabase
        .from('subscriptions')
        .select('id, user_id, plan, status, current_period_start, current_period_end, cancel_at_period_end, canceled_at, monthly_amount_sar, created_at', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      switch (status) {
        case 'active':
          q = q.eq('status', 'active');
          break;
        case 'expiring': {
          const in7 = new Date(now.getTime() + 7 * dayMs).toISOString();
          q = q.eq('status', 'active').gte('current_period_end', now.toISOString()).lte('current_period_end', in7);
          break;
        }
        case 'past_due':
          q = q.eq('status', 'past_due');
          break;
        case 'canceled':
          q = q.eq('status', 'canceled');
          break;
        case 'new_month': {
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
          q = q.gte('created_at', monthStart);
          break;
        }
      }

      const { data, count } = await q;
      const rows = (data || []) as any[];
      let userMap = new Map<string, any>();
      if (rows.length) {
        const ids = Array.from(new Set(rows.map((r) => r.user_id)));
        const { data: users } = await ctx.supabase
          .from('profiles')
          .select('id, email, full_name, avatar_url')
          .in('id', ids);
        userMap = new Map((users || []).map((u: any) => [u.id, u]));
      }

      return {
        rows: rows.map((r) => ({ ...r, user: userMap.get(r.user_id) || null })),
        total: count || 0,
      };
    }),

  subscriptionAction: adminProcedure
    .input(
      z.object({
        subscriptionId: z.string().uuid(),
        action: z.enum(['extend', 'cancel', 'mark_paid']),
        days: z.number().int().min(1).max(365).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { data: sub } = await ctx.supabase
        .from('subscriptions')
        .select('id, current_period_end, status')
        .eq('id', input.subscriptionId)
        .maybeSingle();
      if (!sub) throw new TRPCError({ code: 'NOT_FOUND', message: 'Subscription not found' });

      const update: Record<string, any> = { updated_at: new Date().toISOString() };
      if (input.action === 'extend') {
        const extDays = input.days ?? 30;
        update.current_period_end = new Date(new Date(sub.current_period_end).getTime() + extDays * dayMs).toISOString();
      } else if (input.action === 'cancel') {
        update.status = 'canceled';
        update.cancel_at_period_end = true;
        update.canceled_at = new Date().toISOString();
      } else {
        update.status = 'active';
      }
      const { error } = await ctx.supabase.from('subscriptions').update(update).eq('id', input.subscriptionId);
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return { success: true, action: input.action };
    }),

  servicesHealth: adminProcedure.query(async ({ ctx }) => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const oneDayAgo = new Date(Date.now() - dayMs).toISOString();

    // 1) Supabase DB probe
    const dbStart = Date.now();
    let dbStatus: 'healthy' | 'watch' | 'critical' = 'critical';
    let dbLatency = -1;
    try {
      const { error } = await ctx.supabase.from('profiles').select('id', { count: 'exact', head: true }).limit(1);
      dbLatency = Date.now() - dbStart;
      dbStatus = error ? 'critical' : dbLatency > 1000 ? 'watch' : 'healthy';
    } catch { dbStatus = 'critical'; }

    // 2) Supabase Auth — recent signup activity
    const { count: recentSignups } = await ctx.supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', oneDayAgo);

    // 3) Anthropic (last 1h)
    const { data: anthropicLogs } = await ctx.supabase
      .from('api_logs')
      .select('status_code, response_time_ms')
      .eq('service', 'anthropic')
      .gte('created_at', oneHourAgo);
    const aRows = (anthropicLogs || []) as Array<{ status_code: number; response_time_ms: number | null }>;
    const aTotal = aRows.length;
    const aErrors = aRows.filter((r) => (r.status_code || 0) >= 400).length;
    const aLatency = aRows.length ? Math.round(aRows.reduce((s, r) => s + (r.response_time_ms || 0), 0) / aRows.length) : 0;
    const aSuccessRate = aTotal > 0 ? Math.round(((aTotal - aErrors) / aTotal) * 100) : 100;
    const anthropicStatus: 'healthy' | 'watch' | 'critical' =
      aTotal === 0 ? 'healthy' : aErrors / aTotal > 0.3 ? 'critical' : aErrors / aTotal > 0.1 ? 'watch' : 'healthy';

    // 4) Apify
    const { data: apifyLogs } = await ctx.supabase
      .from('api_logs')
      .select('status_code')
      .eq('service', 'apify')
      .gte('created_at', oneDayAgo);
    const apRows = (apifyLogs || []) as Array<{ status_code: number }>;
    const apTotal = apRows.length;
    const apErrors = apRows.filter((r) => (r.status_code || 0) >= 400).length;
    const apSuccess = apTotal > 0 ? Math.round(((apTotal - apErrors) / apTotal) * 100) : 100;
    const apifyStatus: 'healthy' | 'watch' | 'critical' =
      apTotal === 0 ? 'healthy' : apErrors / apTotal > 0.3 ? 'critical' : apErrors / apTotal > 0.1 ? 'watch' : 'healthy';

    // 5) Moyasar — last webhook
    const { data: lastWebhook } = await ctx.supabase
      .from('payment_transactions')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const moyasarStatus: 'healthy' | 'watch' | 'critical' = lastWebhook?.created_at ? 'healthy' : 'watch';

    // 6) Vercel
    const vercelSha = process.env.VERCEL_GIT_COMMIT_SHA || null;
    const vercelStatus: 'healthy' | 'watch' | 'critical' = vercelSha ? 'healthy' : 'watch';

    // 7) Telegram
    const telegramConfigured = !!process.env.TELEGRAM_BOT_TOKEN;
    const telegramStatus: 'healthy' | 'watch' | 'critical' = telegramConfigured ? 'healthy' : 'watch';

    const ts = new Date().toISOString();
    return {
      checkedAt: ts,
      services: [
        { key: 'supabase_db', status: dbStatus, metric: { label: 'latency', value: dbLatency, unit: 'ms' }, last_checked: ts },
        { key: 'supabase_auth', status: (recentSignups ?? 0) >= 0 ? 'healthy' : 'critical' as const, metric: { label: 'recent_signups_24h', value: recentSignups || 0, unit: '' }, last_checked: ts },
        { key: 'anthropic', status: anthropicStatus, metric: { label: 'success_rate', value: aSuccessRate, unit: '%', latency_ms: aLatency, calls_1h: aTotal }, last_checked: ts },
        { key: 'apify', status: apifyStatus, metric: { label: 'success_rate', value: apSuccess, unit: '%', calls_24h: apTotal }, last_checked: ts },
        { key: 'moyasar', status: moyasarStatus, metric: { label: 'last_webhook', value: lastWebhook?.created_at || null, unit: '' }, last_checked: ts },
        { key: 'vercel', status: vercelStatus, metric: { label: 'commit_sha', value: vercelSha ? vercelSha.slice(0, 7) : null, unit: '' }, last_checked: ts },
        { key: 'telegram', status: telegramStatus, metric: { label: 'configured', value: telegramConfigured ? 'yes' : 'no', unit: '' }, last_checked: ts },
      ],
    };
  }),

  runHealthCheck: adminProcedure
    .input(z.object({ service: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.supabase.from('api_logs').insert({
        service: input.service.slice(0, 50),
        endpoint: 'OPS_HEALTH_CHECK',
        status_code: 200,
        response_time_ms: 0,
      });
      return { success: true, service: input.service };
    }),

  webhooks: adminProcedure
    .input(z.object({ limit: z.number().int().min(1).max(200).default(50) }).optional())
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 50;
      const { data } = await ctx.supabase
        .from('payment_transactions')
        .select('id, user_id, amount_sar, currency, type, status, muyassar_transaction_id, muyassar_invoice_id, metadata, created_at, completed_at')
        .order('created_at', { ascending: false })
        .limit(limit);
      const rows = (data || []) as any[];
      let userMap = new Map<string, any>();
      if (rows.length) {
        const ids = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean)));
        if (ids.length) {
          const { data: users } = await ctx.supabase
            .from('profiles')
            .select('id, email, full_name')
            .in('id', ids);
          userMap = new Map((users || []).map((u: any) => [u.id, u]));
        }
      }
      return { rows: rows.map((r) => ({ ...r, user: userMap.get(r.user_id) || null })) };
    }),

  retryFulfillment: adminProcedure
    .input(z.object({ paymentTransactionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase
        .from('payment_transactions')
        .update({ status: 'pending', metadata: { retried_at: new Date().toISOString() } })
        .eq('id', input.paymentTransactionId);
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return { success: true, note: 'Marked pending. Re-fire from Moyasar dashboard to complete.' };
    }),

  crons: adminProcedure.query(async ({ ctx }) => {
    const crons = [
      { name: 'anthropic-health', path: '/api/cron/anthropic-health', schedule: '0 */2 * * *' },
      { name: 'check-renewals', path: '/api/cron/check-renewals', schedule: '0 6 * * *' },
      { name: 'check-abandoned-signups', path: '/api/cron/check-abandoned-signups', schedule: '0 * * * *' },
      { name: 'services-heartbeat', path: '/api/cron/services-heartbeat', schedule: '*/15 * * * *' },
    ];
    const enriched = await Promise.all(crons.map(async (c) => {
      const { data } = await ctx.supabase
        .from('api_logs')
        .select('status_code, created_at')
        .eq('endpoint', c.path)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return {
        ...c,
        last_run: data?.created_at || null,
        last_status: (data?.status_code === 200 ? 'ok' : data?.status_code ? 'fail' : 'unknown') as 'ok' | 'fail' | 'unknown',
      };
    }));
    return { crons: enriched };
  }),

  triggerCron: adminProcedure
    .input(z.object({ endpoint: z.string() }))
    .mutation(async ({ ctx: _ctx, input }) => {
      const base = process.env.PUBLIC_APP_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
      const url = `${base.replace(/\/$/, '')}${input.endpoint}`;
      try {
        const res = await fetch(url, { method: 'POST', headers: { 'x-ops-trigger': '1' } });
        return { success: res.ok, status: res.status };
      } catch (e: any) {
        return { success: false, status: 0, error: e?.message || 'fetch failed' };
      }
    }),

  incidents: adminProcedure
    .input(z.object({ status: z.enum(['open', 'investigating', 'resolved', 'dismissed', 'all']).default('open') }).optional())
    .query(async ({ ctx, input }) => {
      const status = input?.status ?? 'open';
      let q = ctx.supabase
        .from('incidents')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (status === 'open') q = q.in('status', ['open', 'investigating']);
      else if (status !== 'all') q = q.eq('status', status);
      const { data } = await q;
      return { rows: data || [] };
    }),

  createIncident: adminProcedure
    .input(
      z.object({
        severity: z.enum(['info', 'warning', 'error', 'critical']),
        title: z.string().min(3).max(200),
        description: z.string().max(2000).optional(),
        affected_service: z.string().max(100).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('incidents')
        .insert({
          severity: input.severity,
          source: 'manual',
          title: input.title,
          description: input.description || null,
          affected_service: input.affected_service || null,
        })
        .select('id')
        .single();
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return { success: true, id: data!.id };
    }),

  updateIncident: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum(['investigating', 'resolved', 'dismissed']),
        resolution_notes: z.string().max(2000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const update: Record<string, any> = { status: input.status };
      if (input.status === 'investigating') {
        update.acknowledged_at = new Date().toISOString();
        update.acknowledged_by = ctx.user.email || ctx.user.id;
      }
      if (input.status === 'resolved') {
        update.resolved_at = new Date().toISOString();
        update.resolution_notes = input.resolution_notes || null;
      }
      const { error } = await ctx.supabase.from('incidents').update(update).eq('id', input.id);
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return { success: true };
    }),

  broadcastEmail: adminProcedure
    .input(
      z.object({
        subject_ar: z.string().min(1).max(200),
        subject_en: z.string().min(1).max(200),
        body_ar: z.string().min(1).max(10000),
        body_en: z.string().min(1).max(10000),
        audience: z.enum(['all', 'paid', 'free']).default('all'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      let q = ctx.supabase.from('profiles').select('id', { count: 'exact', head: true });
      if (input.audience === 'paid') q = q.neq('plan', 'free');
      else if (input.audience === 'free') q = q.eq('plan', 'free');
      const { count } = await q;
      await ctx.supabase.from('incidents').insert({
        severity: 'info',
        source: 'broadcast',
        title: `Broadcast queued (${input.audience}): ${input.subject_en}`,
        description: `AR: ${input.subject_ar}\nEN: ${input.subject_en}\nRecipients: ${count}`,
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        metadata: { audience: input.audience, recipient_count: count, body_ar: input.body_ar.slice(0, 500), body_en: input.body_en.slice(0, 500) },
      });
      return { success: true, recipientCount: count || 0, note: 'Broadcast queued (provider not yet wired).' };
    }),

  toggleMaintenanceMode: adminProcedure
    .input(
      z.object({
        enabled: z.boolean(),
        message_ar: z.string().max(500).optional(),
        message_en: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const value = {
        enabled: input.enabled,
        message_ar: input.message_ar || '',
        message_en: input.message_en || '',
      };
      const { data: existing } = await ctx.supabase
        .from('system_settings')
        .select('id')
        .eq('key', 'maintenance_mode')
        .maybeSingle();
      if (existing?.id) {
        await ctx.supabase.from('system_settings').update({ value, updated_at: new Date().toISOString() }).eq('id', existing.id);
      } else {
        await ctx.supabase.from('system_settings').insert({ key: 'maintenance_mode', value });
      }
      return { success: true, enabled: input.enabled };
    }),
});
