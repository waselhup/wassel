import { z } from 'zod';
import { router, protectedProcedure } from '../trpc-init';
import { TRPCError } from '@trpc/server';

export const knowledgeRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const { data, error } = await ctx.supabase
      .from('knowledge_items')
      .select('*')
      .eq('user_id', ctx.user.id)
      .order('created_at', { ascending: false });
    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
    return data || [];
  }),

  save: protectedProcedure
    .input(z.object({
      type: z.enum(['linkedin_analysis', 'campaign_result', 'market_insight']),
      title: z.string().min(1),
      content: z.any(),
      tags: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { data, error } = await ctx.supabase
        .from('knowledge_items')
        .insert([{
          user_id: ctx.user.id,
          type: input.type,
          title: input.title,
          content: input.content,
          tags: input.tags || [],
        }])
        .select()
        .single();
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return data;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const { error } = await ctx.supabase
        .from('knowledge_items')
        .delete()
        .eq('id', input.id)
        .eq('user_id', ctx.user.id);
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return { success: true };
    }),

  export: protectedProcedure.query(async ({ ctx }) => {
    // Fetch all linkedin analyses
    const { data: analyses } = await ctx.supabase
      .from('linkedin_analyses')
      .select('*')
      .eq('user_id', ctx.user.id)
      .order('created_at', { ascending: false });

    // Fetch all campaigns
    const { data: campaigns } = await ctx.supabase
      .from('campaigns')
      .select('*')
      .eq('user_id', ctx.user.id)
      .order('created_at', { ascending: false });

    // Fetch all knowledge items
    const { data: knowledgeItems } = await ctx.supabase
      .from('knowledge_items')
      .select('*')
      .eq('user_id', ctx.user.id)
      .order('created_at', { ascending: false });

    // Fetch CV versions
    const { data: cvVersions } = await ctx.supabase
      .from('cv_versions')
      .select('*')
      .eq('user_id', ctx.user.id)
      .order('created_at', { ascending: false });

    return {
      exportedAt: new Date().toISOString(),
      linkedinAnalyses: analyses || [],
      campaigns: campaigns || [],
      knowledgeItems: knowledgeItems || [],
      cvVersions: cvVersions || [],
      marketInsights: {
        region: 'Saudi Arabia / GCC',
        tips: [
          'LinkedIn is the #1 professional network in Saudi Arabia with 10M+ users',
          'Arabic content gets 3x more engagement than English in Saudi LinkedIn',
          'Vision 2030 keywords boost visibility in government sector outreach',
          'Include certifications and endorsements — highly valued in GCC hiring',
          'Post between 8-10 AM AST for maximum Saudi audience engagement',
          'Use formal Modern Standard Arabic (فصحى) for professional profiles',
          'Highlight cross-cultural experience — valued in multinational GCC companies',
          'Saudi employers value LinkedIn recommendations from industry leaders',
        ],
      },
    };
  }),
});
