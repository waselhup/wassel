import { z } from 'zod';
import { router, protectedProcedure } from '../trpc-init';
import { TRPCError } from '@trpc/server';

const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const { data: profile } = await ctx.supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', ctx.user.id)
    .single();
  if (!profile?.is_admin) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
  }
  return next({ ctx });
});

const FEATURES = ['profile_analysis', 'cv_tailor', 'posts', 'campaigns', 'campaign_message'] as const;

export const aiFeedbackRouter = router({
  submit: protectedProcedure
    .input(
      z.object({
        feature: z.enum(FEATURES),
        outputId: z.string().optional(),
        rating: z.number().int().min(1).max(5),
        comment: z.string().max(2000).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { data, error } = await ctx.supabase
        .from('ai_feedback')
        .insert([
          {
            user_id: ctx.user.id,
            feature: input.feature,
            output_id: input.outputId || null,
            rating: input.rating,
            comment: input.comment || null,
          },
        ])
        .select()
        .single();
      if (error) {
        console.error('[AI_FEEDBACK] submit error:', error);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      }
      return { id: data.id, success: true };
    }),

  list: adminProcedure
    .input(
      z.object({
        feature: z.string().optional(),
        rating: z.number().int().min(1).max(5).optional(),
        limit: z.number().int().min(1).max(200).default(50),
      }),
    )
    .query(async ({ input, ctx }) => {
      let q = ctx.supabase
        .from('ai_feedback')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(input.limit);
      if (input.feature) q = q.eq('feature', input.feature);
      if (input.rating) q = q.eq('rating', input.rating);
      const { data, error } = await q;
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return data || [];
    }),

  stats: adminProcedure.query(async ({ ctx }) => {
    const { data, error } = await ctx.supabase
      .from('ai_feedback')
      .select('feature, rating');
    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });

    const byFeature: Record<string, { total: number; avg: number; sum: number }> = {};
    for (const row of data || []) {
      const f = (row as any).feature;
      if (!byFeature[f]) byFeature[f] = { total: 0, avg: 0, sum: 0 };
      byFeature[f].total++;
      byFeature[f].sum += (row as any).rating || 0;
    }
    Object.keys(byFeature).forEach((f) => {
      byFeature[f].avg = byFeature[f].total > 0 ? byFeature[f].sum / byFeature[f].total : 0;
    });
    return byFeature;
  }),

  listPrompts: adminProcedure
    .input(z.object({ feature: z.string().optional() }))
    .query(async ({ input, ctx }) => {
      let q = ctx.supabase
        .from('ai_prompts')
        .select('*')
        .order('created_at', { ascending: false });
      if (input.feature) q = q.eq('feature', input.feature);
      const { data, error } = await q;
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return data || [];
    }),

  savePrompt: adminProcedure
    .input(
      z.object({
        feature: z.string(),
        promptText: z.string().min(10).max(20000),
        activate: z.boolean().default(false),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { data: existing } = await ctx.supabase
        .from('ai_prompts')
        .select('version')
        .eq('feature', input.feature)
        .order('version', { ascending: false })
        .limit(1);
      const nextVersion = (existing?.[0]?.version || 0) + 1;

      if (input.activate) {
        await ctx.supabase
          .from('ai_prompts')
          .update({ is_active: false })
          .eq('feature', input.feature);
      }

      const { data, error } = await ctx.supabase
        .from('ai_prompts')
        .insert([
          {
            feature: input.feature,
            version: nextVersion,
            prompt_text: input.promptText,
            is_active: input.activate,
            created_by: ctx.user.id,
          },
        ])
        .select()
        .single();

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return data;
    }),

  activatePrompt: adminProcedure
    .input(z.object({ promptId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const { data: prompt } = await ctx.supabase
        .from('ai_prompts')
        .select('feature')
        .eq('id', input.promptId)
        .single();
      if (!prompt) throw new TRPCError({ code: 'NOT_FOUND' });

      await ctx.supabase
        .from('ai_prompts')
        .update({ is_active: false })
        .eq('feature', (prompt as any).feature);

      const { error } = await ctx.supabase
        .from('ai_prompts')
        .update({ is_active: true })
        .eq('id', input.promptId);
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return { success: true };
    }),
});
