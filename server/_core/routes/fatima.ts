import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, publicProcedure } from '../trpc-init';
import { fatima } from '../agents/fatima';

const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const { data: profile } = await ctx.supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', ctx.user.id)
    .single();
  if (!profile?.is_admin) throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
  return next({ ctx });
});

export const fatimaRouter = router({
  detectFrictionPatterns: adminProcedure
    .input(z.object({ lookbackDays: z.number().int().min(1).max(90).optional() }).optional())
    .mutation(async ({ input }) => fatima.detectFrictionPatterns(input)),

  listFrictionPatterns: adminProcedure
    .input(z.object({
      severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
      status: z.enum(['observed', 'acknowledged', 'planned', 'shipped', 'dismissed']).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      let q = ctx.supabase.from('friction_patterns').select('*').order('last_seen', { ascending: false }).limit(200);
      if (input?.severity) q = q.eq('severity', input.severity);
      if (input?.status) q = q.eq('status', input.status);
      const { data } = await q;
      return data || [];
    }),

  acknowledgePattern: adminProcedure
    .input(z.object({ patternId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.supabase.from('friction_patterns').update({
        status: 'acknowledged', acknowledged_at: new Date().toISOString(),
      }).eq('id', input.patternId);
      return { ok: true };
    }),

  dismissPattern: adminProcedure
    .input(z.object({ patternId: z.string().uuid(), reason: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.supabase.from('friction_patterns').update({ status: 'dismissed' }).eq('id', input.patternId);
      return { ok: true };
    }),

  generateWeeklyReport: adminProcedure.mutation(async () => fatima.generateWeeklyReport()),

  latestWeeklyReport: adminProcedure.query(async ({ ctx }) => {
    const { data } = await ctx.supabase
      .from('weekly_intel_reports')
      .select('*')
      .order('week_start', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data;
  }),

  computeFunnel: adminProcedure
    .input(z.object({
      feature: z.string(),
      startDate: z.string(),
      endDate: z.string(),
    }))
    .mutation(async ({ input }) => fatima.computeFunnel(input)),

  digestUserVoice: adminProcedure.mutation(async () => fatima.digestUserVoice()),

  // PUBLIC — frontend mirrors PostHog events into analytics_events
  captureEvent: publicProcedure
    .input(z.object({
      event: z.string().min(1).max(100),
      properties: z.record(z.any()).optional(),
      distinctId: z.string().optional(),
      sessionId: z.string().optional(),
      pageUrl: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user?.id || null;
      await ctx.supabase.from('analytics_events').insert({
        user_id: userId,
        distinct_id: input.distinctId || null,
        event: input.event,
        properties: input.properties || null,
        page_url: input.pageUrl || null,
        session_id: input.sessionId || null,
      });
      return { ok: true };
    }),
});
