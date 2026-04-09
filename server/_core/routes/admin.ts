import { z } from 'zod';
import { router, protectedProcedure } from '../trpc-init';
import { TRPCError } from '@trpc/server';

// Middleware to check if user is admin
const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  try {
    const { data: profile } = await ctx.supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', ctx.user.id)
      .single();

    if (!profile?.is_admin) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Admin access required',
      });
    }

    return next({ ctx });
  } catch (err) {
    if (err instanceof TRPCError) throw err;
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to verify admin status',
    });
  }
});

export const adminRouter = router({
  stats: adminProcedure.query(async ({ ctx }) => {
    try {
      // Get user stats
      const { data: users } = await ctx.supabase
        .from('profiles')
        .select('id, created_at, plan');
      // Get active users (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const activeUsers = users?.filter(
        (u) => new Date(u.created_at) > sevenDaysAgo
      ).length || 0;

      // Get campaign stats
      const { data: campaigns } = await ctx.supabase
        .from('email_campaigns')
        .select('id, sent_count');

      const emailsSent =
        campaigns?.reduce((sum, c) => sum + (c.sent_count || 0), 0) || 0;

      // Get token purchases
      const { data: transactions } = await ctx.supabase
        .from('token_transactions')
        .select('amount')
        .eq('type', 'purchase');

      const tokensPurchased =
        transactions?.reduce((sum, t) => sum + Math.max(0, t.amount || 0), 0) ||
        0;

      // Calculate MRR (simplified - sum of active subscriptions)
      const planPrices = { free: 0, starter: 99, pro: 199, elite: 299 };
      const mrr =
        users?.reduce(
          (sum, u) =>
            sum +
            (planPrices[u.plan as keyof typeof planPrices] || 0),
          0
        ) || 0;
      return {
        totalUsers: users?.length || 0,
        activeUsers,
        totalCampaigns: campaigns?.length || 0,
        emailsSent,
        tokensPurchased,
        mrr,
      };
    } catch (err) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch stats',
      });
    }
  }),

  users: adminProcedure.query(async ({ ctx }) => {
    try {
      const { data } = await ctx.supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      return data || [];
    } catch (err) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch users',
      });
    }
  }),

  addTokens: adminProcedure
    .input(
      z.object({
        userId: z.string().uuid(),
        amount: z.number().int().positive(),
        reason: z.string().min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // Get current balance
        const { data: profile } = await ctx.supabase
          .from('profiles')
          .select('token_balance')
          .eq('id', input.userId)
          .single();
        if (!profile) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'User not found',
          });
        }

        // Update balance
        const { error: updateError } = await ctx.supabase
          .from('profiles')
          .update({
            token_balance: (profile.token_balance || 0) + input.amount,
          })
          .eq('id', input.userId);

        if (updateError) throw updateError;

        // Log transaction
        const { error: transError } = await ctx.supabase
          .from('token_transactions')
          .insert([
            {
              user_id: input.userId,
              type: 'admin_add',
              amount: input.amount,
              description: input.reason,
            },
          ]);

        if (transError) throw transError;

        return { success: true };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to add tokens',
        });
      }
    }),

  toggleBan: adminProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      try {
        // Get current ban status
        const { data: profile } = await ctx.supabase
          .from('profiles')
          .select('is_banned')
          .eq('id', input.userId)
          .single();
        if (!profile) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'User not found',
          });
        }

        // Toggle ban
        const { error } = await ctx.supabase
          .from('profiles')
          .update({ is_banned: !profile.is_banned })
          .eq('id', input.userId);

        if (error) throw error;

        return { success: true, banned: !profile.is_banned };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to toggle ban',
        });
      }
    }),

  campaigns: adminProcedure.query(async ({ ctx }) => {
    try {
      const { data } = await ctx.supabase
        .from('email_campaigns')
        .select('*, profiles(full_name, email)')
        .order('created_at', { ascending: false });

      return data || [];
    } catch (err) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch campaigns',
      });
    }
  }),

  updateSettings: adminProcedure
    .input(
      z.object({
        key: z.string().min(1),
        value: z.any(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // Get existing settings
        const { data: existing } = await ctx.supabase
          .from('system_settings')
          .select('*')
          .single();

        const settings = existing || {};

        // Update settings
        const { error } = await ctx.supabase
          .from('system_settings')
          .upsert({
            id: 'main',
            ...settings,
            [input.key]: input.value,
          });

        if (error) throw error;

        return { success: true };
      } catch (err) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update settings',
        });
      }
    }),
});