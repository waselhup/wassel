import { z } from 'zod';
import { router, protectedProcedure } from '../trpc-init';
import { TRPCError } from '@trpc/server';
import { deductTokens, refundTokens, throwInsufficientTokensError } from '../lib/tokens';

export const tokenRouter = router({
  /**
   * Authoritative fresh balance for the caller.
   * Reads profiles directly via service role + ctx.user.id (already JWT-verified).
   * Used by the UI to render a pre-flight live counter before any paid action.
   */
  balance: protectedProcedure.query(async ({ ctx }) => {
    try {
      const { data: profile } = await ctx.supabase
        .from('profiles')
        .select('token_balance, plan, updated_at')
        .eq('id', ctx.user.id)
        .single();

      return {
        balance: profile?.token_balance ?? 0,
        plan: profile?.plan ?? 'free',
        serverTimestamp: new Date().toISOString(),
        profileUpdatedAt: profile?.updated_at ?? null,
      };
    } catch (err) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch token balance',
      });
    }
  }),

  /**
   * Alias kept so callers that expect `{ balance }` keep working.
   * Use `token.balance` for new code — returns richer metadata.
   */
  getMyBalance: protectedProcedure.query(async ({ ctx }) => {
    const { data: profile } = await ctx.supabase
      .from('profiles')
      .select('token_balance, plan, updated_at')
      .eq('id', ctx.user.id)
      .single();
    return {
      balance: profile?.token_balance ?? 0,
      plan: profile?.plan ?? 'free',
      serverTimestamp: new Date().toISOString(),
      profileUpdatedAt: profile?.updated_at ?? null,
    };
  }),

  history: protectedProcedure.query(async ({ ctx }) => {
    try {
      const { data } = await ctx.supabase
        .from('token_transactions')
        .select('*')
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
      // Atomic deduct via the shared RPC — one statement, row-locked,
      // audited into token_transactions.
      const result = await deductTokens(ctx.supabase, ctx.user.id, input.amount, `spend:${input.description.slice(0, 60)}`);
      if (!result.success) throwInsufficientTokensError(result, 'en');
      return {
        success: true,
        balance_before: result.balance_before,
        balance_after: result.balance_after,
      };
    }),
});
