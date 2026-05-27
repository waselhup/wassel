import { TRPCError } from '@trpc/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  deductTokens as walletsDeductTokens,
  refundTokens as walletsRefundTokens,
  type DeductedBreakdown,
} from './wallets';

/**
 * SPRINT 7 SHIM — Backward-compat layer.
 *
 * Legacy callers (cv.ts, posts.ts, linkedin.ts, campaign.ts) call the v1
 * shape: `deductTokens(supabase, userId, cost, feature)` → returns a flat
 * `{ success, balance_before, balance_after, cost, feature }`. Refund is
 * `refundTokens(supabase, userId, amount, feature)`.
 *
 * Under the hood we now route through the 3-wallet RPC (`deduct_tokens_v2`)
 * via `lib/wallets.ts`. The legacy `deduct_tokens_atomic` RPC is no longer
 * called by application code (still present in DB until Sprint 8 cleanup).
 *
 * Refund preserves the exact per-wallet breakdown by stashing it in an
 * in-process Map keyed by `${userId}:${feature}`. Entries auto-evict after
 * 60s so a crashed-between-deduct-and-refund request can't leak memory.
 *
 * profiles.token_balance is kept in sync via DB trigger
 * (sync_profile_token_balance, migration 20260604_token_balance_mirror.sql)
 * so legacy dashboard reads continue to work.
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

// ─────────────────────────────────────────────────────────────
// SHIM internals: in-process cache of per-wallet debited breakdowns
// so refund can reverse exactly what was deducted (across the 3 wallets).
//
// Key: `${userId}:${feature}` — latest-wins (a single request rarely deducts
// the same feature twice; if it does, the last deduct's breakdown is what
// refund will reverse, which is the right behavior).
//
// TTL: 60s. We don't run a sweeper interval; instead we lazily evict during
// reads/writes. This keeps the module side-effect free (matters for esbuild
// bundling into the Vercel handler).
// ─────────────────────────────────────────────────────────────
type CacheEntry = { debited: DeductedBreakdown; expiresAt: number };
const debitedCache: Map<string, CacheEntry> = new Map();
const CACHE_TTL_MS = 60_000;

function cacheKey(userId: string, feature: string): string {
  return `${userId}:${feature}`;
}

function evictExpired(now: number): void {
  // Lazy sweep — only walk the map if it's grown beyond a small threshold,
  // otherwise just remove the current key's stale entry on access.
  if (debitedCache.size <= 64) return;
  for (const [k, v] of debitedCache) {
    if (v.expiresAt <= now) debitedCache.delete(k);
  }
}

function stashDebited(userId: string, feature: string, debited: DeductedBreakdown): void {
  const now = Date.now();
  evictExpired(now);
  debitedCache.set(cacheKey(userId, feature), {
    debited,
    expiresAt: now + CACHE_TTL_MS,
  });
}

function popDebited(userId: string, feature: string): DeductedBreakdown | null {
  const key = cacheKey(userId, feature);
  const entry = debitedCache.get(key);
  debitedCache.delete(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) return null;
  return entry.debited;
}

/**
 * Deduct `cost` tokens from `userId` for `feature`.
 * Never throws — callers inspect the discriminated union.
 *
 * Sprint 7 shim: routes through deduct_tokens_v2 (3-wallet) under the hood
 * but returns the legacy v1 shape so callers don't need to change.
 */
export async function deductTokens(
  supabase: SupabaseClient,
  userId: string,
  cost: number,
  feature: string
): Promise<DeductResult> {
  const v2 = await walletsDeductTokens(supabase, userId, cost, feature);

  if (!v2.success) {
    if (v2.error === 'INVALID_AMOUNT') {
      return { success: false, reason: 'invalid_cost', feature, message: v2.message };
    }
    if (v2.error === 'INSUFFICIENT_TOKENS') {
      return {
        success: false,
        reason: 'insufficient',
        balance: v2.new_balance ?? 0,
        required: cost,
        feature,
      };
    }
    // RPC_ERROR or anything else
    return {
      success: false,
      reason: 'rpc_error',
      balance: v2.new_balance ?? 0,
      required: cost,
      feature,
      message: v2.message,
    };
  }

  // Stash per-wallet breakdown so the matching refund (if any) can reverse
  // it exactly. balance_before is derived (we didn't capture it; v2 returns
  // post-deduct balance, so v_before = v_after + cost).
  stashDebited(userId, feature, v2.debited);

  return {
    success: true,
    balance_before: v2.new_balance + cost,
    balance_after: v2.new_balance,
    cost,
    feature,
  };
}

/**
 * Refund `amount` tokens to `userId`. Fire-and-log semantics — never throws.
 *
 * Sprint 7 shim: if we have a cached per-wallet breakdown from the matching
 * deduct, refund each wallet exactly the amount that was taken. Fallback:
 * refund the full amount to wallet_topup (safe — user gets the full amount
 * back, only "loses" the wallet-tier attribution). This fallback path is
 * only hit if the cache TTL expired or the process restarted between
 * deduct and refund — both rare.
 */
export async function refundTokens(
  supabase: SupabaseClient,
  userId: string,
  amount: number,
  feature: string
): Promise<RefundResult> {
  try {
    const cached = popDebited(userId, feature);
    const breakdown: DeductedBreakdown = cached ?? [
      { wallet: 'topup', amount, after: 0 },
    ];

    // If the cached breakdown total doesn't match the requested refund
    // (e.g. partial refund — uncommon for these callers but possible),
    // scale to topup-only to stay safe.
    const cachedTotal = breakdown.reduce((s, e) => s + e.amount, 0);
    const finalBreakdown: DeductedBreakdown =
      cached && cachedTotal === amount
        ? breakdown
        : [{ wallet: 'topup', amount, after: 0 }];

    const r = await walletsRefundTokens(supabase, userId, finalBreakdown, feature);

    return {
      success: r.success,
      amount: r.refunded,
      feature,
      reason: r.errors.length ? r.errors.join('; ') : undefined,
    };
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
