import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';

export const linkedinRouter = router({
  analyze: protectedProcedure
    .input(z.object({ profileUrl: z.string().url() }))
    .mutation(async ({ input, ctx }) => {
      try {
        // Check token balance (need 5 tokens)
        const { data: profile } = await ctx.supabase
          .from('profiles')
          .select('token_balance')
          .eq('id', ctx.user.id)
          .single();

        if (!profile || profile.token_balance < 5) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Insufficient tokens',
          });
        }

        // Mock: Call Apify actor to scrape LinkedIn (placeholder)
        // In production: const result = await apifyClient.actor(actorId).call(input);
        // Mock: Call Claude API to analyze (placeholder)
        const analysis = {
          score: 72,
          headlineCurrent: 'Software Engineer',
          headlineSuggestion:
            'Senior Software Engineer | React & Node.js Expert | Building Scalable SaaS Solutions',
          summaryCurrent: 'I am a software engineer with experience.',
          summarySuggestion:
            'Experienced software engineer specializing in full-stack development with 5+ years of expertise in React, Node.js, and cloud architecture.',
          keywords: ['React', 'Node.js', 'TypeScript', 'SaaS', 'Cloud', 'AI'],
          experienceSuggestions: [
            {
              role: 'Software Engineer',
              suggestion: 'Add metrics and quantify your impact',
            },
          ],
        };

        // Deduct 5 tokens
        const { error: updateError } = await ctx.supabase
          .from('profiles')
          .update({ token_balance: (profile.token_balance || 0) - 5 })
          .eq('id', ctx.user.id);

        if (updateError) throw updateError;
        // Save to linkedin_analyses table
        const { error: insertError } = await ctx.supabase
          .from('linkedin_analyses')
          .insert([
            {
              user_id: ctx.user.id,
              profile_url: input.profileUrl,
              score: analysis.score,
              analysis_data: analysis,
            },
          ]);

        if (insertError) throw insertError;

        return analysis;
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to analyze LinkedIn profile',
        });
      }
    }),

  history: protectedProcedure.query(async ({ ctx }) => {
    try {
      const { data } = await ctx.supabase
        .from('linkedin_analyses')
        .select('*')
        .eq('user_id', ctx.user.id)
        .order('created_at', { ascending: false });

      return data || [];
    } catch (err) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch LinkedIn analysis history',
      });
    }
  }),
});