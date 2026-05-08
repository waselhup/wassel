import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, publicProcedure, protectedProcedure } from '../trpc-init';

const BILLING_CYCLE = z.enum(['monthly', 'annual']);

export const pricingRouter = router({
  /**
   * Public: list all active plans + their features.
   * Returns AR/EN strings — UI picks the language.
   */
  getPlans: publicProcedure.query(async ({ ctx }) => {
    const { data: plans, error: plansErr } = await ctx.supabase
      .from('plans')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (plansErr) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: plansErr.message });
    }

    const planIds = (plans || []).map((p: any) => p.id);
    const { data: features } = planIds.length
      ? await ctx.supabase
          .from('plan_features')
          .select('*')
          .in('plan_id', planIds)
          .order('display_order', { ascending: true })
      : { data: [] as any[] };

    const featuresByPlan: Record<string, any[]> = {};
    for (const f of features || []) {
      if (!featuresByPlan[f.plan_id]) featuresByPlan[f.plan_id] = [];
      featuresByPlan[f.plan_id].push(f);
    }

    return (plans || []).map((p: any) => ({
      ...p,
      features: featuresByPlan[p.id] || [],
    }));
  }),

  /**
   * Public: list all active products (single purchases).
   */
  getProducts: publicProcedure.query(async ({ ctx }) => {
    const { data, error } = await ctx.supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
    }
    return data || [];
  }),

  /**
   * Authed: caller's active subscription (or null).
   */
  getCurrentSubscription: protectedProcedure.query(async ({ ctx }) => {
    const { data, error } = await ctx.supabase
      .from('user_subscriptions')
      .select('*, plan:plan_id(*)')
      .eq('user_id', ctx.user.id)
      .in('status', ['active', 'trialing'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
    }
    return data || null;
  }),

  /**
   * Authed: caller's token balance + lifetime stats.
   * Reads user_tokens (purchase-level ledger) — falls back to profiles.token_balance
   * for legacy users not yet in user_tokens.
   */
  getTokenBalance: protectedProcedure.query(async ({ ctx }) => {
    const { data: row } = await ctx.supabase
      .from('user_tokens')
      .select('balance, total_purchased, total_used, last_updated')
      .eq('user_id', ctx.user.id)
      .maybeSingle();

    if (row) {
      return {
        balance: row.balance ?? 0,
        totalPurchased: row.total_purchased ?? 0,
        totalUsed: row.total_used ?? 0,
        lastUpdated: row.last_updated ?? null,
      };
    }

    // Fallback for legacy users
    const { data: profile } = await ctx.supabase
      .from('profiles')
      .select('token_balance, updated_at')
      .eq('id', ctx.user.id)
      .single();

    return {
      balance: profile?.token_balance ?? 0,
      totalPurchased: 0,
      totalUsed: 0,
      lastUpdated: profile?.updated_at ?? null,
    };
  }),

  /**
   * Authed: paginated transaction history (last 50 by default).
   * Joins token_transactions + payment_transactions in one feed.
   */
  getTransactionHistory: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 50;
      const offset = input?.offset ?? 0;

      const [tokenRes, payRes] = await Promise.all([
        ctx.supabase
          .from('token_transactions')
          .select('id, amount, type, description, metadata, created_at')
          .eq('user_id', ctx.user.id)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1),
        ctx.supabase
          .from('payment_transactions')
          .select('id, amount_sar, currency, type, status, payment_method, metadata, created_at, completed_at')
          .eq('user_id', ctx.user.id)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1),
      ]);

      return {
        tokenTransactions: tokenRes.data || [],
        paymentTransactions: payRes.data || [],
      };
    }),

  /**
   * Authed: initiate subscription purchase. Creates a payment_transactions row in
   * 'pending' state and returns the data needed to render the Muyassar payment form.
   * Actual fulfillment happens in the Muyassar webhook on payment confirmation.
   */
  subscribeToPlan: protectedProcedure
    .input(
      z.object({
        planId: z.string().min(1),
        billingCycle: BILLING_CYCLE,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { data: plan, error: planErr } = await ctx.supabase
        .from('plans')
        .select('*')
        .eq('id', input.planId)
        .eq('is_active', true)
        .single();

      if (planErr || !plan) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Plan not found' });
      }
      if (plan.is_free) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Free plan cannot be purchased' });
      }
      if (plan.is_custom) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Enterprise plans require contact via sales' });
      }

      const amount = input.billingCycle === 'annual'
        ? Number(plan.annual_price_sar)
        : Number(plan.monthly_price_sar);

      if (!amount || amount <= 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid plan price' });
      }

      const { data: payment, error: payErr } = await ctx.supabase
        .from('payment_transactions')
        .insert({
          user_id: ctx.user.id,
          amount_sar: amount,
          currency: 'SAR',
          type: 'subscription',
          reference_type: 'plan',
          reference_id: input.planId,
          status: 'pending',
          metadata: {
            plan_id: input.planId,
            plan_name_en: plan.name_en,
            plan_name_ar: plan.name_ar,
            billing_cycle: input.billingCycle,
            tokens_granted: plan.monthly_tokens,
          },
        })
        .select()
        .single();

      if (payErr) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: payErr.message });
      }

      return {
        paymentId: payment.id,
        amount,
        currency: 'SAR' as const,
        planId: input.planId,
        billingCycle: input.billingCycle,
        // Frontend uses this to redirect to Muyassar checkout — wire actual
        // Muyassar API call here once API keys are configured.
        muyassarCheckoutUrl: null as string | null,
      };
    }),

  /**
   * Authed: cancel auto-renew on the active subscription.
   * The subscription stays active until current_period_end.
   */
  cancelSubscription: protectedProcedure.mutation(async ({ ctx }) => {
    const { data: existing, error: findErr } = await ctx.supabase
      .from('user_subscriptions')
      .select('id, status')
      .eq('user_id', ctx.user.id)
      .in('status', ['active', 'trialing'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (findErr) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: findErr.message });
    }
    if (!existing) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'No active subscription' });
    }

    const { error: updErr } = await ctx.supabase
      .from('user_subscriptions')
      .update({
        auto_renew: false,
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);

    if (updErr) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: updErr.message });
    }

    return { success: true };
  }),

  /**
   * Authed: top-up tokens. 1 SAR == 1 token.
   * Creates pending payment_transactions row; tokens granted on webhook confirmation.
   */
  purchaseTokens: protectedProcedure
    .input(
      z.object({
        quantity: z.number().int().min(10).max(10000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const amount = input.quantity; // 1 SAR per token

      const { data: payment, error } = await ctx.supabase
        .from('payment_transactions')
        .insert({
          user_id: ctx.user.id,
          amount_sar: amount,
          currency: 'SAR',
          type: 'token_topup',
          reference_type: 'tokens',
          reference_id: String(input.quantity),
          status: 'pending',
          metadata: {
            tokens_granted: input.quantity,
            unit_price_sar: 1,
          },
        })
        .select()
        .single();

      if (error) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      }

      return {
        paymentId: payment.id,
        amount,
        currency: 'SAR' as const,
        quantity: input.quantity,
        muyassarCheckoutUrl: null as string | null,
      };
    }),

  /**
   * Authed: single product purchase (Radar, CV Builder, etc.).
   */
  purchaseProduct: protectedProcedure
    .input(
      z.object({
        productId: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { data: product, error: prodErr } = await ctx.supabase
        .from('products')
        .select('*')
        .eq('id', input.productId)
        .eq('is_active', true)
        .single();

      if (prodErr || !product) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Product not found' });
      }

      const amount = Number(product.price_sar);
      if (!amount || amount <= 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid product price' });
      }

      const { data: payment, error } = await ctx.supabase
        .from('payment_transactions')
        .insert({
          user_id: ctx.user.id,
          amount_sar: amount,
          currency: 'SAR',
          type: 'product',
          reference_type: 'product',
          reference_id: input.productId,
          status: 'pending',
          metadata: {
            product_id: input.productId,
            product_name_en: product.name_en,
            product_name_ar: product.name_ar,
            tokens_granted: product.token_cost,
            is_bundle: product.is_bundle,
          },
        })
        .select()
        .single();

      if (error) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      }

      return {
        paymentId: payment.id,
        amount,
        currency: 'SAR' as const,
        productId: input.productId,
        muyassarCheckoutUrl: null as string | null,
      };
    }),
});
