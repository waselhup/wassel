import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc-init';
import { alMukhadram } from '../agents/al-mukhadram';

const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const { data: profile } = await ctx.supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', ctx.user.id)
    .single();
  if (!profile?.is_admin) throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
  return next({ ctx });
});

export const alMukhadramRouter = router({
  draftWelcomeSequence: adminProcedure.mutation(async () => alMukhadram.draftWelcomeSequence()),

  draftDailyRescues: adminProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).optional() }).optional())
    .mutation(async ({ input }) => alMukhadram.draftDailyRescues(input?.limit)),

  draftSupportReply: adminProcedure
    .input(z.object({
      userId: z.string().uuid(),
      inboundMessage: z.string().min(1).max(4000),
      channel: z.enum(['whatsapp', 'email']),
    }))
    .mutation(async ({ input }) => alMukhadram.draftSupportReply(input)),

  flagVips: adminProcedure.mutation(async () => alMukhadram.flagVipsForOutreach()),

  listEnrollments: adminProcedure
    .input(z.object({
      status: z.enum(['active', 'completed', 'paused', 'exited']).optional(),
      sequenceName: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      let q = ctx.supabase.from('user_sequence_enrollments').select('*, email_sequences(name)').limit(200);
      if (input?.status) q = q.eq('status', input.status);
      const { data } = await q;
      return data || [];
    }),

  enrollUser: adminProcedure
    .input(z.object({ userId: z.string().uuid(), sequenceName: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { data: seq } = await ctx.supabase.from('email_sequences').select('id').eq('name', input.sequenceName).single();
      if (!seq) throw new TRPCError({ code: 'NOT_FOUND', message: 'Sequence not found' });
      const { data, error } = await ctx.supabase.from('user_sequence_enrollments').upsert({
        user_id: input.userId,
        sequence_id: seq.id,
        status: 'active',
        current_step: 0,
        next_send_at: new Date().toISOString(),
      }, { onConflict: 'user_id,sequence_id' }).select('id').single();
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return { enrollmentId: data?.id };
    }),

  exitUser: adminProcedure
    .input(z.object({ userId: z.string().uuid(), sequenceName: z.string(), reason: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { data: seq } = await ctx.supabase.from('email_sequences').select('id').eq('name', input.sequenceName).single();
      if (!seq) return { ok: false };
      await ctx.supabase.from('user_sequence_enrollments')
        .update({ status: 'exited', exit_reason: input.reason || 'manual' })
        .eq('user_id', input.userId).eq('sequence_id', seq.id);
      return { ok: true };
    }),

  healthScore: adminProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .mutation(async ({ input }) => alMukhadram.computeHealthScore(input.userId)),

  recomputeAllScores: adminProcedure
    .input(z.object({ limit: z.number().int().min(1).max(2000).optional() }).optional())
    .mutation(async ({ input }) => alMukhadram.recomputeAllScores(input?.limit)),

  healthCohorts: adminProcedure.query(async ({ ctx }) => {
    const { data } = await ctx.supabase
      .from('user_health_scores')
      .select('segment')
      .limit(10000);
    const counts: Record<string, number> = {};
    for (const r of data || []) counts[r.segment] = (counts[r.segment] || 0) + 1;
    return counts;
  }),

  listHealthScores: adminProcedure
    .input(z.object({
      segment: z.string().optional(),
      limit: z.number().int().min(1).max(500).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      let q = ctx.supabase
        .from('user_health_scores')
        .select('*, profiles(full_name, email, plan, token_balance)')
        .order('score', { ascending: false })
        .limit(input?.limit ?? 50);
      if (input?.segment) q = q.eq('segment', input.segment);
      const { data } = await q;
      return data || [];
    }),

  listWhatsappMessages: adminProcedure
    .input(z.object({ userId: z.string().uuid().optional(), limit: z.number().int().min(1).max(500).optional() }).optional())
    .query(async ({ ctx, input }) => {
      let q = ctx.supabase.from('whatsapp_messages').select('*').order('created_at', { ascending: false }).limit(input?.limit ?? 100);
      if (input?.userId) q = q.eq('user_id', input.userId);
      const { data } = await q;
      return data || [];
    }),

  listEmailMessages: adminProcedure
    .input(z.object({ userId: z.string().uuid().optional(), limit: z.number().int().min(1).max(500).optional() }).optional())
    .query(async ({ ctx, input }) => {
      let q = ctx.supabase.from('email_messages').select('*').order('created_at', { ascending: false }).limit(input?.limit ?? 100);
      if (input?.userId) q = q.eq('user_id', input.userId);
      const { data } = await q;
      return data || [];
    }),

  sendApprovedMessage: adminProcedure
    .input(z.object({ taskId: z.string().uuid() }))
    .mutation(async ({ input }) => alMukhadram.sendApprovedMessage(input.taskId)),
});
