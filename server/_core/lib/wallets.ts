import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Wallets helper for the Career Copilot 3-wallet system.
 *
 *   bonus        → consumed 1st, expires (default 90d)
 *   subscription → consumed 2nd, expires monthly
 *   topup        → consumed 3rd, lifetime (no expiry)
 *
 * Wraps the SQL functions:
 *   - get_wallets_v2(user_id)               → read combined balance
 *   - deduct_tokens_v2(user_id, amount, operation, metadata) → debit in order
 *
 * Runs IN PARALLEL with the legacy `tokens.ts` helpers (per docs/decisions/A22.md,
 * Q4 of pre-flight). Sprint 7 unifies the two systems.
 */

export type WalletSnapshot = {
  bonus:        { balance: number; expires_at: string | null; expired: boolean };
  subscription: { balance: number; renews_at:  string | null };
  topup:        { balance: number };
  total:        number;
};

export type DeductedBreakdown = Array<{ wallet: 'bonus'|'subscription'|'topup'; amount: number; after: number }>;

export type DeductSuccess = {
  success: true;
  new_balance: number;
  debited: DeductedBreakdown;
};

export type DeductFailure = {
  success: false;
  error: 'INSUFFICIENT_TOKENS' | 'INVALID_AMOUNT' | 'RPC_ERROR';
  new_balance: number | null;
  available?: { bonus: number; subscription: number; topup: number };
  message?: string;
};

export type DeductResult = DeductSuccess | DeductFailure;

/**
 * Read all three wallets + total. Cheap (one RPC). Returns a normalized object
 * even if the user has no wallet rows yet (all balances default to 0).
 */
export async function getWallets(
  supabase: SupabaseClient,
  userId: string
): Promise<WalletSnapshot> {
  const { data, error } = await supabase.rpc('get_wallets_v2', { p_user_id: userId });
  if (error) {
    return {
      bonus:        { balance: 0, expires_at: null, expired: false },
      subscription: { balance: 0, renews_at:  null },
      topup:        { balance: 0 },
      total:        0,
    };
  }
  const raw = data as Record<string, unknown>;
  const bonusRaw        = (raw?.bonus        ?? {}) as Record<string, unknown>;
  const subscriptionRaw = (raw?.subscription ?? {}) as Record<string, unknown>;
  const topupRaw        = (raw?.topup        ?? {}) as Record<string, unknown>;
  return {
    bonus: {
      balance:    Number(bonusRaw.balance    ?? 0),
      expires_at: (bonusRaw.expires_at as string | null) ?? null,
      expired:    Boolean(bonusRaw.expired),
    },
    subscription: {
      balance:   Number(subscriptionRaw.balance ?? 0),
      renews_at: (subscriptionRaw.renews_at as string | null) ?? null,
    },
    topup: {
      balance: Number(topupRaw.balance ?? 0),
    },
    total: Number(raw?.total ?? 0),
  };
}

/**
 * Deduct `amount` tokens from `userId` for `operation`.
 * Runs the SQL function which deducts in order bonus → subscription → topup.
 * Never throws — callers inspect the discriminated union.
 *
 * Per Golden Rule R03, this should be called AFTER the operation succeeds,
 * not before. The caller is responsible for the order.
 */
export async function deductTokens(
  supabase: SupabaseClient,
  userId: string,
  amount: number,
  operation: string,
  metadata?: Record<string, unknown>
): Promise<DeductResult> {
  const { data, error } = await supabase.rpc('deduct_tokens_v2', {
    p_user_id:   userId,
    p_amount:    amount,
    p_operation: operation,
    p_metadata:  metadata ?? null,
  });

  if (error) {
    return {
      success: false,
      error: 'RPC_ERROR',
      new_balance: null,
      message: error.message,
    };
  }

  const raw = (data ?? {}) as Record<string, unknown>;
  if (raw.success === true) {
    return {
      success: true,
      new_balance: Number(raw.new_balance ?? 0),
      debited: (raw.debited as DeductedBreakdown) ?? [],
    };
  }

  const availableRaw = (raw.available ?? {}) as Record<string, unknown>;
  return {
    success: false,
    error: (raw.error as DeductFailure['error']) ?? 'RPC_ERROR',
    new_balance: raw.new_balance == null ? null : Number(raw.new_balance),
    available: availableRaw && Object.keys(availableRaw).length
      ? {
          bonus:        Number(availableRaw.bonus        ?? 0),
          subscription: Number(availableRaw.subscription ?? 0),
          topup:        Number(availableRaw.topup        ?? 0),
        }
      : undefined,
  };
}

/**
 * Credit a wallet directly. Used by:
 *   - Moyasar webhook (top-up purchase) → wallet_topup
 *   - Subscription renewal cron        → wallet_subscription
 *   - Promo / refund grants            → wallet_bonus
 *
 * Writes an audit row into wallet_transactions on success.
 */
export async function creditWallet(
  supabase: SupabaseClient,
  userId: string,
  wallet: 'bonus' | 'subscription' | 'topup',
  amount: number,
  operation: string,
  options?: {
    expiresInDays?: number;     // bonus only
    renewsAt?: string;          // subscription only (ISO timestamp)
    planCode?: string;          // subscription only
    metadata?: Record<string, unknown>;
  }
): Promise<{ success: boolean; new_balance: number; message?: string }> {
  if (amount <= 0) {
    return { success: false, new_balance: 0, message: 'invalid amount' };
  }

  const table = wallet === 'bonus' ? 'wallet_bonus'
              : wallet === 'subscription' ? 'wallet_subscription'
              : 'wallet_topup';

  // Read current balance to compute new balance for the audit row
  const { data: existing } = await supabase
    .from(table)
    .select('balance')
    .eq('user_id', userId)
    .maybeSingle();

  const currentBalance = Number((existing as { balance?: number } | null)?.balance ?? 0);
  const newBalance = currentBalance + amount;

  const updateRow: Record<string, unknown> = {
    user_id: userId,
    balance: newBalance,
    updated_at: new Date().toISOString(),
  };
  if (wallet === 'bonus' && options?.expiresInDays && options.expiresInDays > 0) {
    const expiresAt = new Date(Date.now() + options.expiresInDays * 24 * 60 * 60 * 1000);
    updateRow.expires_at = expiresAt.toISOString();
  }
  if (wallet === 'subscription') {
    if (options?.renewsAt) updateRow.renews_at = options.renewsAt;
    if (options?.planCode) updateRow.plan_code = options.planCode;
  }

  const { error: upsertErr } = await supabase
    .from(table)
    .upsert(updateRow, { onConflict: 'user_id' });

  if (upsertErr) {
    return { success: false, new_balance: currentBalance, message: upsertErr.message };
  }

  const { error: txErr } = await supabase.from('wallet_transactions').insert({
    user_id: userId,
    wallet,
    direction: 'credit',
    amount,
    operation,
    status: 'committed',
    balance_after: newBalance,
    metadata: options?.metadata ?? null,
  });

  if (txErr) {
    // Credit succeeded but audit row failed — log, but don't fail the credit
    console.warn('[wallets] audit row insert failed (non-fatal):', txErr.message);
  }

  return { success: true, new_balance: newBalance };
}
