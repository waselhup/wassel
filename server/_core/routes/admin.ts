import { z } from 'zod';
import { router, protectedProcedure } from '../trpc-init';
import { TRPCError } from '@trpc/server';
import { sendTokenGrantEmail, shouldSendTransactional } from '../lib/email';
import * as fs from 'fs';
import * as path from 'path';

// Middleware to check if user is admin
const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  try {
    const { data: profile } = await ctx.supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', ctx.user.id)
      .single();

    if (!profile?.is_admin) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Admin access required',
      });
    }

    return next({ ctx });
  } catch (err) {
    if (err instanceof TRPCError) throw err;
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to verify admin status',
    });
  }
});

export const adminRouter = router({
  stats: adminProcedure.query(async ({ ctx }) => {
    try {
      // Get user stats
      const { data: users } = await ctx.supabase
        .from('profiles')
        .select('id, created_at, plan');
      // Get active users (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const activeUsers = users?.filter(
        (u) => new Date(u.created_at) > sevenDaysAgo
      ).length || 0;

      // Get campaign stats
      const { data: campaigns } = await ctx.supabase
        .from('email_campaigns')
        .select('id, emails_sent');

      const emailsSent =
        campaigns?.reduce((sum, c) => sum + (c.emails_sent || 0), 0) || 0;

      // Get token purchases
      const { data: transactions } = await ctx.supabase
        .from('token_transactions')
        .select('amount')
        .eq('type', 'purchase');

      const tokensPurchased =
        transactions?.reduce((sum, t) => sum + Math.max(0, t.amount || 0), 0) ||
        0;

      // Calculate MRR (simplified - sum of active subscriptions)
      const planPrices = { free: 0, starter: 99, pro: 199, elite: 299 };
      const mrr =
        users?.reduce(
          (sum, u) =>
            sum +
            (planPrices[u.plan as keyof typeof planPrices] || 0),
          0
        ) || 0;
      return {
        totalUsers: users?.length || 0,
        activeUsers,
        totalCampaigns: campaigns?.length || 0,
        emailsSent,
        tokensPurchased,
        mrr,
      };
    } catch (err) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch stats',
      });
    }
  }),

  users: adminProcedure
    .input(
      z
        .object({
          search: z.string().optional(),
          limit: z.number().int().positive().max(500).default(50),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      try {
        let query = ctx.supabase
          .from('profiles')
          .select('id, email, full_name, plan, token_balance, is_banned, is_admin, created_at, avatar_url')
          .order('created_at', { ascending: false })
          .limit(input?.limit ?? 50);

        const search = input?.search?.trim();
        if (search) {
          const escaped = search.replace(/[%,]/g, '');
          query = query.or(
            `email.ilike.%${escaped}%,full_name.ilike.%${escaped}%`
          );
        }

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
      } catch (err) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch users',
        });
      }
    }),

  addTokens: adminProcedure
    .input(
      z.object({
        userId: z.string().uuid(),
        amount: z.number().int().positive(),
        reason: z.string().min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // Get current balance + recipient info for email
        const { data: profile } = await ctx.supabase
          .from('profiles')
          .select('token_balance, email, full_name, locale')
          .eq('id', input.userId)
          .single();
        if (!profile) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'User not found',
          });
        }

        const newBalance = (profile.token_balance || 0) + input.amount;

        const { error: updateError } = await ctx.supabase
          .from('profiles')
          .update({ token_balance: newBalance })
          .eq('id', input.userId);

        if (updateError) throw updateError;

        const { error: transError } = await ctx.supabase
          .from('token_transactions')
          .insert([
            {
              user_id: input.userId,
              type: 'admin_add',
              amount: input.amount,
              description: input.reason,
            },
          ]);

        if (transError) throw transError;

        try {
          if (
            profile.email &&
            (await shouldSendTransactional(ctx.supabase, input.userId))
          ) {
            const result = await sendTokenGrantEmail({
              user: { email: profile.email, fullName: profile.full_name, language: profile.locale },
              amount: input.amount,
              reason: input.reason,
              newBalance,
            });
            console.log('[admin.addTokens] email result:', result);
          }
        } catch (e: any) {
          console.error('[admin.addTokens] email send failed (non-fatal):', e?.message);
        }

        // Append to markdown grant log (non-blocking, fails silently on read-only FS like Vercel)
        try {
          const now = new Date();
          const pad = (n: number) => String(n).padStart(2, '0');
          const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
          const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
          const logDir = path.join(process.cwd(), 'wassel-wiki', 'raw', 'token-grants');
          const logFile = path.join(logDir, `${dateStr}.md`);
          const line = `- ${timeStr} — granted ${input.amount} tokens to ${profile.full_name || 'Unknown'} (${profile.email || 'no-email'}) — reason: ${input.reason} — new balance: ${newBalance}\n`;
          fs.mkdirSync(logDir, { recursive: true });
          fs.appendFileSync(logFile, line, 'utf8');
        } catch (e: any) {
          console.warn('[admin.addTokens] grant log write failed (non-fatal):', e?.message);
        }

        return { success: true, newBalance };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to add tokens',
        });
      }
    }),

  toggleBan: adminProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      try {
        // Get current ban status
        const { data: profile } = await ctx.supabase
          .from('profiles')
          .select('is_banned')
          .eq('id', input.userId)
          .single();
        if (!profile) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'User not found',
          });
        }

        // Toggle ban
        const { error } = await ctx.supabase
          .from('profiles')
          .update({ is_banned: !profile.is_banned })
          .eq('id', input.userId);

        if (error) throw error;

        return { success: true, banned: !profile.is_banned };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to toggle ban',
        });
      }
    }),

  campaigns: adminProcedure.query(async ({ ctx }) => {
    try {
      const { data: campaigns } = await ctx.supabase
        .from('email_campaigns')
        .select('*')
        .order('created_at', { ascending: false });

      if (!campaigns || campaigns.length === 0) return [];

      // Attach user profile info separately (no FK join needed)
      const userIds = Array.from(new Set(campaigns.map((c: any) => c.user_id).filter(Boolean)));
      const { data: profiles } = await ctx.supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);

      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
      return campaigns.map((c: any) => ({
        ...c,
        profiles: profileMap.get(c.user_id) || null,
      }));
    } catch (err) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch campaigns',
      });
    }
  }),

  systemStatus: protectedProcedure.query(async ({ ctx }) => {
    const adminEmails = ['almodhih.1995@gmail.com', 'waselhup@gmail.com', 'alhashimali649@gmail.com'];
    if (!adminEmails.includes(ctx.user.email || '')) {
      throw new TRPCError({ code: 'FORBIDDEN' });
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: recentErrors } = await ctx.supabase
      .from('api_logs')
      .select('service, status_code, error_msg, created_at, endpoint')
      .gte('created_at', oneHourAgo)
      .gte('status_code', 400)
      .order('created_at', { ascending: false })
      .limit(20);

    const { data: todayCalls } = await ctx.supabase
      .from('api_logs')
      .select('service, status_code')
      .gte('created_at', oneDayAgo);

    const stats: Record<string, { total: number; errors: number }> = {};
    (todayCalls || []).forEach((call: any) => {
      if (!stats[call.service]) stats[call.service] = { total: 0, errors: 0 };
      stats[call.service].total++;
      if (call.status_code >= 400) stats[call.service].errors++;
    });

    return {
      stats,
      recentErrors: recentErrors || [],
      lastChecked: new Date().toISOString(),
    };
  }),

  updateSettings: adminProcedure
    .input(
      z.object({
        key: z.string().min(1),
        value: z.any(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // Look up by key (system_settings schema: id uuid, key varchar, value jsonb)
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
          if (error) throw error;
        } else {
          const { error } = await ctx.supabase
            .from('system_settings')
            .insert([{ key: input.key, value: input.value }]);
          if (error) throw error;
        }

        return { success: true };
      } catch (err) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update settings',
        });
      }
    }),

  // ─────────────────────────────────────────────────────────────────
  // MARKETING COMMAND CENTER — 5 endpoints
  // ─────────────────────────────────────────────────────────────────

  dashboardOverview: adminProcedure.query(async ({ ctx }) => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const today = new Date(now - dayMs).toISOString();
    const yesterday = new Date(now - 2 * dayMs).toISOString();
    const sevenDaysAgo = new Date(now - 7 * dayMs).toISOString();
    const oneHourAgo = new Date(now - 60 * 60 * 1000).toISOString();
    const planPrices: Record<string, number> = { free: 0, starter: 99, pro: 199, elite: 299 };

    // --- Pull last 7 days of profiles, analyses, cvs, transactions in parallel ---
    const [profilesRes, paRes, cvRes, txRes, errorsRes, bannedRes, failedPaymentsRes] = await Promise.all([
      ctx.supabase.from('profiles').select('id, plan, created_at').gte('created_at', sevenDaysAgo),
      ctx.supabase.from('profile_analyses').select('user_id, created_at').gte('created_at', sevenDaysAgo),
      ctx.supabase.from('generated_cvs').select('user_id, created_at').gte('created_at', sevenDaysAgo),
      ctx.supabase.from('token_transactions').select('amount, created_at, type').gte('created_at', sevenDaysAgo),
      ctx.supabase.from('api_logs').select('id').gte('created_at', oneHourAgo).gte('status_code', 500),
      ctx.supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_banned', true),
      ctx.supabase
        .from('payment_transactions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'failed')
        .gte('created_at', today),
    ]);

    // Paying users + MRR (full table — small)
    const { data: allProfiles } = await ctx.supabase.from('profiles').select('plan');
    const payingUsers = (allProfiles || []).filter((p: any) => p.plan && p.plan !== 'free').length;
    const mrr = (allProfiles || []).reduce(
      (s: number, p: any) => s + (planPrices[p.plan as string] || 0),
      0
    );

    // Build day buckets (oldest → newest, 7 entries)
    const bucket = (rows: any[], dateField: string, sumField?: string) => {
      const out: number[] = [];
      for (let i = 6; i >= 0; i--) {
        const dayStart = now - (i + 1) * dayMs;
        const dayEnd = now - i * dayMs;
        if (sumField) {
          const sum = rows
            .filter((r) => {
              const t = new Date(r[dateField]).getTime();
              return t >= dayStart && t < dayEnd;
            })
            .reduce((s, r) => s + Math.abs(Math.min(0, r[sumField] || 0)), 0);
          out.push(sum);
        } else {
          out.push(
            rows.filter((r) => {
              const t = new Date(r[dateField]).getTime();
              return t >= dayStart && t < dayEnd;
            }).length
          );
        }
      }
      return out;
    };

    const profiles = profilesRes.data || [];
    const analyses = paRes.data || [];
    const cvs = cvRes.data || [];
    const txs = txRes.data || [];

    const signups7d = bucket(profiles, 'created_at');
    const tokensBurned7d = bucket(txs.filter((t: any) => (t.amount || 0) < 0), 'created_at', 'amount');

    // Activated = users with ≥1 analysis OR ≥1 CV in window
    const activated7d: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = now - (i + 1) * dayMs;
      const dayEnd = now - i * dayMs;
      const ids = new Set<string>();
      analyses.forEach((a: any) => {
        const t = new Date(a.created_at).getTime();
        if (t >= dayStart && t < dayEnd) ids.add(a.user_id);
      });
      cvs.forEach((c: any) => {
        const t = new Date(c.created_at).getTime();
        if (t >= dayStart && t < dayEnd) ids.add(c.user_id);
      });
      activated7d.push(ids.size);
    }

    // Today vs yesterday for delta
    const signupsToday = profiles.filter((p: any) => p.created_at >= today).length;
    const signupsYesterday = profiles.filter(
      (p: any) => p.created_at >= yesterday && p.created_at < today
    ).length;
    const activatedTodaySet = new Set<string>();
    analyses.forEach((a: any) => {
      if (a.created_at >= today) activatedTodaySet.add(a.user_id);
    });
    cvs.forEach((c: any) => {
      if (c.created_at >= today) activatedTodaySet.add(c.user_id);
    });
    const activatedToday = activatedTodaySet.size;
    const activatedYesterdaySet = new Set<string>();
    analyses.forEach((a: any) => {
      if (a.created_at >= yesterday && a.created_at < today) activatedYesterdaySet.add(a.user_id);
    });
    cvs.forEach((c: any) => {
      if (c.created_at >= yesterday && c.created_at < today) activatedYesterdaySet.add(c.user_id);
    });
    const activatedYesterday = activatedYesterdaySet.size;

    const burnedToday = txs
      .filter((t: any) => (t.amount || 0) < 0 && t.created_at >= today)
      .reduce((s: number, t: any) => s + Math.abs(t.amount), 0);
    const burnedYesterday = txs
      .filter((t: any) => (t.amount || 0) < 0 && t.created_at >= yesterday && t.created_at < today)
      .reduce((s: number, t: any) => s + Math.abs(t.amount), 0);

    const recentErrors = (errorsRes.data || []).length;
    const bannedCount = bannedRes.count || 0;
    const failedPayments = failedPaymentsRes.count || 0;
    const firesCount = recentErrors + bannedCount + failedPayments;

    // MRR sparkline = constant snapshot for now (no historical snapshot table)
    const mrrSpark = new Array(7).fill(mrr);
    const payingSpark = new Array(7).fill(payingUsers);
    const firesSpark = new Array(7).fill(0);
    firesSpark[6] = firesCount;

    return {
      signups: { today: signupsToday, yesterday: signupsYesterday, spark: signups7d },
      activated: { today: activatedToday, yesterday: activatedYesterday, spark: activated7d },
      paying: { today: payingUsers, yesterday: payingUsers, spark: payingSpark },
      mrr: { today: mrr, yesterday: mrr, spark: mrrSpark },
      tokensBurned: { today: burnedToday, yesterday: burnedYesterday, spark: tokensBurned7d },
      fires: {
        today: firesCount,
        yesterday: 0,
        spark: firesSpark,
        breakdown: { errors: recentErrors, banned: bannedCount, failedPayments },
      },
    };
  }),

  funnel: adminProcedure.query(async ({ ctx }) => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Stage 1: signups in last 30d
    const { data: signups } = await ctx.supabase
      .from('profiles')
      .select('id, full_name, locale, plan, onboarded, created_at')
      .gte('created_at', thirtyDaysAgo);

    const signupIds = (signups || []).map((s: any) => s.id);
    const signupCount = signupIds.length;

    // Stage 2: onboarded (has full_name AND locale)
    const onboardedCount = (signups || []).filter(
      (s: any) => s.full_name && s.locale
    ).length;

    // Stage 3: ≥1 profile_analyses
    let firstAnalysisCount = 0;
    if (signupIds.length) {
      const { data: analyses } = await ctx.supabase
        .from('profile_analyses')
        .select('user_id')
        .in('user_id', signupIds);
      firstAnalysisCount = new Set((analyses || []).map((a: any) => a.user_id)).size;
    }

    // Stage 4: ≥1 generated_cvs
    let firstCvCount = 0;
    if (signupIds.length) {
      const { data: cvs } = await ctx.supabase
        .from('generated_cvs')
        .select('user_id')
        .in('user_id', signupIds);
      firstCvCount = new Set((cvs || []).map((c: any) => c.user_id)).size;
    }

    // Stage 5: ≥1 knowledge_items
    let savedKbCount = 0;
    if (signupIds.length) {
      const { data: kb } = await ctx.supabase
        .from('knowledge_items')
        .select('user_id')
        .in('user_id', signupIds);
      savedKbCount = new Set((kb || []).map((k: any) => k.user_id)).size;
    }

    // Stage 6: paid
    const paidCount = (signups || []).filter(
      (s: any) => s.plan && s.plan !== 'free'
    ).length;

    const stages = [
      { key: 'signups', count: signupCount },
      { key: 'onboarded', count: onboardedCount },
      { key: 'firstAnalysis', count: firstAnalysisCount },
      { key: 'firstCv', count: firstCvCount },
      { key: 'savedKb', count: savedKbCount },
      { key: 'paid', count: paidCount },
    ];

    // Find biggest drop-off
    let biggestDropIdx = 0;
    let biggestDropPct = 0;
    for (let i = 1; i < stages.length; i++) {
      const prev = stages[i - 1].count;
      const curr = stages[i].count;
      if (prev > 0) {
        const dropPct = ((prev - curr) / prev) * 100;
        if (dropPct > biggestDropPct) {
          biggestDropPct = dropPct;
          biggestDropIdx = i;
        }
      }
    }

    return { stages, biggestDropIdx, biggestDropPct: Math.round(biggestDropPct) };
  }),

  cohorts: adminProcedure.query(async ({ ctx }) => {
    const now = Date.now();
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
    const fourteenDaysAgo = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: allProfiles } = await ctx.supabase
      .from('profiles')
      .select('id, email, full_name, avatar_url, plan, token_balance, created_at, is_banned')
      .eq('is_banned', false);

    if (!allProfiles?.length) {
      return { hotProspects: [], churnRisk: [], heroes: [] };
    }

    // Aggregate activity per user
    const [paLast7, paLifetime, cvLifetime, kbLifetime, paLast14, cvLast14] = await Promise.all([
      ctx.supabase.from('profile_analyses').select('user_id, created_at').gte('created_at', sevenDaysAgo),
      ctx.supabase.from('profile_analyses').select('user_id'),
      ctx.supabase.from('generated_cvs').select('user_id'),
      ctx.supabase.from('knowledge_items').select('user_id'),
      ctx.supabase.from('profile_analyses').select('user_id, created_at').gte('created_at', fourteenDaysAgo),
      ctx.supabase.from('generated_cvs').select('user_id, created_at').gte('created_at', fourteenDaysAgo),
    ]);

    const count7d = new Map<string, number>();
    (paLast7.data || []).forEach((r: any) => count7d.set(r.user_id, (count7d.get(r.user_id) || 0) + 1));

    const cvCount = new Map<string, number>();
    (cvLifetime.data || []).forEach((r: any) => cvCount.set(r.user_id, (cvCount.get(r.user_id) || 0) + 1));

    const paLifetimeCount = new Map<string, number>();
    (paLifetime.data || []).forEach((r: any) =>
      paLifetimeCount.set(r.user_id, (paLifetimeCount.get(r.user_id) || 0) + 1)
    );

    const kbCount = new Map<string, number>();
    (kbLifetime.data || []).forEach((r: any) => kbCount.set(r.user_id, (kbCount.get(r.user_id) || 0) + 1));

    const lastActive14 = new Set<string>();
    (paLast14.data || []).forEach((r: any) => lastActive14.add(r.user_id));
    (cvLast14.data || []).forEach((r: any) => lastActive14.add(r.user_id));

    const planPrices: Record<string, number> = { free: 0, starter: 99, pro: 199, elite: 299 };

    // 🔥 Hot prospects: free plan, ≥3 analyses in 7d OR ≥1 CV, account 7-30 days old, balance <20
    const hotProspects = allProfiles
      .filter((u: any) => {
        if (u.plan && u.plan !== 'free') return false;
        const age = now - new Date(u.created_at).getTime();
        const days = age / (24 * 60 * 60 * 1000);
        if (days < 7 || days > 30) return false;
        if ((u.token_balance || 0) >= 20) return false;
        const analyses7d = count7d.get(u.id) || 0;
        const cvs = cvCount.get(u.id) || 0;
        return analyses7d >= 3 || cvs >= 1;
      })
      .map((u: any) => ({
        id: u.id,
        email: u.email,
        full_name: u.full_name,
        avatar_url: u.avatar_url,
        plan: u.plan || 'free',
        token_balance: u.token_balance || 0,
        days_old: Math.floor((now - new Date(u.created_at).getTime()) / (24 * 60 * 60 * 1000)),
        analyses_7d: count7d.get(u.id) || 0,
        cvs_lifetime: cvCount.get(u.id) || 0,
      }))
      .sort((a: any, b: any) => b.analyses_7d - a.analyses_7d)
      .slice(0, 20);

    // 💀 Churn risk: paying, no activity in 14 days
    const churnRisk = allProfiles
      .filter((u: any) => u.plan && u.plan !== 'free' && !lastActive14.has(u.id))
      .map((u: any) => ({
        id: u.id,
        email: u.email,
        full_name: u.full_name,
        avatar_url: u.avatar_url,
        plan: u.plan,
        mrr: planPrices[u.plan as string] || 0,
        token_balance: u.token_balance || 0,
        created_at: u.created_at,
      }))
      .slice(0, 20);

    // 🦄 Heroes: paying with ≥10 analyses OR ≥5 KB items
    const heroes = allProfiles
      .filter((u: any) => {
        if (!u.plan || u.plan === 'free') return false;
        const analyses = paLifetimeCount.get(u.id) || 0;
        const kb = kbCount.get(u.id) || 0;
        return analyses >= 10 || kb >= 5;
      })
      .map((u: any) => ({
        id: u.id,
        email: u.email,
        full_name: u.full_name,
        avatar_url: u.avatar_url,
        plan: u.plan,
        analyses_lifetime: paLifetimeCount.get(u.id) || 0,
        cvs_lifetime: cvCount.get(u.id) || 0,
        kb_items: kbCount.get(u.id) || 0,
      }))
      .sort((a: any, b: any) => b.analyses_lifetime - a.analyses_lifetime)
      .slice(0, 20);

    return { hotProspects, churnRisk, heroes };
  }),

  tokenEconomy: adminProcedure.query(async ({ ctx }) => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: txs } = await ctx.supabase
      .from('token_transactions')
      .select('user_id, amount, type, description, created_at')
      .gte('created_at', thirtyDaysAgo);

    const burns = (txs || []).filter((t: any) => (t.amount || 0) < 0);

    // Categorize burns by description keywords
    const categorize = (desc: string): 'linkedin' | 'cv' | 'campaign' | 'other' => {
      const d = (desc || '').toLowerCase();
      if (d.includes('linkedin') || d.includes('analysis') || d.includes('analyze') || d.includes('profile'))
        return 'linkedin';
      if (d.includes('cv') || d.includes('resume') || d.includes('cover')) return 'cv';
      if (d.includes('campaign') || d.includes('preview') || d.includes('message')) return 'campaign';
      return 'other';
    };

    const byCategory: Record<string, number> = { linkedin: 0, cv: 0, campaign: 0, other: 0 };
    burns.forEach((t: any) => {
      byCategory[categorize(t.description || '')] += Math.abs(t.amount);
    });

    // Anthropic pricing approximations — assume avg 2K input tokens per call
    // Haiku: $0.80/M, Sonnet: $3/M  →  per-call cost
    const HAIKU_PER_CALL = (2000 / 1_000_000) * 0.8;
    const SONNET_PER_CALL = (2000 / 1_000_000) * 3.0;
    // Treat each abs(token) burn from the wassel token system as one call worth of cost (heuristic)
    const costUSD = {
      linkedin: byCategory.linkedin * HAIKU_PER_CALL,
      cv: byCategory.cv * SONNET_PER_CALL,
      campaign: byCategory.campaign * SONNET_PER_CALL,
      other: 0,
    };
    const totalCostUSD = costUSD.linkedin + costUSD.cv + costUSD.campaign;

    const burnByCategory = [
      { key: 'linkedin', tokens: byCategory.linkedin, cost_usd: costUSD.linkedin },
      { key: 'cv', tokens: byCategory.cv, cost_usd: costUSD.cv },
      { key: 'campaign', tokens: byCategory.campaign, cost_usd: costUSD.campaign },
      { key: 'other', tokens: byCategory.other, cost_usd: costUSD.other },
    ];

    // Top 10 consumers by absolute burn in 30d
    const perUser = new Map<string, number>();
    burns.forEach((t: any) => {
      perUser.set(t.user_id, (perUser.get(t.user_id) || 0) + Math.abs(t.amount));
    });
    const topIds = Array.from(perUser.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id]) => id);

    let topConsumers: any[] = [];
    if (topIds.length) {
      const { data: prof } = await ctx.supabase
        .from('profiles')
        .select('id, email, full_name, plan, token_balance')
        .in('id', topIds);

      const planPrices: Record<string, number> = { free: 0, starter: 99, pro: 199, elite: 299 };
      const SAR_PER_USD = 3.75;
      topConsumers = (prof || [])
        .map((p: any) => {
          const tokens = perUser.get(p.id) || 0;
          const cost_usd = tokens * HAIKU_PER_CALL;
          const planPriceSar = planPrices[p.plan as string] || 0;
          const planPriceUsd = planPriceSar / SAR_PER_USD;
          const marginPct = planPriceUsd > 0 ? (cost_usd / planPriceUsd) * 100 : null;
          return {
            id: p.id,
            email: p.email,
            full_name: p.full_name,
            plan: p.plan || 'free',
            token_balance: p.token_balance || 0,
            tokens_consumed: tokens,
            cost_usd,
            margin_pct: marginPct,
          };
        })
        .sort((a: any, b: any) => b.tokens_consumed - a.tokens_consumed);
    }

    // Margin alert: any paying user where cost > 30% of plan price
    const marginAlert = topConsumers.find(
      (c: any) => c.margin_pct !== null && c.margin_pct > 30
    );

    return { burnByCategory, top10Consumers: topConsumers, totalCostUSD, marginAlert };
  }),

  growthSignals: adminProcedure.query(async ({ ctx }) => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const dayMs = 24 * 60 * 60 * 1000;
    const now = Date.now();

    const { data: signups } = await ctx.supabase
      .from('profiles')
      .select('id, locale, created_at')
      .gte('created_at', thirtyDaysAgo);

    if (!signups?.length) {
      return {
        activationRate30d: 0,
        ttfvMinutes: null as number | null,
        kbExportRate: 0,
        localeSplit: { ar: 0, en: 0, other: 0 },
        activationSpark: new Array(30).fill(0),
        signupsCount: 0,
        activatedCount: 0,
      };
    }

    const signupIds = signups.map((s: any) => s.id);
    const signupMap = new Map(signups.map((s: any) => [s.id, new Date(s.created_at).getTime()]));

    // First analysis per user (within 24h of signup = activated)
    const { data: analyses } = await ctx.supabase
      .from('profile_analyses')
      .select('user_id, created_at')
      .in('user_id', signupIds)
      .order('created_at', { ascending: true });

    const firstAnalysisMap = new Map<string, number>();
    (analyses || []).forEach((a: any) => {
      if (!firstAnalysisMap.has(a.user_id)) {
        firstAnalysisMap.set(a.user_id, new Date(a.created_at).getTime());
      }
    });

    let activatedCount = 0;
    const ttfvSamples: number[] = [];
    for (const userId of signupIds) {
      const signedAt = signupMap.get(userId)!;
      const firstAt = firstAnalysisMap.get(userId);
      if (firstAt && firstAt - signedAt <= 24 * 60 * 60 * 1000) {
        activatedCount++;
        ttfvSamples.push((firstAt - signedAt) / 60000);
      }
    }
    const activationRate30d = signups.length > 0 ? (activatedCount / signups.length) * 100 : 0;

    // Median TTFV
    ttfvSamples.sort((a, b) => a - b);
    const median = ttfvSamples.length
      ? ttfvSamples[Math.floor(ttfvSamples.length / 2)]
      : null;

    // KB export rate = users with knowledge_items / activated users
    const activatedIds = Array.from(firstAnalysisMap.keys());
    let kbUsers = 0;
    if (activatedIds.length) {
      const { data: kb } = await ctx.supabase
        .from('knowledge_items')
        .select('user_id')
        .in('user_id', activatedIds);
      kbUsers = new Set((kb || []).map((k: any) => k.user_id)).size;
    }
    const kbExportRate = activatedIds.length > 0 ? (kbUsers / activatedIds.length) * 100 : 0;

    // Locale split
    const localeSplit = { ar: 0, en: 0, other: 0 };
    signups.forEach((s: any) => {
      if (s.locale === 'ar') localeSplit.ar++;
      else if (s.locale === 'en') localeSplit.en++;
      else localeSplit.other++;
    });

    // Activation sparkline (last 30 days, per-day activation %)
    const activationSpark: number[] = [];
    for (let i = 29; i >= 0; i--) {
      const dayStart = now - (i + 1) * dayMs;
      const dayEnd = now - i * dayMs;
      const daySignups = signups.filter((s: any) => {
        const t = new Date(s.created_at).getTime();
        return t >= dayStart && t < dayEnd;
      });
      const dayActivated = daySignups.filter((s: any) => {
        const first = firstAnalysisMap.get(s.id);
        return first && first - new Date(s.created_at).getTime() <= 24 * 60 * 60 * 1000;
      }).length;
      activationSpark.push(daySignups.length > 0 ? (dayActivated / daySignups.length) * 100 : 0);
    }

    return {
      activationRate30d,
      ttfvMinutes: median,
      kbExportRate,
      localeSplit,
      activationSpark,
      signupsCount: signups.length,
      activatedCount,
    };
  }),
});