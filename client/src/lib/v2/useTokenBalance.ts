import { useEffect, useState } from 'react';
import { trpc } from '@/lib/trpc';

/**
 * useTokenBalance — the ONE client-side read path for the user's token balance.
 *
 * P1 Foundation unifies the "token chaos": before this hook, five surfaces read
 * the balance from three different places (legacy profiles.token_balance via
 * AuthContext / DashboardLayout's direct Supabase / pricing.getTokenBalance's
 * user_tokens fallback), so the same user could see different numbers on Home,
 * the sidebar, Profile, and Billing.
 *
 * The source of truth is the 3-wallet system: bonus + subscription + topup.
 * Billing already reads it via pricing.getWalletSnapshot (backed by
 * get_wallets_v2 / the user_wallet_totals view). This hook points everyone else
 * at the SAME query, so every surface shows an identical total.
 *
 * Never throws — on failure `total` is null and `error` is set; callers render a
 * dash, not a wrong number.
 */

export interface TokenBalance {
  /** The unified total across all three wallets, or null while loading / on error. */
  total: number | null;
  /** Per-wallet breakdown (handy for richer surfaces; Billing has its own). */
  breakdown: {
    bonus: number;
    subscription: number;
    topup: number;
  } | null;
  /** Bonus expiry, if any — drives "bonus expiring soon" hints. */
  bonusExpiresAt: string | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useTokenBalance(): TokenBalance {
  const [total, setTotal] = useState<number | null>(null);
  const [breakdown, setBreakdown] = useState<TokenBalance['breakdown']>(null);
  const [bonusExpiresAt, setBonusExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    trpc.pricing
      .getWalletSnapshot()
      .then((snap) => {
        if (cancelled) return;
        setTotal(snap.total ?? 0);
        setBreakdown({
          bonus: snap.bonus?.balance ?? 0,
          subscription: snap.subscription?.balance ?? 0,
          topup: snap.topup?.balance ?? 0,
        });
        setBonusExpiresAt(snap.bonus?.expires_at ?? null);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'تعذّر تحميل الرصيد');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tick]);

  return {
    total,
    breakdown,
    bonusExpiresAt,
    loading,
    error,
    refetch: () => setTick((t) => t + 1),
  };
}
