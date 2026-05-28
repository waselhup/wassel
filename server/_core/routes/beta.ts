import { z } from 'zod';
import { router, protectedProcedure } from '../trpc-init';
import { TRPCError } from '@trpc/server';

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
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to verify admin status' });
  }
});

export const betaRouter = router({
  // User: redeem a promo code
  redeemCode: protectedProcedure
    .input(z.object({ code: z.string().min(3).max(50) }))
    .mutation(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase.rpc('redeem_promo_code', {
        p_code: input.code,
        p_user_id: ctx.user.id,
      });
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return data as { success: boolean; error?: string; granted_tokens?: number; granted_plan?: string; granted_months?: number };
    }),

  // User: submit feedback
  submitFeedback: protectedProcedure
    .input(z.object({
      pillar: z.enum(['radar', 'resume', 'content', 'dashboard', 'general']),
      nps: z.number().int().min(0).max(10),
      what_worked: z.string().max(2000).optional(),
      what_didnt: z.string().max(2000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase
        .from('beta_feedback')
        .insert({
          user_id: ctx.user.id,
          pillar: input.pillar,
          nps: input.nps,
          what_worked: input.what_worked ?? null,
          what_didnt: input.what_didnt ?? null,
          user_email: ctx.user.email ?? null,
        });
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return { success: true };
    }),

  // Admin: create promo code
  createCode: adminProcedure
    .input(z.object({
      code: z.string().min(3).max(50),
      cohort: z.string().default('beta'),
      granted_plan: z.enum(['starter', 'growth']),
      granted_tokens: z.number().int().min(0).default(0),
      granted_months: z.number().int().min(1).max(12).default(3),
      max_redemptions: z.number().int().min(1).max(100).default(1),
      notes: z.string().optional(),
      expires_in_days: z.number().int().min(1).max(365).default(60),
    }))
    .mutation(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('promo_codes')
        .insert({
          code: input.code.toUpperCase().trim(),
          cohort: input.cohort,
          granted_plan: input.granted_plan,
          granted_tokens: input.granted_tokens,
          granted_months: input.granted_months,
          max_redemptions: input.max_redemptions,
          notes: input.notes ?? null,
          expires_at: new Date(Date.now() + input.expires_in_days * 86400000).toISOString(),
          created_by: ctx.user.id,
        })
        .select()
        .single();
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return data;
    }),

  // Admin: list all promo codes
  listCodes: adminProcedure.query(async ({ ctx }) => {
    const { data, error } = await ctx.supabase
      .from('promo_codes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });

    // Attach redemption count per code
    const ids = (data ?? []).map((c: { id: string }) => c.id);
    const { data: redemptions } = await ctx.supabase
      .from('promo_redemptions')
      .select('promo_code_id')
      .in('promo_code_id', ids);

    const countMap: Record<string, number> = {};
    for (const r of redemptions ?? []) {
      countMap[r.promo_code_id] = (countMap[r.promo_code_id] ?? 0) + 1;
    }

    return (data ?? []).map((c: Record<string, unknown>) => ({
      ...c,
      actual_redemptions: countMap[c.id as string] ?? 0,
    }));
  }),

  // Admin: list feedback
  listFeedback: adminProcedure
    .input(z.object({
      pillar: z.string().optional(),
      limit: z.number().int().min(1).max(200).default(50),
    }))
    .query(async ({ ctx, input }) => {
      let query = ctx.supabase
        .from('beta_feedback')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(input.limit);

      if (input.pillar) {
        query = query.eq('pillar', input.pillar);
      }

      const { data, error } = await query;
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return data ?? [];
    }),

  // Admin: beta program metrics
  getMetrics: adminProcedure.query(async ({ ctx }) => {
    const [{ count: totalRedemptions }, { count: totalFeedback }, { data: npsData }] =
      await Promise.all([
        ctx.supabase.from('promo_redemptions').select('*', { count: 'exact', head: true }),
        ctx.supabase.from('beta_feedback').select('*', { count: 'exact', head: true }),
        ctx.supabase.from('beta_feedback').select('nps'),
      ]);

    const scores = (npsData ?? []).map((r: { nps: number }) => r.nps);
    const avgNps = scores.length > 0 ? scores.reduce((s: number, n: number) => s + n, 0) / scores.length : 0;
    const promoters = scores.filter((n: number) => n >= 9).length;
    const passives = scores.filter((n: number) => n >= 7 && n <= 8).length;
    const detractors = scores.filter((n: number) => n <= 6).length;

    return {
      total_redemptions: totalRedemptions ?? 0,
      total_feedback: totalFeedback ?? 0,
      avg_nps: Math.round(avgNps * 10) / 10,
      promoters,
      passives,
      detractors,
      nps_score: scores.length > 0
        ? Math.round(((promoters - detractors) / scores.length) * 100)
        : 0,
    };
  }),
});
