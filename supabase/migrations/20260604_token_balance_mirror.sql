-- ═══════════════════════════════════════════
-- Token Balance Mirror — Sprint 7 (companion to 20260604_pricing_unification.sql)
-- ═══════════════════════════════════════════
-- Purpose: Keep profiles.token_balance in sync with the 3-wallet totals so
-- legacy reads (Dashboard topbar, admin panel, finance dashboards) continue
-- to work seamlessly during the Sprint 7→8 transition. Sprint 8 will
-- deprecate profiles.token_balance entirely.
--
-- Mechanism:
--   AFTER INSERT OR UPDATE on each of the three wallet tables fires the
--   trigger, which recomputes the SUM(balance) across all three wallets
--   for the affected user and writes it back to profiles.token_balance.
--
--   NOTE: This trigger fires inside the same transaction as the wallet
--   write, so dashboard reads ALWAYS see a consistent view (no flicker).
--
-- Initial sync: one UPDATE at the bottom seeds profiles.token_balance to
-- match the current wallet totals (currently ~+5 token drift from refunds).

BEGIN;

CREATE OR REPLACE FUNCTION sync_profile_token_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Compute SUM(balance) across all 3 wallets and mirror to profiles.
  -- This is the source of truth post-Sprint-7 for spendable balance.
  UPDATE profiles
  SET token_balance = COALESCE((
    SELECT SUM(b)
    FROM (
      SELECT balance AS b FROM wallet_bonus       WHERE user_id = NEW.user_id
      UNION ALL
      SELECT balance AS b FROM wallet_subscription WHERE user_id = NEW.user_id
      UNION ALL
      SELECT balance AS b FROM wallet_topup       WHERE user_id = NEW.user_id
    ) AS all_wallets
  ), 0)
  WHERE id = NEW.user_id;

  RETURN NEW;
END;
$$;

-- Drop-if-exists then create — idempotent across re-applies.
DROP TRIGGER IF EXISTS mirror_bonus_to_profile        ON wallet_bonus;
DROP TRIGGER IF EXISTS mirror_subscription_to_profile ON wallet_subscription;
DROP TRIGGER IF EXISTS mirror_topup_to_profile        ON wallet_topup;

CREATE TRIGGER mirror_bonus_to_profile
  AFTER INSERT OR UPDATE OF balance ON wallet_bonus
  FOR EACH ROW EXECUTE FUNCTION sync_profile_token_balance();

CREATE TRIGGER mirror_subscription_to_profile
  AFTER INSERT OR UPDATE OF balance ON wallet_subscription
  FOR EACH ROW EXECUTE FUNCTION sync_profile_token_balance();

CREATE TRIGGER mirror_topup_to_profile
  AFTER INSERT OR UPDATE OF balance ON wallet_topup
  FOR EACH ROW EXECUTE FUNCTION sync_profile_token_balance();

-- Initial sync: align profiles.token_balance with wallet totals NOW. This
-- closes the +5 token drift from refunds and any future drift becomes
-- impossible because the triggers run on every write.
UPDATE profiles p
SET token_balance = COALESCE((
  SELECT SUM(b)
  FROM (
    SELECT balance AS b FROM wallet_bonus       WHERE user_id = p.id
    UNION ALL
    SELECT balance AS b FROM wallet_subscription WHERE user_id = p.id
    UNION ALL
    SELECT balance AS b FROM wallet_topup       WHERE user_id = p.id
  ) AS all_wallets
), 0);

COMMIT;
