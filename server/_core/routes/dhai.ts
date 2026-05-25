import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc-init';
import { dhai } from '../agents/dhai';

const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const { data: profile } = await ctx.supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', ctx.user.id)
    .single();
  if (!profile?.is_admin) throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
  return next({ ctx });
});

export const dhaiRouter = router({
  scanNewSignup: adminProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .mutation(async ({ input }) => dhai.scanNewSignup(input)),

  moderateContent: adminProcedure
    .input(z.object({
      contentId: z.string(),
      contentType: z.enum(['social_post', 'ad_creative', 'blog_post', 'user_generated', 'email']),
      scannedText: z.string().min(1).max(20000),
      language: z.string().optional(),
      sourceAgent: z.string().optional(),
    }))
    .mutation(async ({ input }) => dhai.moderateContent(input)),

  checkLinkedinTos: adminProcedure
    .input(z.object({ text: z.string().min(1).max(20000) }))
    .mutation(async ({ input }) => dhai.checkLinkedinTos(input)),

  listFraudSignals: adminProcedure
    .input(z.object({
      status: z.string().optional(),
      severity: z.string().optional(),
      limit: z.number().int().min(1).max(500).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      let q = ctx.supabase.from('fraud_signals').select('*, profiles(full_name, email)').order('created_at', { ascending: false }).limit(input?.limit ?? 100);
      if (input?.status) q = q.eq('status', input.status);
      if (input?.severity) q = q.eq('severity', input.severity);
      const { data } = await q;
      return data || [];
    }),

  reviewSignal: adminProcedure
    .input(z.object({
      signalId: z.string().uuid(),
      decision: z.enum(['confirmed_fraud', 'false_positive', 'resolved']),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.supabase.from('fraud_signals').update({
        status: input.decision,
        resolution_notes: input.notes || null,
        reviewed_by: ctx.user.id,
        reviewed_at: new Date().toISOString(),
      }).eq('id', input.signalId);
      return { ok: true };
    }),

  logPdplEvent: adminProcedure
    .input(z.object({
      eventType: z.string(),
      userId: z.string().uuid().optional(),
      dataCategory: z.string().optional(),
      details: z.record(z.any()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      await dhai.logPdplEvent({ ...input, performedBy: ctx.user.id });
      return { ok: true };
    }),

  pdplAuditLog: adminProcedure
    .input(z.object({
      userId: z.string().uuid().optional(),
      eventType: z.string().optional(),
      limit: z.number().int().min(1).max(500).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      let q = ctx.supabase.from('pdpl_log').select('*').order('created_at', { ascending: false }).limit(input?.limit ?? 100);
      if (input?.userId) q = q.eq('user_id', input.userId);
      if (input?.eventType) q = q.eq('event_type', input.eventType);
      const { data } = await q;
      return data || [];
    }),

  contentModerationLog: adminProcedure
    .input(z.object({
      decision: z.enum(['approved', 'flagged', 'blocked']).optional(),
      limit: z.number().int().min(1).max(500).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      let q = ctx.supabase.from('content_moderation_log').select('*').order('created_at', { ascending: false }).limit(input?.limit ?? 100);
      if (input?.decision) q = q.eq('decision', input.decision);
      const { data } = await q;
      return data || [];
    }),

  dailySweep: adminProcedure.mutation(async () => dhai.dailyComplianceSweep()),
});
