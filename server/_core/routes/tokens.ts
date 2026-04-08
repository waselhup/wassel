import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';

export const tokenRouter = router({
  balance: protectedProcedure.query(async ({ ctx }) => {
    try {
      const { data: profile } = await ctx.supabase
        .from('profiles')
        .select('token_balance')
        .eq('id', ctx.user.id)
        .single();

      return { balance: profile?.token_balance || 0 };
    } catch (err) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch token balance',
      });
    }
  }),

  history: protectedProcedure.query(async ({ ctx }) => {
    try {
      const { data } = await ctx.supabase
        .from('token_transactions')        .select('*')
        .eq('user_id', ctx.user.id)
        .order('created_at', { ascending: false });

      return data || [];
    } catch (err) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch transaction history',
      });
    }
  }),

  spend: protectedProcedure
    .input(
      z.object({
        amount: z.number().int().positive(),
        description: z.string().min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // Check balance
        const { data: profile } = await ctx.supabase
          .from('profiles')
          .select('token_balance')
          .eq('id', ctx.user.id)
          .single();

        if (!profile || profile.token_balance < input.amount) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Insufficient tokens',
          });
        }
        // Deduct tokens
        const { error: updateError } = await ctx.supabase
          .from('profiles')
          .update({ token_balance: (profile.token_balance || 0) - input.amount })
          .eq('id', ctx.user.id);

        if (updateError) throw updateError;

        // Log transaction
        const { error: transError } = await ctx.supabase
          .from('token_transactions')
          .insert([
            {
              user_id: ctx.user.id,
              type: 'spend',
              amount: -input.amount,
              description: input.description,
            },
          ]);

        if (transError) throw transError;

        return { success: true };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to spend tokens',
        });
      }
    }),
});