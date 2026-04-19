import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc-init';

const TimeRange = z.enum(['today', 'week', 'month', 'all']);

function rangeToSinceIso(range: string): string | null {
  const now = new Date();
  switch (range) {
    case 'today':
      now.setHours(0, 0, 0, 0);
      return now.toISOString();
    case 'week':
      now.setDate(now.getDate() - 7);
      return now.toISOString();
    case 'month':
      now.setMonth(now.getMonth() - 1);
      return now.toISOString();
    default:
      return null;
  }
}

async function safeCount(
  supabase: any,
  table: string,
  userId: string,
  sinceIso: string | null,
  userIdCol = 'user_id'
): Promise<number> {
  try {
    let q = supabase
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq(userIdCol, userId);
    if (sinceIso) q = q.gte('created_at', sinceIso);
    const { count, error } = await q;
    if (error) {
      console.warn(`[analytics] safeCount ${table} error:`, error.message);
      return 0;
    }
    return count || 0;
  } catch (err: any) {
    console.warn(`[analytics] safeCount ${table} threw:`, err?.message);
    return 0;
  }
}

export const analyticsRouter = router({
  // 8 KPIs + token balance
  overview: protectedProcedure
    .input(z.object({ range: TimeRange.default('month') }))
    .query(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      const sinceIso = rangeToSinceIso(input.range);

      const [
        analyses,
        cvs,
        posts,
        activeEmailCampaigns,
        activeJobCampaigns,
        emailRecipientStats,
        jobsApplied,
        profile,
      ] = await Promise.all([
        safeCount(ctx.supabase, 'linkedin_analyses', userId, sinceIso),
        safeCount(ctx.supabase, 'cv_versions', userId, sinceIso),
        safeCount(ctx.supabase, 'posts', userId, sinceIso),
        // Active email campaigns count
        (async () => {
          try {
            const { count } = await ctx.supabase
              .from('email_campaigns')
              .select('id', { count: 'exact', head: true })
              .eq('user_id', userId)
              .in('status', ['active', 'sending', 'running']);
            return count || 0;
          } catch {
            return 0;
          }
        })(),
        (async () => {
          try {
            const { count } = await ctx.supabase
              .from('job_campaigns')
              .select('id', { count: 'exact', head: true })
              .eq('user_id', userId)
              .eq('status', 'active');
            return count || 0;
          } catch {
            return 0;
          }
        })(),
        // sent + replied across email_recipients (for response rate)
        (async () => {
          try {
            // Get user's email campaigns first
            const { data: camps } = await ctx.supabase
              .from('email_campaigns')
              .select('id')
              .eq('user_id', userId);
            const campIds = (camps || []).map((c: any) => c.id);
            if (campIds.length === 0) return { sent: 0, replied: 0 };

            let sentQuery = ctx.supabase
              .from('email_recipients')
              .select('id', { count: 'exact', head: true })
              .in('campaign_id', campIds)
              .in('status', ['sent', 'opened', 'replied', 'delivered']);
            if (sinceIso) sentQuery = sentQuery.gte('created_at', sinceIso);
            const { count: sent } = await sentQuery;

            let repliedQuery = ctx.supabase
              .from('email_recipients')
              .select('id', { count: 'exact', head: true })
              .in('campaign_id', campIds)
              .eq('status', 'replied');
            if (sinceIso) repliedQuery = repliedQuery.gte('created_at', sinceIso);
            const { count: replied } = await repliedQuery;

            return { sent: sent || 0, replied: replied || 0 };
          } catch (e: any) {
            console.warn('[analytics] email recipients stats failed:', e?.message);
            return { sent: 0, replied: 0 };
          }
        })(),
        (async () => {
          try {
            let q = ctx.supabase
              .from('jobs')
              .select('id', { count: 'exact', head: true })
              .eq('user_id', userId)
              .eq('status', 'applied');
            if (sinceIso) q = q.gte('created_at', sinceIso);
            const { count } = await q;
            return count || 0;
          } catch {
            return 0;
          }
        })(),
        (async () => {
          try {
            const { data } = await ctx.supabase
              .from('profiles')
              .select('token_balance')
              .eq('id', userId)
              .single();
            return data;
          } catch {
            return null;
          }
        })(),
      ]);

      // Tokens used (sum of negative amounts in token_transactions for this period)
      let tokensUsed = 0;
      try {
        let q = ctx.supabase
          .from('token_transactions')
          .select('amount')
          .eq('user_id', userId);
        if (sinceIso) q = q.gte('created_at', sinceIso);
        const { data: txs } = await q;
        tokensUsed = (txs || [])
          .filter((r: any) => r.amount < 0)
          .reduce((s: number, r: any) => s + Math.abs(r.amount), 0);
      } catch (e: any) {
        console.warn('[analytics] tokens_used failed:', e?.message);
      }

      const sentSafe = emailRecipientStats.sent || 1;
      const responseRate = Math.round(
        (emailRecipientStats.replied / sentSafe) * 100
      );

      return {
        range: input.range,
        kpis: {
          profile_analyses: analyses,
          cvs_generated: cvs,
          posts_generated: posts,
          campaigns_active: activeEmailCampaigns + activeJobCampaigns,
          messages_sent: emailRecipientStats.sent,
          connections_accepted: emailRecipientStats.replied,
          response_rate: responseRate,
          jobs_applied: jobsApplied,
        },
        tokens: {
          balance: profile?.token_balance || 0,
          used_total: tokensUsed,
        },
      };
    }),

  // Daily activity timeseries
  activityTimeseries: protectedProcedure
    .input(z.object({ days: z.number().min(7).max(90).default(30) }))
    .query(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      const since = new Date();
      since.setHours(0, 0, 0, 0);
      since.setDate(since.getDate() - (input.days - 1));
      const sinceIso = since.toISOString();

      const [a, c, p] = await Promise.all([
        ctx.supabase
          .from('linkedin_analyses')
          .select('created_at')
          .eq('user_id', userId)
          .gte('created_at', sinceIso),
        ctx.supabase
          .from('cv_versions')
          .select('created_at')
          .eq('user_id', userId)
          .gte('created_at', sinceIso),
        ctx.supabase
          .from('posts')
          .select('created_at')
          .eq('user_id', userId)
          .gte('created_at', sinceIso),
      ]);

      const days: Record<
        string,
        { date: string; analyses: number; cvs: number; posts: number }
      > = {};
      for (let i = input.days - 1; i >= 0; i--) {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split('T')[0];
        days[key] = { date: key, analyses: 0, cvs: 0, posts: 0 };
      }

      (a.data || []).forEach((r: any) => {
        const k = r.created_at.split('T')[0];
        if (days[k]) days[k].analyses++;
      });
      (c.data || []).forEach((r: any) => {
        const k = r.created_at.split('T')[0];
        if (days[k]) days[k].cvs++;
      });
      (p.data || []).forEach((r: any) => {
        const k = r.created_at.split('T')[0];
        if (days[k]) days[k].posts++;
      });

      return Object.values(days);
    }),

  // Top 10 email campaigns with performance
  campaignPerformance: protectedProcedure.query(async ({ ctx }) => {
    try {
      const { data: camps } = await ctx.supabase
        .from('email_campaigns')
        .select(
          'id, campaign_name, status, total_recipients, emails_sent, opens_count, replies_count, created_at'
        )
        .eq('user_id', ctx.user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      return (camps || []).map((c: any) => {
        const sent = c.emails_sent || 0;
        const replies = c.replies_count || 0;
        const acceptanceRate = sent > 0 ? Math.round((replies / sent) * 100) : 0;
        return {
          id: c.id,
          name: c.campaign_name || 'Untitled',
          status: c.status || 'draft',
          prospects_count: c.total_recipients || 0,
          sent,
          accepted: replies,
          acceptance_rate: acceptanceRate,
        };
      });
    } catch (err: any) {
      console.warn('[analytics] campaignPerformance failed:', err?.message);
      return [];
    }
  }),

  // Status distribution from email_recipients (real outreach data)
  prospectStatusDistribution: protectedProcedure.query(async ({ ctx }) => {
    try {
      const { data: camps } = await ctx.supabase
        .from('email_campaigns')
        .select('id')
        .eq('user_id', ctx.user.id);
      const campIds = (camps || []).map((c: any) => c.id);
      if (campIds.length === 0) return [];

      const { data } = await ctx.supabase
        .from('email_recipients')
        .select('status')
        .in('campaign_id', campIds);

      const dist: Record<string, number> = {};
      (data || []).forEach((r: any) => {
        const s = r.status || 'unknown';
        dist[s] = (dist[s] || 0) + 1;
      });

      return Object.entries(dist).map(([status, count]) => ({ status, count }));
    } catch (err: any) {
      console.warn('[analytics] statusDistribution failed:', err?.message);
      return [];
    }
  }),

  // Token usage breakdown by transaction type
  tokensBreakdown: protectedProcedure
    .input(z.object({ range: TimeRange.default('month') }))
    .query(async ({ input, ctx }) => {
      try {
        const sinceIso = rangeToSinceIso(input.range);
        let q = ctx.supabase
          .from('token_transactions')
          .select('type, amount, description')
          .eq('user_id', ctx.user.id);
        if (sinceIso) q = q.gte('created_at', sinceIso);
        const { data } = await q;

        const breakdown: Record<string, number> = {};
        (data || [])
          .filter((t: any) => t.amount < 0)
          .forEach((t: any) => {
            const feature =
              t.type ||
              (t.description ? t.description.slice(0, 20) : 'other');
            breakdown[feature] = (breakdown[feature] || 0) + Math.abs(t.amount);
          });

        return Object.entries(breakdown)
          .map(([feature, total]) => ({ feature, total }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 8);
      } catch (err: any) {
        console.warn('[analytics] tokensBreakdown failed:', err?.message);
        return [];
      }
    }),
});
