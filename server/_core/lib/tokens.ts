import { TRPCError } from '@trpc/server';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Atomic token operations wrapping the Supabase RPCs:
 *   - deduct_tokens_atomic(user_id, cost, feature) → row-locked debit
 *   - refund_tokens_atomic(user_id, amount, feature) → row-locked credit
 *   - get_my_token_balance() → read the authed user's balance (RLS)
 *
 * Design goals:
 *   1. No ad-hoc SELECT-then-UPDATE — race-free.
 *   2. Consistent error payloads — UI always receives { balance, required,
 *      feature, reason } for false positives.
 *   3. Every deduction is audited in token_transactions.
 *   4. If the downstream (Claude/Apify/etc.) call fails, refund is one line.
 */

export type DeductSuccess = {
  success: true;
  balance_before: number;
  balance_after: number;
  cost: number;
  feature: string;
};

export type DeductFailure = {
  success: false;
  reason: 'insufficient' | 'user_not_found' | 'invalid_cost' | 'rpc_error';
  balance?: number;
  required?: number;
  feature: string;
  message?: string;
};

export type DeductResult = DeductSuccess | DeductFailure;

export type RefundResult = {
  success: boolean;
  balance_before?: number;
  balance_after?: number;
  amount?: number;
  feature: string;
  reason?: string;
};

/**
 * Deduct `cost` tokens from `userId` for `feature`.
 * Never throws — callers inspect the discriminated union.
 */
export async function deductTokens(
  supabase: SupabaseClient,
  userId: string,
  cost: number,
  feature: string
): Promise<DeductResult> {
  const { data, error } = await supabase.rpc('deduct_tokens_atomic', {
    p_user_id: userId,
    p_cost: cost,
    p_feature: feature,
  });

  if (error) {
    console.error('[tokens.deduct]', feature, 'RPC error:', error.message);
    return {
      success: false,
      reason: 'rpc_error',
      feature,
      message: error.message,
    };
  }

  return data as DeductResult;
}

/**
 * Refund `amount` tokens to `userId`. Fire-and-log semantics —
 * if refund itself fails, we still return so the caller can surface
 * the original downstream error to the user.
 */
export async function refundTokens(
  supabase: SupabaseClient,
  userId: string,
  amount: number,
  feature: string
): Promise<RefundResult> {
  try {
    const { data, error } = await supabase.rpc('refund_tokens_atomic', {
      p_user_id: userId,
      p_amount: amount,
      p_feature: feature,
    });
    if (error) {
      console.error('[tokens.refund]', feature, 'RPC error:', error.message);
      return { success: false, feature, reason: error.message };
    }
    return data as RefundResult;
  } catch (e: any) {
    console.error('[tokens.refund]', feature, 'exception:', e?.message);
    return { success: false, feature, reason: e?.message || 'unknown' };
  }
}

/**
 * Throw a structured `FORBIDDEN` tRPC error whose message is the user-facing
 * string (balance + cost) and whose `cause` carries the diagnostic payload for
 * logging / the UI to render as an error card.
 *
 * Use when a deductTokens() call returned `{ success: false }`.
 */
export function throwInsufficientTokensError(
  fail: DeductFailure,
  lang: 'ar' | 'en' = 'ar'
): never {
  const balance = typeof fail.balance === 'number' ? fail.balance : 0;
  const required = typeof fail.required === 'number' ? fail.required : 0;

  let message: string;
  if (fail.reason === 'insufficient') {
    message =
      lang === 'ar'
        ? `رصيدك الحالي ${balance} توكن، وهذه العملية تتطلب ${required} توكن. إن كنت ترى هذه الرسالة رغم توفّر رصيد أكبر، حدّث الصفحة أو تواصل مع الدعم.`
        : `Your current balance is ${balance} tokens, but this action needs ${required}. If you see this despite having a higher balance, refresh the page or contact support.`;
  } else if (fail.reason === 'user_not_found') {
    message =
      lang === 'ar'
        ? 'تعذّر العثور على حسابك. سجّل خروج ثم دخول مرة أخرى.'
        : 'Your account could not be located. Please sign out and back in.';
  } else if (fail.reason === 'rpc_error') {
    message =
      lang === 'ar'
        ? `تعذّر التحقق من رصيد التوكن حالياً. حاول بعد قليل.${fail.message ? ' (' + fail.message + ')' : ''}`
        : `Token balance check failed temporarily. Please retry shortly.${fail.message ? ' (' + fail.message + ')' : ''}`;
  } else {
    message =
      lang === 'ar'
        ? 'خطأ في عملية التوكن. تواصل مع الدعم.'
        : 'Token operation error. Please contact support.';
  }

  // tRPC v10 expects `cause` to be an Error instance — passing a plain object
  // triggers a 500 during response serialization. We attach the diagnostic
  // payload onto an Error subclass so the UI can read it from err.data.cause.
  const causeErr = new Error(`INSUFFICIENT_TOKENS: balance=${balance} required=${required} feature=${fail.feature}`);
  (causeErr as any).kind = 'INSUFFICIENT_TOKENS';
  (causeErr as any).reason = fail.reason;
  (causeErr as any).balance = balance;
  (causeErr as any).required = required;
  (causeErr as any).feature = fail.feature;
  (causeErr as any).serverTimestamp = new Date().toISOString();

  throw new TRPCError({
    code: 'FORBIDDEN',
    message,
    cause: causeErr,
  });
}

/**
 * Convenience: try to deduct; if it fails, throw a nice error. If it succeeds,
 * return the {balance_after, balance_before} for optional UI display.
 */
export async function deductOrThrow(
  supabase: SupabaseClient,
  userId: string,
  cost: number,
  feature: string,
  lang: 'ar' | 'en' = 'ar'
): Promise<DeductSuccess> {
  const result = await deductTokens(supabase, userId, cost, feature);
  if (!result.success) throwInsufficientTokensError(result, lang);
  return result;
}
