import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';

export const cvRouter = router({
  generate: protectedProcedure
    .input(z.object({ fields: z.array(z.string()).min(1).max(3) }))
    .mutation(async ({ input, ctx }) => {
      try {
        // Check token balance (need 10 tokens)
        const { data: profile } = await ctx.supabase
          .from('profiles')
          .select('token_balance')
          .eq('id', ctx.user.id)
          .single();

        if (!profile || profile.token_balance < 10) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Insufficient tokens',
          });
        }

        // Mock: Call Claude API to generate tailored CVs
        const versions = input.fields.map((field) => ({          fieldName: field,
          headline: `Senior ${field} Professional | Expert in Modern Technologies`,
          summary: `Experienced professional specializing in ${field} with proven track record of delivering high-impact solutions and driving organizational growth.`,
          skills: ['Skill 1', 'Skill 2', 'Skill 3', 'Skill 4', 'Skill 5'],
          experience: [
            {
              title: `Senior ${field} Professional`,
              company: 'Company',
              duration: '3+ years',
              description: `Led ${field} initiatives, improved processes, and delivered measurable results. Managed cross-functional teams and drove innovation in the field.`,
            },
          ],
        }));

        // Deduct 10 tokens
        const { error: updateError } = await ctx.supabase
          .from('profiles')
          .update({ token_balance: (profile.token_balance || 0) - 10 })
          .eq('id', ctx.user.id);

        if (updateError) throw updateError;

        // Save to cv_versions table
        const { error: insertError } = await ctx.supabase
          .from('cv_versions')
          .insert([
            {
              user_id: ctx.user.id,
              fields: input.fields,
              versions_data: versions,
            },
          ]);
        if (insertError) throw insertError;

        return { versions };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to generate CV versions',
        });
      }
    }),

  history: protectedProcedure.query(async ({ ctx }) => {
    try {
      const { data } = await ctx.supabase
        .from('cv_versions')
        .select('*')
        .eq('user_id', ctx.user.id)
        .order('created_at', { ascending: false });

      return data || [];
    } catch (err) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch CV history',
      });
    }
  }),
});