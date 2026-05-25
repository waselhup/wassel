import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc-init';
import { createInvoice, isMoyasarConfigured } from '../lib/moyasar-client';

// Admin gate (mirror admin.ts pattern). Centralised one day; for now duplicated.
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

const PLAN_PRICES: Record<string, number> = { free: 0, starter: 99, pro: 199, elite: 299 };
const HAIKU_USD_PER_TOKEN = 0.8 / 1_000_000;   // $0.80 / 1M tokens input
const SONNET_USD_PER_TOKEN = 3.0 / 1_000_000;  // $3.00 / 1M tokens input
// Each wassel-token roughly maps to one Anthropic call. Assume avg 2k input tokens per call.
const HAIKU_USD_PER_WASSEL_TOKEN = HAIKU_USD_PER_TOKEN * 2000;
const SONNET_USD_PER_WASSEL_TOKEN = SONNET_USD_PER_TOKEN * 2000;

async function getSetting(ctx: any, key: string, fallback: number): Promise<number> {
  const { data } = await ctx.supabase
    .from('system_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  if (!data) return fallback;
  const v = data.value;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return Number(v) || fallback;
  return fallback;
}

function bucketDaily(rows: Array<{ created_at: string }>, days: number): number[] {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const out: number[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const start = now - (i + 1) * dayMs;
    const end = now - i * dayMs;
    out.push(rows.filter((r) => {
      const t = new Date(r.created_at).getTime();
      return t >= start && t < end;
    }).length);
  }
  return out;
}

function sumDaily(
  rows: Array<{ created_at: string; amount?: number; amount_sar?: number | string }>,
  days: number,
  field: 'amount' | 'amount_sar'
): number[] {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const out: number[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const start = now - (i + 1) * dayMs;
    const end = now - i * dayMs;
    const sum = rows
      .filter((r) => {
        const t = new Date(r.created_at).getTime();
        return t >= start && t < end;
      })
      .reduce((s, r) => s + Number((r as any)[field] || 0), 0);
    out.push(sum);
  }
  return out;
}

function categorizeFeature(featureCol: string | null, description: string | null): 'linkedin' | 'cv' | 'campaign' | 'admin' | 'other' {
  const f = (featureCol || '').toLowerCase();
  if (['linkedin', 'cv', 'campaign', 'admin'].includes(f)) return f as any;
  const d = (description || '').toLowerCase();
  if (d.includes('linkedin') || d.includes('analysis') || d.includes('analyze') || d.includes('profile')) return 'linkedin';
  if (d.includes('cv') || d.includes('resume') || d.includes('cover')) return 'cv';
  if (d.includes('campaign') || d.includes('preview') || d.includes('message')) return 'campaign';
  if (d.includes('admin') || d.includes('grant')) return 'admin';
  return 'other';
}

function usdCostForFeature(feature: string, tokens: number): number {
  if (feature === 'linkedin') return tokens * HAIKU_USD_PER_WASSEL_TOKEN;
  if (feature === 'cv' || feature === 'campaign') return tokens * SONNET_USD_PER_WASSEL_TOKEN;
  return 0;
}

export const financeRouter = router({
  // ───────────────────────────────────────────────────────────────────────
  // F1 — financial pulse (hero strip)
  // ───────────────────────────────────────────────────────────────────────
  pulse: adminProcedure.query(async ({ ctx }) => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = new Date(now - 30 * dayMs).toISOString();
    const sixtyDaysAgo = new Date(now - 60 * dayMs).toISOString();
    const currentMonthStart = new Date();
    currentMonthStart.setDate(1);
    currentMonthStart.setHours(0, 0, 0, 0);
    const lastMonthStart = new Date(currentMonthStart);
    lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);

    const [allProfilesRes, paymentsRes, subsCancelledRes, transactionsRes, cashSar, usdRate, apifyUsd, infraUsd] = await Promise.all([
      ctx.supabase.from('profiles').select('plan, created_at'),
      ctx.supabase
        .from('payment_transactions')
        .select('amount_sar, status, created_at, completed_at, type')
        .gte('created_at', sixtyDaysAgo),
      ctx.supabase
        .from('user_subscriptions')
        .select('plan_id, cancelled_at, status')
        .gte('cancelled_at', currentMonthStart.toISOString()),
      ctx.supabase
        .from('token_transactions')
        .select('amount, feature, description, created_at')
        .gte('created_at', thirtyDaysAgo),
      getSetting(ctx, 'cash_on_hand_sar', 0),
      getSetting(ctx, 'usd_sar_rate', 3.75),
      getSetting(ctx, 'apify_monthly_cost_usd', 49),
      getSetting(ctx, 'infra_monthly_cost_usd', 20),
    ]);

    const allProfiles = allProfilesRes.data || [];
    const payments = paymentsRes.data || [];
    const subsCancelled = subsCancelledRes.data || [];
    const txs = transactionsRes.data || [];

    const payingUsers = allProfiles.filter((p: any) => p.plan && p.plan !== 'free');
    const mrr = payingUsers.reduce((s: number, p: any) => s + (PLAN_PRICES[p.plan] || 0), 0);
    const arr = mrr * 12;

    const succThisMonth = payments
      .filter((p: any) => p.status === 'completed' && p.completed_at && new Date(p.completed_at) >= currentMonthStart)
      .reduce((s: number, p: any) => s + Number(p.amount_sar || 0), 0);
    const succLastMonth = payments
      .filter(
        (p: any) =>
          p.status === 'completed' &&
          p.completed_at &&
          new Date(p.completed_at) >= lastMonthStart &&
          new Date(p.completed_at) < currentMonthStart
      )
      .reduce((s: number, p: any) => s + Number(p.amount_sar || 0), 0);

    const churnedMrr = subsCancelled.reduce(
      (s: number, sub: any) => s + (PLAN_PRICES[sub.plan_id] || 0),
      0
    );

    // API + infra costs (30d, in SAR)
    const burns = txs.filter((t: any) => (t.amount || 0) < 0);
    const apiCostUsd = burns.reduce((s: number, t: any) => {
      const feat = categorizeFeature(t.feature, t.description);
      return s + usdCostForFeature(feat, Math.abs(t.amount));
    }, 0);
    const totalCostUsd30d = apiCostUsd + apifyUsd + infraUsd;
    const totalCostSar30d = totalCostUsd30d * usdRate;

    const netMarginPct = mrr > 0 ? ((mrr - totalCostSar30d) / mrr) * 100 : 0;

    // 30-day sparklines
    const completedPayments = payments.filter((p: any) => p.status === 'completed' && p.completed_at) as Array<{ amount_sar: any; created_at: string; completed_at: string }>;
    const revenueSpark = sumDaily(
      completedPayments.map((p) => ({ created_at: p.completed_at, amount_sar: p.amount_sar })),
      30,
      'amount_sar'
    );
    // MRR/ARR/cash/margin sparklines = flat snapshot (we don't have historical state)
    const flat30 = (v: number) => new Array(30).fill(v);

    return {
      mrr: { today: mrr, lastMonth: mrr, spark: flat30(mrr) },
      arr: { today: arr, lastMonth: arr, spark: flat30(arr) },
      newRevenue: { today: succThisMonth, lastMonth: succLastMonth, spark: revenueSpark },
      churn: { today: subsCancelled.length, lostMrr: churnedMrr, lastMonth: 0, spark: flat30(churnedMrr) },
      netMargin: { today: Math.round(netMarginPct * 10) / 10, lastMonth: Math.round(netMarginPct * 10) / 10, spark: flat30(netMarginPct) },
      cashOnHand: { today: cashSar, lastMonth: cashSar, spark: flat30(cashSar) },
    };
  }),

  // ───────────────────────────────────────────────────────────────────────
  // F2 — revenue waterfall (last-month → this-month MRR)
  // ───────────────────────────────────────────────────────────────────────
  waterfall: adminProcedure.query(async ({ ctx }) => {
    const currentMonthStart = new Date();
    currentMonthStart.setDate(1);
    currentMonthStart.setHours(0, 0, 0, 0);
    const lastMonthStart = new Date(currentMonthStart);
    lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);

    const [subsThisMonth, profiles] = await Promise.all([
      ctx.supabase
        .from('user_subscriptions')
        .select('plan_id, status, cancelled_at, created_at, amount_paid_sar')
        .gte('created_at', lastMonthStart.toISOString()),
      ctx.supabase.from('profiles').select('plan, created_at'),
    ]);

    const subs = subsThisMonth.data || [];
    const allProfiles = profiles.data || [];

    // Crude — without historical MRR snapshots we approximate:
    //   newMrr = subs created in current month that are still active
    //   expansionMrr = 0 (need plan_id history per user; not tracked yet)
    //   churnedMrr = sum(plan_price) of subs cancelled in current month
    //   startingMrr = endingMrr - newMrr + churnedMrr
    const endingMrr = allProfiles
      .filter((p: any) => p.plan && p.plan !== 'free')
      .reduce((s: number, p: any) => s + (PLAN_PRICES[p.plan] || 0), 0);

    const newMrr = subs
      .filter(
        (s: any) =>
          s.status === 'active' &&
          new Date(s.created_at) >= currentMonthStart
      )
      .reduce((acc: number, s: any) => acc + (PLAN_PRICES[s.plan_id] || 0), 0);

    const churnedMrr = subs
      .filter((s: any) => s.cancelled_at && new Date(s.cancelled_at) >= currentMonthStart)
      .reduce((acc: number, s: any) => acc + (PLAN_PRICES[s.plan_id] || 0), 0);

    const expansionMrr = 0; // TODO: when we track plan upgrades, compute upgrade delta
    const startingMrr = endingMrr - newMrr - expansionMrr + churnedMrr;

    return { startingMrr, newMrr, expansionMrr, churnedMrr, endingMrr };
  }),

  // ───────────────────────────────────────────────────────────────────────
  // F3 — plan breakdown (donut + per-plan table)
  // ───────────────────────────────────────────────────────────────────────
  planBreakdown: adminProcedure.query(async ({ ctx }) => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const [profilesRes, txRes, usdRate] = await Promise.all([
      ctx.supabase.from('profiles').select('id, plan'),
      ctx.supabase
        .from('token_transactions')
        .select('user_id, amount, feature, description, created_at')
        .gte('created_at', thirtyDaysAgo),
      getSetting(ctx, 'usd_sar_rate', 3.75),
    ]);
    const profiles = profilesRes.data || [];
    const txs = (txRes.data || []) as Array<{ user_id: string; amount: number; feature: string | null; description: string | null }>;

    // Total burn per user
    const burnPerUser = new Map<string, { tokens: number; costUsd: number }>();
    for (const t of txs) {
      if (!t.amount || t.amount >= 0) continue;
      const feat = categorizeFeature(t.feature, t.description);
      const tokens = Math.abs(t.amount);
      const usd = usdCostForFeature(feat, tokens);
      const prev = burnPerUser.get(t.user_id) || { tokens: 0, costUsd: 0 };
      prev.tokens += tokens;
      prev.costUsd += usd;
      burnPerUser.set(t.user_id, prev);
    }

    // Aggregate per plan
    const planAgg: Record<string, { users: number; tokens: number; costUsd: number }> = {
      free: { users: 0, tokens: 0, costUsd: 0 },
      starter: { users: 0, tokens: 0, costUsd: 0 },
      pro: { users: 0, tokens: 0, costUsd: 0 },
      elite: { users: 0, tokens: 0, costUsd: 0 },
    };
    for (const p of profiles) {
      const plan = (p.plan as string) || 'free';
      if (!planAgg[plan]) planAgg[plan] = { users: 0, tokens: 0, costUsd: 0 };
      planAgg[plan].users += 1;
      const burn = burnPerUser.get(p.id);
      if (burn) {
        planAgg[plan].tokens += burn.tokens;
        planAgg[plan].costUsd += burn.costUsd;
      }
    }

    const totalMrr = Object.entries(planAgg).reduce(
      (s, [plan, a]) => s + (PLAN_PRICES[plan] || 0) * a.users,
      0
    );

    const breakdown = Object.entries(planAgg).map(([plan, a]) => {
      const mrr = (PLAN_PRICES[plan] || 0) * a.users;
      const costPerUserSar = a.users > 0 ? (a.costUsd * usdRate) / a.users : 0;
      const revenuePerUser = PLAN_PRICES[plan] || 0;
      const marginPercent =
        revenuePerUser > 0 ? ((revenuePerUser - costPerUserSar) / revenuePerUser) * 100 : null;
      return {
        plan,
        users: a.users,
        mrr,
        percentOfMrr: totalMrr > 0 ? (mrr / totalMrr) * 100 : 0,
        avgTokensPerMonth: a.users > 0 ? Math.round(a.tokens / a.users) : 0,
        costPerUserSar,
        marginPercent,
      };
    });

    return { breakdown, totalMrr };
  }),

  // ───────────────────────────────────────────────────────────────────────
  // F4 — payments (successful / failed / refunds)
  // ───────────────────────────────────────────────────────────────────────
  payments: adminProcedure
    .input(z.object({ limit: z.number().int().positive().max(100).default(10) }).optional())
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 10;
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const [paymentsRes, refundsRes] = await Promise.all([
        ctx.supabase
          .from('payment_transactions')
          .select('id, user_id, amount_sar, currency, status, muyassar_transaction_id, muyassar_invoice_id, type, reference_id, created_at, completed_at')
          .gte('created_at', thirtyDaysAgo)
          .order('created_at', { ascending: false }),
        ctx.supabase
          .from('token_transactions')
          .select('id, user_id, amount, description, created_at')
          .eq('type', 'refund')
          .gte('created_at', thirtyDaysAgo)
          .order('created_at', { ascending: false })
          .limit(limit),
      ]);

      const allPayments = paymentsRes.data || [];
      const refunds = refundsRes.data || [];

      // Hydrate user emails
      const userIds = Array.from(new Set([
        ...allPayments.map((p: any) => p.user_id),
        ...refunds.map((r: any) => r.user_id),
      ].filter(Boolean)));

      let userMap = new Map<string, any>();
      if (userIds.length) {
        const { data: users } = await ctx.supabase
          .from('profiles')
          .select('id, email, full_name, plan')
          .in('id', userIds);
        userMap = new Map((users || []).map((u: any) => [u.id, u]));
      }

      const enrich = (row: any) => ({
        ...row,
        user: userMap.get(row.user_id) || null,
      });

      return {
        successful: allPayments
          .filter((p: any) => p.status === 'completed')
          .slice(0, limit)
          .map(enrich),
        failed: allPayments
          .filter((p: any) => p.status === 'failed' || p.status === 'cancelled')
          .slice(0, limit)
          .map(enrich),
        refunds: refunds.map(enrich),
      };
    }),

  // ───────────────────────────────────────────────────────────────────────
  // F5 — cost control (API breakdown + top 10 cost drivers)
  // ───────────────────────────────────────────────────────────────────────
  costControl: adminProcedure.query(async ({ ctx }) => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [txsRes, usdRate, apifyUsd, infraUsd, profilesRes] = await Promise.all([
      ctx.supabase
        .from('token_transactions')
        .select('user_id, amount, feature, description, created_at')
        .gte('created_at', thirtyDaysAgo),
      getSetting(ctx, 'usd_sar_rate', 3.75),
      getSetting(ctx, 'apify_monthly_cost_usd', 49),
      getSetting(ctx, 'infra_monthly_cost_usd', 20),
      ctx.supabase.from('profiles').select('id, email, full_name, plan'),
    ]);

    const txs = (txsRes.data || []) as Array<any>;
    const profiles = (profilesRes.data || []) as Array<any>;
    const profileMap = new Map(profiles.map((p) => [p.id, p]));

    // Cost by feature
    const byFeature: Record<string, { tokens: number; costUsd: number }> = {
      linkedin: { tokens: 0, costUsd: 0 },
      cv: { tokens: 0, costUsd: 0 },
      campaign: { tokens: 0, costUsd: 0 },
      admin: { tokens: 0, costUsd: 0 },
      other: { tokens: 0, costUsd: 0 },
    };
    const burnPerUser = new Map<string, { tokens: number; costUsd: number }>();

    for (const t of txs) {
      if (!t.amount || t.amount >= 0) continue;
      const feat = categorizeFeature(t.feature, t.description);
      const tokens = Math.abs(t.amount);
      const usd = usdCostForFeature(feat, tokens);
      byFeature[feat].tokens += tokens;
      byFeature[feat].costUsd += usd;
      const prev = burnPerUser.get(t.user_id) || { tokens: 0, costUsd: 0 };
      prev.tokens += tokens;
      prev.costUsd += usd;
      burnPerUser.set(t.user_id, prev);
    }

    const apiBreakdown = [
      { key: 'sonnet', tokens: byFeature.cv.tokens + byFeature.campaign.tokens, cost_usd: byFeature.cv.costUsd + byFeature.campaign.costUsd, cost_sar: (byFeature.cv.costUsd + byFeature.campaign.costUsd) * usdRate },
      { key: 'haiku', tokens: byFeature.linkedin.tokens, cost_usd: byFeature.linkedin.costUsd, cost_sar: byFeature.linkedin.costUsd * usdRate },
      { key: 'apify', tokens: 0, cost_usd: apifyUsd, cost_sar: apifyUsd * usdRate },
      { key: 'infra', tokens: 0, cost_usd: infraUsd, cost_sar: infraUsd * usdRate },
    ];

    const totalCostUsd = apiBreakdown.reduce((s, r) => s + r.cost_usd, 0);
    const totalCostSar = totalCostUsd * usdRate;

    // Top 10 cost drivers
    const topDrivers = Array.from(burnPerUser.entries())
      .map(([userId, burn]) => {
        const u = profileMap.get(userId);
        const planPriceSar = PLAN_PRICES[(u?.plan as string) || 'free'] || 0;
        const costSar = burn.costUsd * usdRate;
        const netMarginSar = planPriceSar - costSar;
        return {
          id: userId,
          email: u?.email || null,
          full_name: u?.full_name || null,
          plan: u?.plan || 'free',
          tokens_consumed: burn.tokens,
          cost_sar: costSar,
          revenue_sar: planPriceSar,
          net_margin_sar: netMarginSar,
        };
      })
      .sort((a, b) => b.cost_sar - a.cost_sar)
      .slice(0, 10);

    const negativeMarginAlert = topDrivers.find((d) => d.plan !== 'free' && d.net_margin_sar < 0);

    return { apiBreakdown, totalCostUsd, totalCostSar, topDrivers, negativeMarginAlert };
  }),

  // ───────────────────────────────────────────────────────────────────────
  // F6 — export CSV for a given YYYY-MM
  // ───────────────────────────────────────────────────────────────────────
  exportCsv: adminProcedure
    .input(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) }))
    .query(async ({ ctx, input }) => {
      const [year, mon] = input.month.split('-').map(Number);
      const monthStart = new Date(year, mon - 1, 1);
      const monthEnd = new Date(year, mon, 1);

      const { data: payments } = await ctx.supabase
        .from('payment_transactions')
        .select('id, user_id, amount_sar, currency, type, status, muyassar_transaction_id, muyassar_invoice_id, created_at, completed_at')
        .gte('created_at', monthStart.toISOString())
        .lt('created_at', monthEnd.toISOString())
        .order('created_at', { ascending: true });

      const rows = payments || [];
      let userMap = new Map<string, any>();
      if (rows.length) {
        const ids = Array.from(new Set(rows.map((r: any) => r.user_id).filter(Boolean)));
        const { data: users } = await ctx.supabase
          .from('profiles')
          .select('id, email, full_name')
          .in('id', ids);
        userMap = new Map((users || []).map((u: any) => [u.id, u]));
      }

      // Saudi VAT 15%
      const VAT_RATE = 0.15;
      const headers = [
        'id', 'created_at', 'completed_at', 'user_email', 'user_name',
        'type', 'status', 'amount_sar', 'vat_sar', 'net_sar', 'currency',
        'muyassar_invoice_id', 'muyassar_transaction_id',
      ];
      const lines = [headers.join(',')];
      for (const r of rows as any[]) {
        const user = userMap.get(r.user_id);
        const amt = Number(r.amount_sar || 0);
        const vat = amt - amt / (1 + VAT_RATE);
        const net = amt - vat;
        const fmt = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        lines.push([
          r.id,
          r.created_at,
          r.completed_at || '',
          user?.email || '',
          user?.full_name || '',
          r.type || '',
          r.status || '',
          amt.toFixed(2),
          vat.toFixed(2),
          net.toFixed(2),
          r.currency || 'SAR',
          r.muyassar_invoice_id || '',
          r.muyassar_transaction_id || '',
        ].map(fmt).join(','));
      }

      // VAT summary row
      const totalAmt = rows.reduce((s: number, r: any) => s + Number(r.amount_sar || 0), 0);
      const totalVat = totalAmt - totalAmt / (1 + VAT_RATE);
      return {
        csv: lines.join('\n'),
        filename: `wassel-finance-${input.month}.csv`,
        totalRows: rows.length,
        totalAmountSar: totalAmt,
        totalVatSar: totalVat,
      };
    }),

  // ───────────────────────────────────────────────────────────────────────
  // F7 — update a system_settings key
  // ───────────────────────────────────────────────────────────────────────
  updateSetting: adminProcedure
    .input(
      z.object({
        key: z.enum(['cash_on_hand_sar', 'usd_sar_rate', 'apify_monthly_cost_usd', 'infra_monthly_cost_usd']),
        value: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { data: existing } = await ctx.supabase
        .from('system_settings')
        .select('id')
        .eq('key', input.key)
        .maybeSingle();
      if (existing?.id) {
        const { error } = await ctx.supabase
          .from('system_settings')
          .update({ value: input.value, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      } else {
        const { error } = await ctx.supabase
          .from('system_settings')
          .insert([{ key: input.key, value: input.value }]);
        if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      }
      return { success: true, key: input.key, value: input.value };
    }),

  // ───────────────────────────────────────────────────────────────────────
  // F8 — generate a manual Moyasar invoice for a user
  // ───────────────────────────────────────────────────────────────────────
  generateInvoice: adminProcedure
    .input(
      z.object({
        userId: z.string().uuid(),
        amountSar: z.number().positive(),
        description: z.string().min(3).max(255),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!isMoyasarConfigured()) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Moyasar is not configured on the server',
        });
      }
      const { data: user } = await ctx.supabase
        .from('profiles')
        .select('email, full_name')
        .eq('id', input.userId)
        .single();
      if (!user) throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });

      // Create a pending payment_transactions row first so we can correlate.
      const { data: txRow, error: txErr } = await ctx.supabase
        .from('payment_transactions')
        .insert([
          {
            user_id: input.userId,
            amount_sar: input.amountSar,
            currency: 'SAR',
            type: 'manual_invoice',
            status: 'pending',
            metadata: { source: 'finance_portal_manual_invoice', description: input.description },
          },
        ])
        .select('id')
        .single();
      if (txErr || !txRow) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: txErr?.message || 'Failed to create payment row' });
      }

      const base =
        process.env.PUBLIC_APP_URL ||
        'https://wasselhub.com';
      const callbackUrl = `${base.replace(/\/$/, '')}/v2/checkout/success?id=${encodeURIComponent(txRow.id)}`;
      try {
        const invoice = await createInvoice({
          amountHalalas: Math.round(input.amountSar * 100),
          description: input.description,
          callbackUrl,
          metadata: { payment_id: txRow.id, source: 'manual_finance_invoice' },
        });
        await ctx.supabase
          .from('payment_transactions')
          .update({ muyassar_invoice_id: invoice.id })
          .eq('id', txRow.id);
        return { paymentId: txRow.id, invoiceUrl: invoice.url, invoiceId: invoice.id };
      } catch (e: any) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: e?.message || 'Moyasar invoice failed' });
      }
    }),

  // ───────────────────────────────────────────────────────────────────────
  // F9 — refund a payment (records the intent; full Moyasar refund API call
  // requires their refunds endpoint which has its own auth — for now we
  // create the refund record and mark the payment, then human follows up
  // in the Moyasar dashboard).
  // ───────────────────────────────────────────────────────────────────────
  refundPayment: adminProcedure
    .input(
      z.object({
        moyasarPaymentId: z.string().min(1),
        reason: z.string().min(3).max(500),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { data: payment } = await ctx.supabase
        .from('payment_transactions')
        .select('id, user_id, amount_sar, status')
        .eq('muyassar_transaction_id', input.moyasarPaymentId)
        .maybeSingle();
      if (!payment) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Payment not found by Moyasar id' });
      }

      // Mark as refunded
      const { error } = await ctx.supabase
        .from('payment_transactions')
        .update({
          status: 'refunded',
          metadata: { refund_reason: input.reason, refunded_at: new Date().toISOString() },
        })
        .eq('id', payment.id);
      if (error) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      }

      return {
        success: true,
        paymentId: payment.id,
        amountSar: Number(payment.amount_sar || 0),
        note: 'Marked refunded in our DB. Execute refund in Moyasar dashboard to complete.',
      };
    }),
});
