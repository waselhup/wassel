import { z } from 'zod';
import { router, protectedProcedure } from '../trpc-init';
import { TRPCError } from '@trpc/server';
import { sendTokenGrantEmail, shouldSendTransactional } from '../lib/email';
import * as fs from 'fs';
import * as path from 'path';

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
        .select('id, emails_sent');

      const emailsSent =
        campaigns?.reduce((sum, c) => sum + (c.emails_sent || 0), 0) || 0;

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

  users: adminProcedure
    .input(
      z
        .object({
          search: z.string().optional(),
          limit: z.number().int().positive().max(500).default(50),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      try {
        let query = ctx.supabase
          .from('profiles')
          .select('id, email, full_name, plan, token_balance, is_banned, is_admin, created_at, avatar_url')
          .order('created_at', { ascending: false })
          .limit(input?.limit ?? 50);

        const search = input?.search?.trim();
        if (search) {
          const escaped = search.replace(/[%,]/g, '');
          query = query.or(
            `email.ilike.%${escaped}%,full_name.ilike.%${escaped}%`
          );
        }

        const { data, error } = await query;
        if (error) throw error;
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
        // Get current balance + recipient info for email
        const { data: profile } = await ctx.supabase
          .from('profiles')
          .select('token_balance, email, full_name, locale')
          .eq('id', input.userId)
          .single();
        if (!profile) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'User not found',
          });
        }

        const newBalance = (profile.token_balance || 0) + input.amount;

        const { error: updateError } = await ctx.supabase
          .from('profiles')
          .update({ token_balance: newBalance })
          .eq('id', input.userId);

        if (updateError) throw updateError;

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

        try {
          if (
            profile.email &&
            (await shouldSendTransactional(ctx.supabase, input.userId))
          ) {
            const result = await sendTokenGrantEmail({
              user: { email: profile.email, fullName: profile.full_name, language: profile.locale },
              amount: input.amount,
              reason: input.reason,
              newBalance,
            });
            console.log('[admin.addTokens] email result:', result);
          }
        } catch (e: any) {
          console.error('[admin.addTokens] email send failed (non-fatal):', e?.message);
        }

        // Append to markdown grant log (non-blocking, fails silently on read-only FS like Vercel)
        try {
          const now = new Date();
          const pad = (n: number) => String(n).padStart(2, '0');
          const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
          const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
          const logDir = path.join(process.cwd(), 'wassel-wiki', 'raw', 'token-grants');
          const logFile = path.join(logDir, `${dateStr}.md`);
          const line = `- ${timeStr} — granted ${input.amount} tokens to ${profile.full_name || 'Unknown'} (${profile.email || 'no-email'}) — reason: ${input.reason} — new balance: ${newBalance}\n`;
          fs.mkdirSync(logDir, { recursive: true });
          fs.appendFileSync(logFile, line, 'utf8');
        } catch (e: any) {
          console.warn('[admin.addTokens] grant log write failed (non-fatal):', e?.message);
        }

        return { success: true, newBalance };
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
      const { data: campaigns } = await ctx.supabase
        .from('email_campaigns')
        .select('*')
        .order('created_at', { ascending: false });

      if (!campaigns || campaigns.length === 0) return [];

      // Attach user profile info separately (no FK join needed)
      const userIds = Array.from(new Set(campaigns.map((c: any) => c.user_id).filter(Boolean)));
      const { data: profiles } = await ctx.supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);

      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
      return campaigns.map((c: any) => ({
        ...c,
        profiles: profileMap.get(c.user_id) || null,
      }));
    } catch (err) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch campaigns',
      });
    }
  }),

  systemStatus: protectedProcedure.query(async ({ ctx }) => {
    const adminEmails = ['almodhih.1995@gmail.com', 'waselhup@gmail.com', 'alhashimali649@gmail.com'];
    if (!adminEmails.includes(ctx.user.email || '')) {
      throw new TRPCError({ code: 'FORBIDDEN' });
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: recentErrors } = await ctx.supabase
      .from('api_logs')
      .select('service, status_code, error_msg, created_at, endpoint')
      .gte('created_at', oneHourAgo)
      .gte('status_code', 400)
      .order('created_at', { ascending: false })
      .limit(20);

    const { data: todayCalls } = await ctx.supabase
      .from('api_logs')
      .select('service, status_code')
      .gte('created_at', oneDayAgo);

    const stats: Record<string, { total: number; errors: number }> = {};
    (todayCalls || []).forEach((call: any) => {
      if (!stats[call.service]) stats[call.service] = { total: 0, errors: 0 };
      stats[call.service].total++;
      if (call.status_code >= 400) stats[call.service].errors++;
    });

    return {
      stats,
      recentErrors: recentErrors || [],
      lastChecked: new Date().toISOString(),
    };
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
        // Look up by key (system_settings schema: id uuid, key varchar, value jsonb)
        const { data: existing } = await ctx.supabase
          .from('system_settings')
          .select('id')
          .eq('key', input.key)
          .maybeSingle();

        if (existing?.id) {
          const { error } = await ctx.supabase
            .from('system_settings')
            .update({ value: input.value, updated_at: new Date().toISOString() })
            .eq('id', existing.id);
          if (error) throw error;
        } else {
          const { error } = await ctx.supabase
            .from('system_settings')
            .insert([{ key: input.key, value: input.value }]);
          if (error) throw error;
        }

        return { success: true };
      } catch (err) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update settings',
        });
      }
    }),
});