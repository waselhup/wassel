import type { SupabaseClient } from '@supabase/supabase-js';
import { createInvoice, isMoyasarConfigured } from './moyasar-client';

/**
 * Pricing Engine — Sprint 7
 *
 * One place that orchestrates plans, top-ups, subscription lifecycle, and
 * Moyasar checkouts. The tRPC router (server/_core/routes/pricing.ts) calls
 * this; the Moyasar webhook calls the RPCs directly (it bypasses ctx).
 *
 * Three wallets, one engine:
 *   - bonus        (consumed 1st, expires)        → Goal Bonus + promos
 *   - subscription (consumed 2nd, monthly expiry) → plan tokens
 *   - topup        (consumed 3rd, lifetime)        → paid top-ups
 *
 * Subscription tokens REPLACE on renewal (per R18 — they don't roll over).
 * Top-up tokens never expire.
 *
 * The legacy `plans` and `user_subscriptions` tables stay as source of truth
 * for subscription metadata. The 3-wallet system is now the source of truth
 * for *spendable balance*. The old `profiles.token_balance` + `user_tokens`
 * are kept untouched for backward compat reads (admin, dashboard topbar).
 */

const PUBLIC_BASE_URL =
  process.env.PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'https://wasselhub.com';

export interface SubscriptionPlan {
  id: string;
  name_ar: string;
  name_en: string;
  tagline_ar: string | null;
  tagline_en: string | null;
  monthly_price_sar: number;
  annual_price_sar: number | null;
  monthly_tokens: number;
  display_order: number;
  is_featured: boolean;
  is_custom: boolean;
  is_free: boolean;
  badge_ar: string | null;
  badge_en: string | null;
  features: Array<{
    feature_key: string;
    feature_ar: string;
    feature_en: string;
    is_included: boolean;
    is_coming_soon: boolean;
    is_highlighted: boolean;
  }>;
}

export interface TopupPackage {
  code: string;
  name_ar: string;
  name_en: string;
  tokens: number;
  price_sar: number;
  description_ar: string | null;
  description_en: string | null;
  badge_ar: string | null;
  badge_en: string | null;
  display_order: number;
}

export interface CurrentSubscription {
  planId: string;
  planNameAr: string;
  planNameEn: string;
  monthlyTokens: number;
  status: 'active' | 'trialing' | 'cancelled' | 'past_due' | 'expired' | 'free';
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  autoRenew: boolean;
  billingCycle: 'monthly' | 'annual' | null;
  scheduledDowngradeTo: string | null;
  isFirst: boolean;
}

export interface PaymentTransactionRow {
  id: string;
  amount_sar: number;
  currency: string;
  type: string;
  status: string;
  payment_method: string | null;
  metadata: Record<string, unknown> | null;
  wallet_credited: 'bonus' | 'subscription' | 'topup' | null;
  tokens_credited: number | null;
  created_at: string;
  completed_at: string | null;
}

function buildCallbackUrl(transactionId: string): string {
  return `${PUBLIC_BASE_URL.replace(/\/$/, '')}/v2/checkout/success?id=${encodeURIComponent(transactionId)}`;
}

/**
 * List all active subscription plans + their features.
 */
export async function listPlans(supabase: SupabaseClient): Promise<SubscriptionPlan[]> {
  const { data: plans, error: plansErr } = await supabase
    .from('plans')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (plansErr) throw new Error(`listPlans: ${plansErr.message}`);
  const planIds = (plans || []).map((p: { id: string }) => p.id);

  const { data: features } = planIds.length
    ? await supabase
        .from('plan_features')
        .select('*')
        .in('plan_id', planIds)
        .order('display_order', { ascending: true })
    : { data: [] as unknown[] };

  const byPlan = new Map<string, SubscriptionPlan['features']>();
  for (const f of (features ?? []) as Array<{
    plan_id: string;
    feature_key: string;
    feature_ar: string;
    feature_en: string;
    is_included: boolean;
    is_coming_soon: boolean;
    is_highlighted: boolean;
  }>) {
    if (!byPlan.has(f.plan_id)) byPlan.set(f.plan_id, []);
    byPlan.get(f.plan_id)!.push({
      feature_key: f.feature_key,
      feature_ar: f.feature_ar,
      feature_en: f.feature_en,
      is_included: f.is_included,
      is_coming_soon: f.is_coming_soon,
      is_highlighted: f.is_highlighted,
    });
  }

  return (plans ?? []).map((p: Record<string, unknown>) => ({
    id: String(p.id),
    name_ar: String(p.name_ar),
    name_en: String(p.name_en),
    tagline_ar: (p.tagline_ar as string) ?? null,
    tagline_en: (p.tagline_en as string) ?? null,
    monthly_price_sar: Number(p.monthly_price_sar),
    annual_price_sar: p.annual_price_sar == null ? null : Number(p.annual_price_sar),
    monthly_tokens: Number(p.monthly_tokens),
    display_order: Number(p.display_order),
    is_featured: Boolean(p.is_featured),
    is_custom: Boolean(p.is_custom),
    is_free: Boolean(p.is_free),
    badge_ar: (p.badge_ar as string) ?? null,
    badge_en: (p.badge_en as string) ?? null,
    features: byPlan.get(String(p.id)) ?? [],
  }));
}

/**
 * List active top-up packages from token_packages.
 */
export async function listTopupPackages(supabase: SupabaseClient): Promise<TopupPackage[]> {
  const { data, error } = await supabase
    .from('token_packages')
    .select('*')
    .eq('kind', 'topup')
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (error) throw new Error(`listTopupPackages: ${error.message}`);

  // The "Most popular" / "Best value" badges are positional today (we don't
  // have badge_ar/badge_en columns on token_packages). Hardcode by tokens
  // — easy enough to flip into the DB later if marketing wants to A/B.
  const badgeByTokens: Record<number, { ar: string; en: string }> = {
    250: { ar: 'الأكثر شعبية', en: 'Most popular' },
    500: { ar: 'أفضل قيمة',   en: 'Best value' },
  };

  return (data ?? []).map((row: Record<string, unknown>) => {
    const tokens = Number(row.tokens);
    const badge = badgeByTokens[tokens] ?? null;
    return {
      code: String(row.code),
      name_ar: String(row.name_ar),
      name_en: String(row.name_en),
      tokens,
      price_sar: Number(row.price_sar),
      description_ar: (row.description_ar as string) ?? null,
      description_en: (row.description_en as string) ?? null,
      badge_ar: badge?.ar ?? null,
      badge_en: badge?.en ?? null,
      display_order: Number(row.display_order),
    };
  });
}

/**
 * Read the caller's current subscription state. Joins plans for display, and
 * derives a clean `CurrentSubscription` shape the UI doesn't need to massage.
 */
export async function getCurrentSubscription(
  supabase: SupabaseClient,
  userId: string,
): Promise<CurrentSubscription> {
  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'current_plan, is_first_subscription, subscription_started_at, subscription_next_renewal_at, subscription_cancel_at_period_end',
    )
    .eq('id', userId)
    .maybeSingle();

  const planId = (profile?.current_plan as string) || 'free';

  const { data: planRow } = await supabase
    .from('plans')
    .select('name_ar, name_en, monthly_tokens')
    .eq('id', planId)
    .maybeSingle();

  // Best-effort: pull the live user_subscriptions row for billing cycle + downgrade schedule.
  const { data: usRow } = await supabase
    .from('user_subscriptions')
    .select('billing_cycle, auto_renew, status, metadata')
    .eq('user_id', userId)
    .in('status', ['active', 'trialing'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const metadata = (usRow?.metadata as Record<string, unknown> | null) ?? null;
  const scheduledDowngradeTo = (metadata?.downgrade_to as string) ?? null;

  return {
    planId,
    planNameAr: (planRow?.name_ar as string) || planId,
    planNameEn: (planRow?.name_en as string) || planId,
    monthlyTokens: Number(planRow?.monthly_tokens ?? 0),
    status: planId === 'free' ? 'free' : ((usRow?.status as CurrentSubscription['status']) || 'active'),
    currentPeriodStart: (profile?.subscription_started_at as string) ?? null,
    currentPeriodEnd: (profile?.subscription_next_renewal_at as string) ?? null,
    cancelAtPeriodEnd: Boolean(profile?.subscription_cancel_at_period_end),
    autoRenew: usRow?.auto_renew ?? true,
    billingCycle: (usRow?.billing_cycle as 'monthly' | 'annual') ?? null,
    scheduledDowngradeTo,
    isFirst: Boolean(profile?.is_first_subscription ?? true),
  };
}

/**
 * Create a Moyasar invoice for a subscription purchase. Returns the URL the
 * client redirects to + the local payment row id.
 *
 * If Moyasar is unconfigured (dev), returns null checkoutUrl and the caller
 * surfaces the "being configured" placeholder.
 */
export async function createSubscriptionCheckout(
  supabase: SupabaseClient,
  userId: string,
  planId: string,
  billingCycle: 'monthly' | 'annual',
): Promise<{ paymentId: string; amountSar: number; checkoutUrl: string | null }> {
  const { data: plan, error: planErr } = await supabase
    .from('plans')
    .select('id, name_ar, name_en, monthly_price_sar, annual_price_sar, monthly_tokens, is_free, is_custom, is_active')
    .eq('id', planId)
    .maybeSingle();

  if (planErr || !plan) throw new Error('Plan not found');
  if (!plan.is_active) throw new Error('Plan is no longer available');
  if (plan.is_free) throw new Error('Free plan cannot be purchased');
  if (plan.is_custom) throw new Error('Enterprise plans require contact via sales');

  const amount = billingCycle === 'annual' ? Number(plan.annual_price_sar) : Number(plan.monthly_price_sar);
  if (!amount || amount <= 0) throw new Error('Invalid plan price');

  const { data: payment, error: payErr } = await supabase
    .from('payment_transactions')
    .insert({
      user_id: userId,
      amount_sar: amount,
      currency: 'SAR',
      type: 'plan_subscription',
      reference_type: 'plan',
      reference_id: planId,
      status: 'pending',
      metadata: {
        plan_id: planId,
        plan_name_en: plan.name_en,
        plan_name_ar: plan.name_ar,
        billing_cycle: billingCycle,
        tokens_granted: plan.monthly_tokens,
      },
    })
    .select()
    .single();

  if (payErr || !payment) throw new Error(`Payment row insert failed: ${payErr?.message}`);

  let checkoutUrl: string | null = null;
  if (isMoyasarConfigured()) {
    try {
      const invoice = await createInvoice({
        amountHalalas: Math.round(amount * 100),
        description: `Wassel ${plan.name_en} (${billingCycle})`,
        callbackUrl: buildCallbackUrl(payment.id),
        metadata: {
          payment_id: payment.id,
          type: 'plan_subscription',
          plan_id: planId,
          billing_cycle: billingCycle,
        },
      });
      checkoutUrl = invoice.url;
      await supabase
        .from('payment_transactions')
        .update({ muyassar_invoice_id: invoice.id })
        .eq('id', payment.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown';
      await supabase
        .from('payment_transactions')
        .update({
          status: 'failed',
          metadata: { ...(payment.metadata || {}), gateway_error: msg },
        })
        .eq('id', payment.id);
      throw new Error(`Moyasar invoice failed: ${msg}`);
    }
  }

  return { paymentId: payment.id, amountSar: amount, checkoutUrl };
}

/**
 * Create a Moyasar invoice for a top-up package. Same flow as subscription,
 * but the webhook credits wallet_topup instead of wallet_subscription.
 */
export async function createTopupCheckout(
  supabase: SupabaseClient,
  userId: string,
  packageCode: string,
): Promise<{ paymentId: string; amountSar: number; tokens: number; checkoutUrl: string | null }> {
  const { data: pkg, error: pkgErr } = await supabase
    .from('token_packages')
    .select('*')
    .eq('code', packageCode)
    .eq('kind', 'topup')
    .eq('is_active', true)
    .maybeSingle();

  if (pkgErr || !pkg) throw new Error('Top-up package not found');

  const amount = Number(pkg.price_sar);
  const tokens = Number(pkg.tokens);
  if (!amount || amount <= 0) throw new Error('Invalid package price');

  const { data: payment, error: payErr } = await supabase
    .from('payment_transactions')
    .insert({
      user_id: userId,
      amount_sar: amount,
      currency: 'SAR',
      type: 'token_topup',
      reference_type: 'topup_package',
      reference_id: packageCode,
      status: 'pending',
      metadata: {
        package_code: packageCode,
        package_name_ar: pkg.name_ar,
        package_name_en: pkg.name_en,
        tokens_granted: tokens,
      },
    })
    .select()
    .single();

  if (payErr || !payment) throw new Error(`Payment row insert failed: ${payErr?.message}`);

  let checkoutUrl: string | null = null;
  if (isMoyasarConfigured()) {
    try {
      const invoice = await createInvoice({
        amountHalalas: Math.round(amount * 100),
        description: `Wassel ${pkg.name_en} — ${tokens} tokens`,
        callbackUrl: buildCallbackUrl(payment.id),
        metadata: {
          payment_id: payment.id,
          type: 'token_topup',
          package_code: packageCode,
        },
      });
      checkoutUrl = invoice.url;
      await supabase
        .from('payment_transactions')
        .update({ muyassar_invoice_id: invoice.id })
        .eq('id', payment.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown';
      await supabase
        .from('payment_transactions')
        .update({
          status: 'failed',
          metadata: { ...(payment.metadata || {}), gateway_error: msg },
        })
        .eq('id', payment.id);
      throw new Error(`Moyasar invoice failed: ${msg}`);
    }
  }

  return { paymentId: payment.id, amountSar: amount, tokens, checkoutUrl };
}

/**
 * Upgrade subscription — pro-rated (A19). The user pays the price difference
 * to the gateway; this function applies the prorated TOKEN top-up to the
 * subscription wallet via the RPC, and updates the plan.
 *
 * For Sprint 7 we don't charge Moyasar mid-period — we update the wallet
 * immediately and let the next renewal charge full new-plan price. Ali can
 * change this to "charge prorated price now" later by adding a payment row.
 */
export async function upgradeSubscription(
  supabase: SupabaseClient,
  userId: string,
  newPlanId: string,
): Promise<{ proratedTokensAdded: number; fromPlan: string; toPlan: string }> {
  const { data, error } = await supabase.rpc('upgrade_subscription_prorated', {
    p_user_id: userId,
    p_new_plan_id: newPlanId,
  });

  if (error) throw new Error(`upgrade RPC: ${error.message}`);
  const r = (data ?? {}) as Record<string, unknown>;
  if (!r.success) throw new Error(`upgrade failed: ${r.error || 'unknown'}`);
  return {
    proratedTokensAdded: Number(r.prorated_tokens_added ?? 0),
    fromPlan: String(r.from_plan ?? ''),
    toPlan: String(r.to_plan ?? ''),
  };
}

/**
 * Downgrade subscription (A19). Applies at next renewal — no immediate token
 * movement, just schedules the change.
 */
export async function downgradeSubscription(
  supabase: SupabaseClient,
  userId: string,
  newPlanId: string,
): Promise<{ fromPlan: string; toPlan: string; appliesAt: string | null }> {
  const { data, error } = await supabase.rpc('downgrade_subscription', {
    p_user_id: userId,
    p_new_plan_id: newPlanId,
  });

  if (error) throw new Error(`downgrade RPC: ${error.message}`);
  const r = (data ?? {}) as Record<string, unknown>;
  if (!r.success) throw new Error(`downgrade failed: ${r.error || 'unknown'}`);
  return {
    fromPlan: String(r.from_plan ?? ''),
    toPlan: String(r.to_plan ?? ''),
    appliesAt: (r.applies_at as string) ?? null,
  };
}

/**
 * Cancel subscription. If `immediate`, the subscription ends now and tokens
 * in wallet_subscription are NOT forfeited (per "إلغاء شفاف" — they paid for
 * the month, they keep it). If not immediate (default), auto-renew is off
 * but the subscription stays active until current_period_end.
 */
export async function cancelSubscription(
  supabase: SupabaseClient,
  userId: string,
  immediate: boolean = false,
): Promise<{ ok: true; effectiveAt: string | null }> {
  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from('user_subscriptions')
    .select('id, current_period_end')
    .eq('user_id', userId)
    .in('status', ['active', 'trialing'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!existing) {
    // No active sub — just mark profile clean
    await supabase
      .from('profiles')
      .update({
        subscription_cancel_at_period_end: false,
        current_plan: 'free',
        updated_at: now,
      })
      .eq('id', userId);
    return { ok: true, effectiveAt: now };
  }

  if (immediate) {
    await supabase
      .from('user_subscriptions')
      .update({ status: 'cancelled', cancelled_at: now, auto_renew: false, updated_at: now })
      .eq('id', existing.id);

    await supabase
      .from('profiles')
      .update({
        subscription_cancel_at_period_end: false,
        current_plan: 'free',
        subscription_next_renewal_at: null,
        updated_at: now,
      })
      .eq('id', userId);

    await supabase.from('activity_log').insert({
      user_id: userId,
      action: 'subscription.cancelled_immediate',
      target: existing.id,
      payload: { effective_at: now },
      pillar: 'wallet',
      tokens_charged: 0,
    });

    return { ok: true, effectiveAt: now };
  }

  await supabase
    .from('user_subscriptions')
    .update({ auto_renew: false, cancelled_at: now, updated_at: now })
    .eq('id', existing.id);

  await supabase
    .from('profiles')
    .update({ subscription_cancel_at_period_end: true, updated_at: now })
    .eq('id', userId);

  await supabase.from('activity_log').insert({
    user_id: userId,
    action: 'subscription.cancel_scheduled',
    target: existing.id,
    payload: { effective_at: existing.current_period_end },
    pillar: 'wallet',
    tokens_charged: 0,
  });

  return { ok: true, effectiveAt: existing.current_period_end as string | null };
}

/**
 * Reactivate a cancellation-pending subscription — flips auto_renew back on
 * before the current period ends. Idempotent.
 */
export async function reactivateSubscription(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ ok: true }> {
  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from('user_subscriptions')
    .select('id')
    .eq('user_id', userId)
    .in('status', ['active', 'trialing'])
    .eq('auto_renew', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('user_subscriptions')
      .update({ auto_renew: true, cancelled_at: null, updated_at: now })
      .eq('id', existing.id);
  }

  await supabase
    .from('profiles')
    .update({ subscription_cancel_at_period_end: false, updated_at: now })
    .eq('id', userId);

  await supabase.from('activity_log').insert({
    user_id: userId,
    action: 'subscription.reactivated',
    pillar: 'wallet',
    tokens_charged: 0,
  });

  return { ok: true };
}

/**
 * Payment history. Returns the last `limit` payment_transactions rows for
 * the user, ordered newest-first.
 */
export async function getPaymentHistory(
  supabase: SupabaseClient,
  userId: string,
  limit: number = 20,
): Promise<PaymentTransactionRow[]> {
  const { data, error } = await supabase
    .from('payment_transactions')
    .select(
      'id, amount_sar, currency, type, status, payment_method, metadata, wallet_credited, tokens_credited, created_at, completed_at',
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`getPaymentHistory: ${error.message}`);

  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: String(row.id),
    amount_sar: Number(row.amount_sar),
    currency: String(row.currency),
    type: String(row.type),
    status: String(row.status),
    payment_method: (row.payment_method as string) ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? null,
    wallet_credited: (row.wallet_credited as 'bonus' | 'subscription' | 'topup' | null) ?? null,
    tokens_credited: row.tokens_credited == null ? null : Number(row.tokens_credited),
    created_at: String(row.created_at),
    completed_at: (row.completed_at as string) ?? null,
  }));
}

/**
 * Estimate the prorated tokens an upgrade would add — used by the Billing
 * UI to show "ستحصل على ~X توكن إضافي" before clicking Upgrade.
 * Pure math, no DB writes.
 */
export async function estimateProration(
  supabase: SupabaseClient,
  userId: string,
  newPlanId: string,
): Promise<{
  fromPlan: string;
  toPlan: string;
  currentTokens: number;
  newTokens: number;
  proratedTokens: number;
  daysRemaining: number;
}> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('current_plan, subscription_next_renewal_at')
    .eq('id', userId)
    .maybeSingle();

  const fromPlan = (profile?.current_plan as string) || 'free';

  const { data: planRows } = await supabase
    .from('plans')
    .select('id, monthly_tokens')
    .in('id', [fromPlan, newPlanId]);

  const map = new Map<string, number>(
    (planRows ?? []).map((r: { id: string; monthly_tokens: number }) => [r.id, Number(r.monthly_tokens)]),
  );

  const currentTokens = map.get(fromPlan) ?? 0;
  const newTokens = map.get(newPlanId) ?? 0;

  const renewsAt = profile?.subscription_next_renewal_at as string | null;
  const daysRemaining = renewsAt
    ? Math.max(0, (new Date(renewsAt).getTime() - Date.now()) / 86400000)
    : 30;
  const proratedTokens =
    newTokens > currentTokens
      ? Math.max(0, Math.round((daysRemaining / 30) * (newTokens - currentTokens)))
      : 0;

  return {
    fromPlan,
    toPlan: newPlanId,
    currentTokens,
    newTokens,
    proratedTokens,
    daysRemaining: Math.round(daysRemaining * 10) / 10,
  };
}
