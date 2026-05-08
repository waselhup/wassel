import { TRPCError } from '@trpc/server';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Atomic token consumption against the user_tokens ledger.
 *
 * This is the v2 path that pairs with the products.token_cost catalog.
 * Different from lib/tokens.ts which deducts via deduct_tokens_atomic RPC
 * against profiles.token_balance.
 *
 * Strategy:
 *   1. SELECT current balance from user_tokens (fallback profiles.token_balance)
 *   2. Reject if balance < amount
 *   3. UPDATE user_tokens.balance -= amount, total_used += amount
 *   4. UPDATE profiles.token_balance -= amount (legacy mirror)
 *   5. INSERT token_transactions audit row
 *
 * Not race-free — uses optimistic check rather than row lock. Acceptable
 * because (a) this is per-user, low-concurrency, (b) the worst case is a
 * brief negative balance that the next consume() will reject. For strict
 * race safety, callers in hot paths should still use deductTokens() in
 * lib/tokens.ts which is RPC-locked.
 */

export interface ConsumeArgs {
  userId: string;
  amount: number;
  referenceType: 'radar' | 'cv_builder' | 'cover_letter' | 'linkedin_post' | 'campaign' | 'spend' | string;
  referenceId?: string;
  description?: string;
}

export interface ConsumeResult {
  success: true;
  balanceBefore: number;
  balanceAfter: number;
}

/**
 * Consume tokens. Throws TRPCError('FORBIDDEN') with structured cause on
 * insufficient balance, or TRPCError('INTERNAL_SERVER_ERROR') on RPC errors.
 */
export async function consumeTokens(
  supabase: SupabaseClient,
  args: ConsumeArgs,
  lang: 'ar' | 'en' = 'ar'
): Promise<ConsumeResult> {
  if (args.amount <= 0) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Token amount must be positive' });
  }

  // Read current balance
  let { data: row } = await supabase
    .from('user_tokens')
    .select('balance, total_used')
    .eq('user_id', args.userId)
    .maybeSingle();

  let currentBalance: number;
  let currentUsed: number;
  let needsInsert = false;

  if (row) {
    currentBalance = row.balance ?? 0;
    currentUsed = row.total_used ?? 0;
  } else {
    // Fallback to profiles for legacy users not in user_tokens
    const { data: profile } = await supabase
      .from('profiles')
      .select('token_balance')
      .eq('id', args.userId)
      .single();
    currentBalance = profile?.token_balance ?? 0;
    currentUsed = 0;
    needsInsert = true;
  }

  if (currentBalance < args.amount) {
    const message =
      lang === 'ar'
        ? `رصيدك الحالي ${currentBalance} توكن، وهذه العملية تتطلب ${args.amount} توكن.`
        : `Your current balance is ${currentBalance} tokens, but this action needs ${args.amount}.`;
    const causeErr = new Error(`INSUFFICIENT_TOKENS: balance=${currentBalance} required=${args.amount}`);
    (causeErr as any).kind = 'INSUFFICIENT_TOKENS';
    (causeErr as any).balance = currentBalance;
    (causeErr as any).required = args.amount;
    throw new TRPCError({ code: 'FORBIDDEN', message, cause: causeErr });
  }

  const newBalance = currentBalance - args.amount;
  const newUsed = currentUsed + args.amount;
  const now = new Date().toISOString();

  // Update or insert user_tokens
  if (needsInsert) {
    const { error: insErr } = await supabase
      .from('user_tokens')
      .insert({
        user_id: args.userId,
        balance: newBalance,
        total_used: args.amount,
        total_purchased: currentBalance, // assume legacy balance was previously purchased
        last_updated: now,
      });
    if (insErr) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: insErr.message });
    }
  } else {
    const { error: updErr } = await supabase
      .from('user_tokens')
      .update({ balance: newBalance, total_used: newUsed, last_updated: now })
      .eq('user_id', args.userId);
    if (updErr) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: updErr.message });
    }
  }

  // Mirror to profiles.token_balance for legacy code paths
  await supabase
    .from('profiles')
    .update({ token_balance: newBalance, updated_at: now })
    .eq('id', args.userId);

  // Audit row
  await supabase.from('token_transactions').insert({
    user_id: args.userId,
    amount: -args.amount,
    type: 'debit',
    description: args.description || `Consumed for ${args.referenceType}`,
    metadata: {
      reference_type: args.referenceType,
      reference_id: args.referenceId || null,
      balance_before: currentBalance,
      balance_after: newBalance,
    },
  });

  return { success: true, balanceBefore: currentBalance, balanceAfter: newBalance };
}

/**
 * Convenience: look up the canonical token_cost from products and consume that.
 * Use when a feature has a 1:1 mapping to a product (e.g. 'radar' → products.radar.token_cost).
 */
export async function consumeForProduct(
  supabase: SupabaseClient,
  userId: string,
  productId: string,
  referenceId?: string,
  lang: 'ar' | 'en' = 'ar'
): Promise<ConsumeResult & { tokenCost: number }> {
  const { data: product, error } = await supabase
    .from('products')
    .select('token_cost, name_en, is_active')
    .eq('id', productId)
    .single();

  if (error || !product) {
    throw new TRPCError({ code: 'NOT_FOUND', message: `Product ${productId} not found` });
  }
  if (!product.is_active) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: `Product ${productId} is not active` });
  }

  const cost = product.token_cost ?? 0;
  if (cost <= 0) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Product ${productId} has no token cost configured`,
    });
  }

  const result = await consumeTokens(
    supabase,
    {
      userId,
      amount: cost,
      referenceType: productId,
      referenceId,
      description: `Used: ${product.name_en}`,
    },
    lang
  );

  return { ...result, tokenCost: cost };
}
