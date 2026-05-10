import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, publicProcedure, protectedProcedure } from '../trpc-init';
import { createInvoice, isMoyasarConfigured } from '../lib/moyasar-client';

const BILLING_CYCLE = z.enum(['monthly', 'annual']);

const PUBLIC_BASE_URL =
  process.env.PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'https://wasselhub.com';

/**
 * Build the Moyasar callback URL the customer's browser is redirected to
 * after the hosted form. We always send them to /checkout/success?id=<txn>;
 * the success page polls payment status and routes to /checkout/failed when
 * the webhook confirmed a failure.
 */
function buildCallbackUrl(transactionId: string): string {
  return `${PUBLIC_BASE_URL.replace(/\/$/, '')}/v2/checkout/success?id=${encodeURIComponent(transactionId)}`;
}

/**
 * Create a Moyasar hosted invoice for a pending payment_transactions row.
 * Returns the URL to redirect the customer to, plus the invoice id which we
 * cache on the payment row so admins can correlate later.
 *
 * If Moyasar isn't configured (dev) we return null and the caller surfaces
 * the existing "being configured" placeholder UI.
 */
async function createHostedInvoiceForPayment(args: {
  paymentId: string;
  amountSar: number;
  description: string;
  metadataExtra?: Record<string, string>;
}): Promise<{ url: string; invoiceId: string } | null> {
  if (!isMoyasarConfigured()) return null;
  const invoice = await createInvoice({
    amountHalalas: Math.round(args.amountSar * 100),
    description: args.description,
    callbackUrl: buildCallbackUrl(args.paymentId),
    metadata: {
      payment_id: args.paymentId,
      ...(args.metadataExtra || {}),
    },
  });
  return { url: invoice.url, invoiceId: invoice.id };
}

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

      let checkoutUrl: string | null = null;
      try {
        const invoice = await createHostedInvoiceForPayment({
          paymentId: payment.id,
          amountSar: amount,
          description: `Wassel ${plan.name_en} (${input.billingCycle})`,
          metadataExtra: {
            type: 'subscription',
            plan_id: input.planId,
            billing_cycle: input.billingCycle,
          },
        });
        if (invoice) {
          checkoutUrl = invoice.url;
          await ctx.supabase
            .from('payment_transactions')
            .update({ muyassar_invoice_id: invoice.invoiceId })
            .eq('id', payment.id);
        }
      } catch (e: any) {
        // Mark the row failed so the user can retry without leaving an
        // orphaned 'pending' charge. The error surfaces as a tRPC error.
        await ctx.supabase
          .from('payment_transactions')
          .update({ status: 'failed', metadata: { ...payment.metadata, gateway_error: e?.message } })
          .eq('id', payment.id);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Moyasar invoice failed: ${e?.message}` });
      }

      return {
        paymentId: payment.id,
        amount,
        currency: 'SAR' as const,
        planId: input.planId,
        billingCycle: input.billingCycle,
        // Frontend redirects window.location to this URL when present.
        muyassarCheckoutUrl: checkoutUrl,
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

      let checkoutUrl: string | null = null;
      try {
        const invoice = await createHostedInvoiceForPayment({
          paymentId: payment.id,
          amountSar: amount,
          description: `Wassel tokens — ${input.quantity}`,
          metadataExtra: { type: 'token_topup', quantity: String(input.quantity) },
        });
        if (invoice) {
          checkoutUrl = invoice.url;
          await ctx.supabase
            .from('payment_transactions')
            .update({ muyassar_invoice_id: invoice.invoiceId })
            .eq('id', payment.id);
        }
      } catch (e: any) {
        await ctx.supabase
          .from('payment_transactions')
          .update({ status: 'failed', metadata: { ...payment.metadata, gateway_error: e?.message } })
          .eq('id', payment.id);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Moyasar invoice failed: ${e?.message}` });
      }

      return {
        paymentId: payment.id,
        amount,
        currency: 'SAR' as const,
        quantity: input.quantity,
        muyassarCheckoutUrl: checkoutUrl,
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

      let checkoutUrl: string | null = null;
      try {
        const invoice = await createHostedInvoiceForPayment({
          paymentId: payment.id,
          amountSar: amount,
          description: `Wassel ${product.name_en}`,
          metadataExtra: { type: 'product', product_id: input.productId },
        });
        if (invoice) {
          checkoutUrl = invoice.url;
          await ctx.supabase
            .from('payment_transactions')
            .update({ muyassar_invoice_id: invoice.invoiceId })
            .eq('id', payment.id);
        }
      } catch (e: any) {
        await ctx.supabase
          .from('payment_transactions')
          .update({ status: 'failed', metadata: { ...payment.metadata, gateway_error: e?.message } })
          .eq('id', payment.id);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Moyasar invoice failed: ${e?.message}` });
      }

      return {
        paymentId: payment.id,
        amount,
        currency: 'SAR' as const,
        productId: input.productId,
        muyassarCheckoutUrl: checkoutUrl,
      };
    }),

  /**
   * Authed: poll status of a single payment_transactions row.
   * The /checkout/success page hits this every 2s while waiting for the
   * webhook to mark the row 'completed'. RLS-scoped to the caller.
   */
  getPaymentStatus: protectedProcedure
    .input(z.object({ transactionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('payment_transactions')
        .select('id, status, type, amount_sar, currency, completed_at, metadata, reference_id, reference_type')
        .eq('id', input.transactionId)
        .eq('user_id', ctx.user.id)
        .single();

      if (error || !data) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Transaction not found' });
      }
      return data;
    }),
});
