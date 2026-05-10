import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import type { Request, Response } from 'express';

/**
 * Muyassar payment webhook handler.
 *
 * Verifies signature, marks the payment_transactions row 'completed', and
 * fulfills the order based on `type`:
 *   - subscription → create user_subscriptions row + grant monthly_tokens
 *   - token_topup  → grant N tokens
 *   - product      → grant token_cost tokens (and deliver bundle if applicable)
 *
 * Idempotent: re-deliveries of the same Muyassar transaction are detected
 * via payment_transactions.muyassar_transaction_id.
 */

/**
 * Moyasar webhook payload — supports both the event-envelope format
 *   { id, type: 'payment_paid', data: { id, status, amount, metadata, ... } }
 * and the flat payment-object format used by older test setups.
 */
interface MuyassarFlatPayload {
  id?: string;
  invoice_id?: string;
  amount?: number;
  currency?: string;
  status?: string; // 'paid' | 'failed' | 'cancelled' | 'authorized' | 'captured' | 'verified' | 'refunded'
  metadata?: { payment_id?: string };
  payment_method?: string;
  callback_id?: string;
  source?: { type?: string; company?: string };
}

interface MuyassarEnvelopePayload {
  id?: string;
  type?: string; // 'payment_paid' | 'payment_failed' | etc.
  data?: MuyassarFlatPayload;
}

type MuyassarPayload = MuyassarFlatPayload & MuyassarEnvelopePayload;

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase env vars missing');
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Verify HMAC signature on the raw body.
 * Muyassar signs requests with `X-Muyassar-Signature: sha256=<hex>` using
 * the shared webhook secret. Compare in constant-time.
 */
function verifySignature(rawBody: string, signature: string | undefined, secret: string): boolean {
  if (!signature || !secret) return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('hex');
  const provided = signature.replace(/^sha256=/, '');
  if (expected.length !== provided.length) return false;
  return crypto.timingSafeEqual(
    Buffer.from(expected, 'hex'),
    Buffer.from(provided, 'hex')
  );
}

export async function muyassarWebhookHandler(req: Request, res: Response) {
  const rawBody: string = (req as any).rawBody || JSON.stringify(req.body || {});
  // Moyasar's official header is `x-moyasar-signature`; we also accept the
  // historical mis-spelling for backwards compatibility with anything set up
  // before the spelling was fixed.
  const signature =
    (req.headers['x-moyasar-signature'] as string | undefined) ||
    (req.headers['x-muyassar-signature'] as string | undefined);
  const secret =
    process.env.MOYASAR_WEBHOOK_SECRET ||
    process.env.MUYASSAR_WEBHOOK_SECRET;

  // Verify signature only if secret is configured (allows unsigned in dev).
  if (secret && !verifySignature(rawBody, signature, secret)) {
    console.warn('[muyassar-webhook] invalid signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const envelope = (req.body || {}) as MuyassarPayload;
  // If the body is an event envelope { type, data: {...} }, unwrap it. The
  // payment object in `data` is what carries id/metadata/status. Otherwise
  // treat the body itself as the payment object (legacy/test shape).
  const payment: MuyassarFlatPayload =
    (envelope.data && typeof envelope.data === 'object') ? envelope.data : envelope;
  const eventType = envelope.type;

  const paymentId = payment.metadata?.payment_id;
  const muyassarTxId = payment.id;
  // Prefer event-type signal when present (payment_paid / payment_failed /
  // payment_refunded / payment_authorized / payment_captured / payment_verified).
  // Fall back to payment.status for legacy/test setups.
  const muyassarStatus =
    eventType === 'payment_paid' || eventType === 'payment_captured' || eventType === 'payment_verified'
      ? 'paid'
      : eventType === 'payment_failed'
        ? 'failed'
        : eventType === 'payment_refunded'
          ? 'refunded'
          : eventType === 'payment_authorized'
            ? 'authorized'
            : payment.status;

  if (!paymentId || !muyassarTxId) {
    return res.status(400).json({ error: 'Missing payment_id or transaction id' });
  }

  const supabase = getSupabase();

  // Idempotency check: already processed this Muyassar transaction?
  const { data: existing } = await supabase
    .from('payment_transactions')
    .select('id, status, muyassar_transaction_id, muyassar_invoice_id, user_id, type, amount_sar, metadata')
    .eq('id', paymentId)
    .single();

  if (!existing) {
    // Payment doesn't exist in our DB. Could be a webhook for a payment
    // created on a different environment — return 200 so Moyasar stops
    // retrying. Log loudly so ops can investigate.
    console.warn('[muyassar-webhook] payment not found, dropping', { paymentId });
    return res.status(200).json({ ok: true, status: 'not_found' });
  }

  if (existing.status === 'completed' && existing.muyassar_transaction_id === muyassarTxId) {
    return res.json({ ok: true, status: 'already_processed' });
  }

  // Sanity-check the webhook amount against the row we created. Moyasar
  // amounts are in halalas (1 SAR = 100). Mismatch is suspicious but we
  // still process — we log loudly so ops can investigate.
  if (muyassarStatus === 'paid' && typeof payment.amount === 'number') {
    const expectedHalalas = Math.round(Number(existing.amount_sar) * 100);
    if (payment.amount !== expectedHalalas) {
      console.warn(
        '[muyassar-webhook] amount mismatch',
        { paymentId, expected: expectedHalalas, received: payment.amount }
      );
    }
  }

  // Map Moyasar status → our status. We treat 'authorized' as still pending
  // (settlement comes later via 'captured' or 'paid'), and 'refunded' as a
  // separate refunded status so reporting can distinguish it from cancel.
  const newStatus =
    muyassarStatus === 'paid' ? 'completed'
      : muyassarStatus === 'failed' ? 'failed'
      : muyassarStatus === 'cancelled' ? 'cancelled'
      : muyassarStatus === 'refunded' ? 'refunded'
      : 'pending';

  const { error: updErr } = await supabase
    .from('payment_transactions')
    .update({
      status: newStatus,
      muyassar_transaction_id: muyassarTxId,
      muyassar_invoice_id: payment.invoice_id || existing.muyassar_invoice_id || null,
      payment_method: payment.payment_method || payment.source?.type || null,
      completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
    })
    .eq('id', paymentId);

  if (updErr) {
    console.error('[muyassar-webhook] update failed:', updErr.message);
    return res.status(500).json({ error: updErr.message });
  }

  // Only fulfill on successful payment
  if (newStatus !== 'completed') {
    return res.json({ ok: true, status: newStatus });
  }

  try {
    await fulfillPayment(supabase, existing);
  } catch (err: any) {
    console.error('[muyassar-webhook] fulfillment failed:', err?.message);
    // Payment recorded but fulfillment failed — flag for ops follow-up.
    await supabase
      .from('payment_transactions')
      .update({
        metadata: {
          ...(existing.metadata || {}),
          fulfillment_error: err?.message || 'unknown',
        },
      })
      .eq('id', paymentId);
    return res.status(500).json({ error: 'Fulfillment failed', detail: err?.message });
  }

  return res.json({ ok: true, status: 'completed' });
}

async function fulfillPayment(supabase: any, payment: any): Promise<void> {
  const { user_id, type, metadata } = payment;

  if (type === 'subscription') {
    await fulfillSubscription(supabase, user_id, payment);
  } else if (type === 'token_topup') {
    const qty = Number(metadata?.tokens_granted ?? 0);
    if (qty > 0) await grantTokens(supabase, user_id, qty, 'topup', payment.id);
  } else if (type === 'product') {
    const qty = Number(metadata?.tokens_granted ?? 0);
    if (qty > 0) await grantTokens(supabase, user_id, qty, 'product', payment.id);
  } else {
    throw new Error(`Unknown payment type: ${type}`);
  }
}

async function fulfillSubscription(supabase: any, userId: string, payment: any): Promise<void> {
  const planId = payment.metadata?.plan_id;
  const billingCycle = payment.metadata?.billing_cycle as 'monthly' | 'annual';
  const tokensGranted = Number(payment.metadata?.tokens_granted ?? 0);

  if (!planId || !billingCycle) {
    throw new Error('Subscription payment missing plan_id or billing_cycle');
  }

  const now = new Date();
  const periodEnd = new Date(now);
  if (billingCycle === 'annual') {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  } else {
    periodEnd.setMonth(periodEnd.getMonth() + 1);
  }

  // Cancel any prior active subscription for this user.
  await supabase
    .from('user_subscriptions')
    .update({ status: 'replaced', updated_at: now.toISOString() })
    .eq('user_id', userId)
    .in('status', ['active', 'trialing']);

  // Insert new active subscription.
  const { error: subErr } = await supabase
    .from('user_subscriptions')
    .insert({
      user_id: userId,
      plan_id: planId,
      billing_cycle: billingCycle,
      status: 'active',
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      amount_paid_sar: payment.amount_sar,
      auto_renew: true,
      metadata: { payment_id: payment.id },
    });

  if (subErr) throw new Error(`Subscription insert failed: ${subErr.message}`);

  // Update profile plan
  await supabase
    .from('profiles')
    .update({ plan: planId, updated_at: now.toISOString() })
    .eq('id', userId);

  if (tokensGranted > 0) {
    await grantTokens(supabase, userId, tokensGranted, 'subscription', payment.id);
  }
}

/**
 * Grant `amount` tokens to user, creating user_tokens row if missing.
 * Also bumps profiles.token_balance for legacy compatibility, and writes
 * a token_transactions audit row.
 */
async function grantTokens(
  supabase: any,
  userId: string,
  amount: number,
  source: 'subscription' | 'topup' | 'product',
  paymentId: string
): Promise<void> {
  // Upsert user_tokens
  const { data: existing } = await supabase
    .from('user_tokens')
    .select('balance, total_purchased')
    .eq('user_id', userId)
    .maybeSingle();

  const newBalance = (existing?.balance ?? 0) + amount;
  const newPurchased = (existing?.total_purchased ?? 0) + amount;

  if (existing) {
    const { error } = await supabase
      .from('user_tokens')
      .update({
        balance: newBalance,
        total_purchased: newPurchased,
        last_updated: new Date().toISOString(),
      })
      .eq('user_id', userId);
    if (error) throw new Error(`user_tokens update: ${error.message}`);
  } else {
    const { error } = await supabase
      .from('user_tokens')
      .insert({
        user_id: userId,
        balance: amount,
        total_purchased: amount,
        total_used: 0,
      });
    if (error) throw new Error(`user_tokens insert: ${error.message}`);
  }

  // Bump profiles.token_balance for legacy paths still reading it
  const { data: profile } = await supabase
    .from('profiles')
    .select('token_balance')
    .eq('id', userId)
    .single();
  await supabase
    .from('profiles')
    .update({
      token_balance: (profile?.token_balance ?? 0) + amount,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  // Audit row
  await supabase.from('token_transactions').insert({
    user_id: userId,
    amount,
    type: 'credit',
    description: `Tokens granted from ${source}`,
    metadata: { source, payment_id: paymentId },
  });
}
