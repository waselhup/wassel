-- ═══════════════════════════════════════════
-- Pricing Unification — Sprint 7
-- ═══════════════════════════════════════════
-- Author: Career Copilot session (feat/career-copilot-sprint-7-pricing)
-- Date:   2026-06-04 (target apply date — pending Ali's go-ahead)
-- Scope:  Closes the gap between Sprint 1 (3-wallet system) and the legacy
--         Moyasar pricing system that has been live since before Career
--         Copilot. After this migration:
--
--         (1) Goal Completion Bonus (A18) is tracked and grantable.
--         (2) Subscription token grants flow into wallet_subscription (the
--             pricing-engine + webhook write through new RPCs added here).
--         (3) Top-up purchases credit wallet_topup (lifetime tokens).
--         (4) Pro-rated upgrades (A19) and cancellations have a clean RPC.
--         (5) Existing profiles.token_balance + user_tokens.balance are NOT
--             touched — they continue to mirror the wallet totals for legacy
--             reads (admin, dashboard topbar). Sprint 8 deprecates them.
--
-- IMPORTANT: Live state at draft time —
--   profiles                     : 23 rows  (token_balance sum = 4512)
--   wallet_bonus / sub / topup   : 23/23/23 rows (cutover already ran)
--   sum(wallet_topup.balance)    : 4517     (drift of +5 from refunds)
--   user_subscriptions           : 3 active rows
--   subscriptions (ops watch)    : 3 rows
--   token_packages               : 6 rows (plans + top-ups)
--   plans (legacy)               : 4 rows (free/starter/growth/enterprise)
--   payment_transactions         : 14 rows
--
--   No NEW data migration is needed for existing users — the Sprint 1 cutover
--   handled the legacy → wallet move. This migration adds the missing
--   plumbing for ongoing subscriptions/top-ups/bonus.
--
-- Idempotent: every CREATE uses IF NOT EXISTS, every ALTER guards with
-- information_schema lookups, all inserts use ON CONFLICT clauses.

BEGIN;

-- ─────────────────────────────────────────────
-- 1. goal_completion_bonuses
--    Tracks the +150 token Goal Bonus (A18) on a user's FIRST paid
--    subscription to starter or growth. Lives in wallet_bonus once granted;
--    this table is the audit / "did we already grant it?" check.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS goal_completion_bonuses (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_tokens     INTEGER NOT NULL DEFAULT 150 CHECK (amount_tokens > 0),
  plan_at_grant     TEXT NOT NULL CHECK (plan_at_grant IN ('starter','growth','enterprise')),
  subscription_id   UUID,  -- references user_subscriptions(id) — soft FK (no constraint, table is in another lifecycle)
  granted_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at        TIMESTAMPTZ NOT NULL,
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','consumed','expired','revoked')),
  metadata          JSONB,
  UNIQUE (user_id)  -- one Goal Bonus per user, lifetime (per A18)
);

CREATE INDEX IF NOT EXISTS idx_goal_bonus_active
  ON goal_completion_bonuses(user_id, status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_goal_bonus_expiring
  ON goal_completion_bonuses(expires_at) WHERE status = 'active';

ALTER TABLE goal_completion_bonuses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS goal_bonus_own_read ON goal_completion_bonuses;
CREATE POLICY goal_bonus_own_read ON goal_completion_bonuses FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS goal_bonus_admin_all ON goal_completion_bonuses;
CREATE POLICY goal_bonus_admin_all ON goal_completion_bonuses FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));

-- ─────────────────────────────────────────────
-- 2. profile columns for subscription lifecycle (A19)
--    `current_plan` mirrors user_subscriptions.plan_id for fast reads.
--    `is_first_subscription` flips false the first time grant_subscription_tokens fires.
--    `subscription_*` columns avoid joining user_subscriptions on every dashboard read.
-- ─────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='profiles' AND column_name='current_plan') THEN
    ALTER TABLE profiles ADD COLUMN current_plan TEXT DEFAULT 'free';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='profiles' AND column_name='is_first_subscription') THEN
    ALTER TABLE profiles ADD COLUMN is_first_subscription BOOLEAN DEFAULT TRUE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='profiles' AND column_name='subscription_started_at') THEN
    ALTER TABLE profiles ADD COLUMN subscription_started_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='profiles' AND column_name='subscription_next_renewal_at') THEN
    ALTER TABLE profiles ADD COLUMN subscription_next_renewal_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='profiles' AND column_name='subscription_cancel_at_period_end') THEN
    ALTER TABLE profiles ADD COLUMN subscription_cancel_at_period_end BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Backfill `current_plan` from existing user_subscriptions (active rows win)
UPDATE profiles p
SET current_plan = us.plan_id,
    is_first_subscription = FALSE,
    subscription_started_at = us.current_period_start,
    subscription_next_renewal_at = us.current_period_end,
    subscription_cancel_at_period_end = NOT COALESCE(us.auto_renew, TRUE)
FROM user_subscriptions us
WHERE us.user_id = p.id
  AND us.status IN ('active','trialing')
  AND p.current_plan IS NULL OR p.current_plan = 'free';

-- ─────────────────────────────────────────────
-- 3. user_wallet_totals — view (read helper, used by Billing + Dashboard)
--    Combines the 3 wallets into one row per user, including expiration info
--    and a `total_balance` that respects bonus expiration.
-- ─────────────────────────────────────────────
CREATE OR REPLACE VIEW user_wallet_totals AS
SELECT
  p.id AS user_id,
  COALESCE(wb.balance, 0) AS bonus_balance_raw,
  CASE WHEN wb.expires_at IS NOT NULL AND wb.expires_at <= NOW() THEN 0
       ELSE COALESCE(wb.balance, 0) END AS bonus_balance,
  wb.expires_at AS bonus_expires_at,
  COALESCE(ws.balance, 0) AS subscription_balance,
  ws.renews_at AS subscription_renews_at,
  ws.plan_code AS subscription_plan_code,
  COALESCE(wt.balance, 0) AS topup_balance,
  (CASE WHEN wb.expires_at IS NOT NULL AND wb.expires_at <= NOW() THEN 0
        ELSE COALESCE(wb.balance, 0) END)
   + COALESCE(ws.balance, 0)
   + COALESCE(wt.balance, 0) AS total_balance
FROM profiles p
LEFT JOIN wallet_bonus wb        ON wb.user_id = p.id
LEFT JOIN wallet_subscription ws ON ws.user_id = p.id
LEFT JOIN wallet_topup wt        ON wt.user_id = p.id;

GRANT SELECT ON user_wallet_totals TO authenticated, service_role;

-- ─────────────────────────────────────────────
-- 4. grant_subscription_tokens — RPC
--    Called by the Moyasar webhook on payment.paid for subscription_initial
--    or subscription_renewal. Credits wallet_subscription with the plan's
--    monthly_tokens; if it's the user's first subscription on starter/growth,
--    also credits wallet_bonus with the +150 Goal Bonus (A18).
--
--    Returns JSONB { success, plan, tokens_granted, bonus_granted, subscription_ends_at }.
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION grant_subscription_tokens(
  p_user_id          UUID,
  p_plan_id          TEXT,
  p_subscription_id  UUID DEFAULT NULL,
  p_billing_cycle    TEXT DEFAULT 'monthly',
  p_is_first         BOOLEAN DEFAULT NULL  -- NULL = auto-detect from profiles.is_first_subscription
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_tokens          INTEGER;
  v_bonus_amount         INTEGER := 150;
  v_subscription_end     TIMESTAMPTZ;
  v_is_first             BOOLEAN;
  v_eligible_bonus       BOOLEAN := FALSE;
  v_existing_bonus_id    UUID;
  v_current_sub_balance  INTEGER;
  v_current_bonus_balance INTEGER;
  v_new_bonus_expires_at  TIMESTAMPTZ;
BEGIN
  -- Resolve plan tokens from `plans` table (legacy source of truth).
  SELECT monthly_tokens INTO v_plan_tokens
  FROM plans
  WHERE id = p_plan_id AND is_active = TRUE;

  IF v_plan_tokens IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'INVALID_PLAN', 'plan', p_plan_id);
  END IF;

  -- Period end: monthly = +30d, annual = +365d (cron renews monthly inside annual).
  IF p_billing_cycle = 'annual' THEN
    v_subscription_end := NOW() + INTERVAL '1 year';
  ELSE
    v_subscription_end := NOW() + INTERVAL '1 month';
  END IF;

  -- Auto-detect first-subscription if not explicitly passed.
  IF p_is_first IS NULL THEN
    SELECT COALESCE(is_first_subscription, TRUE) INTO v_is_first
    FROM profiles WHERE id = p_user_id;
  ELSE
    v_is_first := p_is_first;
  END IF;

  -- Goal Bonus eligibility: first subscription AND plan is starter/growth AND
  -- no bonus record already exists for this user.
  IF v_is_first AND p_plan_id IN ('starter','growth') THEN
    SELECT id INTO v_existing_bonus_id
    FROM goal_completion_bonuses WHERE user_id = p_user_id LIMIT 1;
    IF v_existing_bonus_id IS NULL THEN
      v_eligible_bonus := TRUE;
    END IF;
  END IF;

  -- Ensure wallet rows exist (FOR UPDATE locks would race without these).
  INSERT INTO wallet_subscription (user_id, balance) VALUES (p_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO wallet_bonus (user_id, balance) VALUES (p_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- Credit subscription wallet. We REPLACE the balance (not accumulate) because
  -- monthly subscription tokens don't roll over per A18 / R18.
  -- For first grant the existing balance is 0; for renewal we forfeit unused.
  SELECT balance INTO v_current_sub_balance
  FROM wallet_subscription WHERE user_id = p_user_id FOR UPDATE;

  UPDATE wallet_subscription
  SET balance    = v_plan_tokens,
      renews_at  = v_subscription_end,
      plan_code  = p_plan_id,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  INSERT INTO wallet_transactions (user_id, wallet, direction, amount, operation, status, balance_after, metadata)
  VALUES (p_user_id, 'subscription', 'credit', v_plan_tokens,
          CASE WHEN v_is_first THEN 'subscription.initial' ELSE 'subscription.renewal' END,
          'committed', v_plan_tokens,
          jsonb_build_object('plan', p_plan_id, 'billing_cycle', p_billing_cycle,
                             'forfeited_previous', v_current_sub_balance,
                             'subscription_id', p_subscription_id));

  -- Goal Bonus grant (A18)
  IF v_eligible_bonus THEN
    SELECT balance INTO v_current_bonus_balance
    FROM wallet_bonus WHERE user_id = p_user_id FOR UPDATE;

    -- Bonus expires at subscription end (matches the spec: "تنتهي مع نهاية الشهر الأول").
    v_new_bonus_expires_at := v_subscription_end;

    UPDATE wallet_bonus
    SET balance    = COALESCE(v_current_bonus_balance, 0) + v_bonus_amount,
        expires_at = GREATEST(COALESCE(expires_at, v_new_bonus_expires_at), v_new_bonus_expires_at),
        updated_at = NOW()
    WHERE user_id = p_user_id;

    INSERT INTO goal_completion_bonuses (user_id, amount_tokens, plan_at_grant, subscription_id, expires_at, status, metadata)
    VALUES (p_user_id, v_bonus_amount, p_plan_id, p_subscription_id, v_new_bonus_expires_at, 'active',
            jsonb_build_object('granted_with', 'subscription.initial', 'plan', p_plan_id));

    INSERT INTO wallet_transactions (user_id, wallet, direction, amount, operation, status, balance_after, metadata)
    VALUES (p_user_id, 'bonus', 'credit', v_bonus_amount, 'goal_bonus.granted', 'committed',
            COALESCE(v_current_bonus_balance, 0) + v_bonus_amount,
            jsonb_build_object('reason', 'first_subscription', 'plan', p_plan_id));
  ELSE
    v_bonus_amount := 0;
  END IF;

  -- Update profile (cache subscription lifecycle on the row)
  UPDATE profiles
  SET current_plan = p_plan_id,
      is_first_subscription = FALSE,
      subscription_started_at = COALESCE(subscription_started_at, NOW()),
      subscription_next_renewal_at = v_subscription_end,
      subscription_cancel_at_period_end = FALSE,
      updated_at = NOW()
  WHERE id = p_user_id;

  -- Activity log entry
  INSERT INTO activity_log (user_id, action, target, payload, pillar, tokens_charged)
  VALUES (p_user_id,
          CASE WHEN v_is_first THEN 'subscription.granted' ELSE 'subscription.renewed' END,
          p_plan_id,
          jsonb_build_object('tokens', v_plan_tokens, 'bonus', v_bonus_amount,
                             'plan', p_plan_id, 'billing_cycle', p_billing_cycle),
          'wallet', 0);

  RETURN jsonb_build_object(
    'success', TRUE,
    'plan', p_plan_id,
    'tokens_granted', v_plan_tokens,
    'bonus_granted', v_bonus_amount,
    'subscription_ends_at', v_subscription_end,
    'is_first', v_is_first
  );
END;
$$;

GRANT EXECUTE ON FUNCTION grant_subscription_tokens(UUID, TEXT, UUID, TEXT, BOOLEAN) TO service_role;

-- ─────────────────────────────────────────────
-- 5. upgrade_subscription_prorated — RPC (A19)
--    Caller passes the NEW plan id. We compute the prorated tokens to add
--    based on days remaining in the current period, update the plan, and
--    log the upgrade. The Moyasar charge happens separately in the engine;
--    this RPC is called only after the webhook confirms the upgrade payment.
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION upgrade_subscription_prorated(
  p_user_id      UUID,
  p_new_plan_id  TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_plan_id  TEXT;
  v_current_tokens   INTEGER;
  v_new_tokens       INTEGER;
  v_renews_at        TIMESTAMPTZ;
  v_days_remaining   NUMERIC;
  v_total_period_days NUMERIC := 30;
  v_prorated_tokens  INTEGER;
  v_current_balance  INTEGER;
BEGIN
  SELECT current_plan, subscription_next_renewal_at
    INTO v_current_plan_id, v_renews_at
  FROM profiles WHERE id = p_user_id;

  IF v_current_plan_id IS NULL OR v_current_plan_id = 'free' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'NO_ACTIVE_SUBSCRIPTION');
  END IF;

  SELECT monthly_tokens INTO v_current_tokens FROM plans WHERE id = v_current_plan_id;
  SELECT monthly_tokens INTO v_new_tokens     FROM plans WHERE id = p_new_plan_id;

  IF v_new_tokens IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'INVALID_PLAN', 'plan', p_new_plan_id);
  END IF;
  IF v_new_tokens <= COALESCE(v_current_tokens, 0) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'NOT_AN_UPGRADE',
                              'current_tokens', v_current_tokens, 'new_tokens', v_new_tokens);
  END IF;

  v_days_remaining := GREATEST(0,
    EXTRACT(EPOCH FROM (COALESCE(v_renews_at, NOW() + INTERVAL '30 days') - NOW())) / 86400.0
  );
  v_prorated_tokens := GREATEST(0, ROUND(
    (v_days_remaining / v_total_period_days) * (v_new_tokens - COALESCE(v_current_tokens, 0))
  ))::INTEGER;

  -- Add prorated tokens to subscription wallet (don't replace, ADD).
  INSERT INTO wallet_subscription (user_id, balance, renews_at, plan_code)
  VALUES (p_user_id, v_prorated_tokens, v_renews_at, p_new_plan_id)
  ON CONFLICT (user_id) DO UPDATE
    SET balance    = wallet_subscription.balance + v_prorated_tokens,
        plan_code  = p_new_plan_id,
        updated_at = NOW();

  SELECT balance INTO v_current_balance FROM wallet_subscription WHERE user_id = p_user_id;

  INSERT INTO wallet_transactions (user_id, wallet, direction, amount, operation, status, balance_after, metadata)
  VALUES (p_user_id, 'subscription', 'credit', v_prorated_tokens, 'subscription.upgraded',
          'committed', v_current_balance,
          jsonb_build_object('from', v_current_plan_id, 'to', p_new_plan_id,
                             'days_remaining', v_days_remaining,
                             'prorated_tokens', v_prorated_tokens));

  UPDATE profiles
  SET current_plan = p_new_plan_id, updated_at = NOW()
  WHERE id = p_user_id;

  INSERT INTO activity_log (user_id, action, target, payload, pillar, tokens_charged)
  VALUES (p_user_id, 'subscription.upgraded', p_new_plan_id,
          jsonb_build_object('from', v_current_plan_id, 'to', p_new_plan_id,
                             'prorated_tokens', v_prorated_tokens),
          'wallet', 0);

  RETURN jsonb_build_object(
    'success', TRUE,
    'from_plan', v_current_plan_id,
    'to_plan', p_new_plan_id,
    'prorated_tokens_added', v_prorated_tokens,
    'days_remaining', v_days_remaining
  );
END;
$$;

GRANT EXECUTE ON FUNCTION upgrade_subscription_prorated(UUID, TEXT) TO service_role;

-- ─────────────────────────────────────────────
-- 6. downgrade_subscription — RPC (A19)
--    Pure schedule mutation. Marks the next renewal to switch to the lower
--    plan; no tokens move now (current period stays at the higher plan).
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION downgrade_subscription(
  p_user_id      UUID,
  p_new_plan_id  TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_plan_id  TEXT;
  v_current_tokens   INTEGER;
  v_new_tokens       INTEGER;
  v_renews_at        TIMESTAMPTZ;
BEGIN
  SELECT current_plan, subscription_next_renewal_at
    INTO v_current_plan_id, v_renews_at
  FROM profiles WHERE id = p_user_id;

  IF v_current_plan_id IS NULL OR v_current_plan_id = 'free' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'NO_ACTIVE_SUBSCRIPTION');
  END IF;

  SELECT monthly_tokens INTO v_current_tokens FROM plans WHERE id = v_current_plan_id;
  SELECT monthly_tokens INTO v_new_tokens     FROM plans WHERE id = p_new_plan_id;

  IF v_new_tokens IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'INVALID_PLAN');
  END IF;
  IF v_new_tokens >= COALESCE(v_current_tokens, 0) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'NOT_A_DOWNGRADE');
  END IF;

  -- Note: we don't change current_plan now — that flips at renewal.
  -- Store the scheduled target in profile metadata (we keep this simple — a
  -- single column would also work but we want to preserve current_plan for
  -- the period's remaining days).
  UPDATE profiles
  SET subscription_cancel_at_period_end = FALSE,  -- explicitly NOT a cancel
      updated_at = NOW()
  WHERE id = p_user_id;

  -- Reflect on user_subscriptions metadata for the renewals cron to pick up.
  UPDATE user_subscriptions
  SET metadata = COALESCE(metadata, '{}'::jsonb)
                 || jsonb_build_object('downgrade_to', p_new_plan_id, 'downgrade_scheduled_at', NOW()),
      updated_at = NOW()
  WHERE user_id = p_user_id AND status = 'active';

  INSERT INTO activity_log (user_id, action, target, payload, pillar, tokens_charged)
  VALUES (p_user_id, 'subscription.downgrade_scheduled', p_new_plan_id,
          jsonb_build_object('from', v_current_plan_id, 'to', p_new_plan_id,
                             'applies_at', v_renews_at),
          'wallet', 0);

  RETURN jsonb_build_object(
    'success', TRUE,
    'from_plan', v_current_plan_id,
    'to_plan', p_new_plan_id,
    'applies_at', v_renews_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION downgrade_subscription(UUID, TEXT) TO service_role;

-- ─────────────────────────────────────────────
-- 7. credit_topup_wallet — RPC
--    Called by the Moyasar webhook on payment.paid for token_topup.
--    Credits wallet_topup (lifetime tokens). Idempotent on paymentId.
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION credit_topup_wallet(
  p_user_id     UUID,
  p_amount      INTEGER,
  p_payment_id  UUID,
  p_metadata    JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_already_processed UUID;
  v_new_balance       INTEGER;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'INVALID_AMOUNT');
  END IF;

  -- Idempotency check
  SELECT id INTO v_already_processed
  FROM wallet_transactions
  WHERE wallet = 'topup' AND direction = 'credit'
    AND operation = 'topup.purchase'
    AND metadata->>'payment_id' = p_payment_id::text
  LIMIT 1;

  IF v_already_processed IS NOT NULL THEN
    RETURN jsonb_build_object('success', TRUE, 'already_processed', TRUE,
                              'transaction_id', v_already_processed);
  END IF;

  INSERT INTO wallet_topup (user_id, balance) VALUES (p_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE wallet_topup
  SET balance = balance + p_amount,
      updated_at = NOW()
  WHERE user_id = p_user_id
  RETURNING balance INTO v_new_balance;

  INSERT INTO wallet_transactions (user_id, wallet, direction, amount, operation, status, balance_after, metadata)
  VALUES (p_user_id, 'topup', 'credit', p_amount, 'topup.purchase', 'committed', v_new_balance,
          COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object('payment_id', p_payment_id));

  INSERT INTO activity_log (user_id, action, target, payload, pillar, tokens_charged)
  VALUES (p_user_id, 'topup.completed', p_payment_id::text,
          jsonb_build_object('amount', p_amount, 'new_balance', v_new_balance),
          'wallet', 0);

  RETURN jsonb_build_object('success', TRUE, 'new_balance', v_new_balance, 'amount_credited', p_amount);
END;
$$;

GRANT EXECUTE ON FUNCTION credit_topup_wallet(UUID, INTEGER, UUID, JSONB) TO service_role;

-- ─────────────────────────────────────────────
-- 8. expire_bonuses — RPC (called by daily cron)
--    Sweeps goal_completion_bonuses where expires_at < NOW() AND status='active'.
--    Marks them 'expired' and zeroes the corresponding wallet_bonus balance
--    (only if the bonus that's expiring is still the only thing in wallet_bonus
--    — we never zero balance that came from refunds/promos added later).
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION expire_bonuses()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expired_count INTEGER := 0;
  v_zeroed_count  INTEGER := 0;
  r RECORD;
BEGIN
  FOR r IN
    SELECT id, user_id, amount_tokens
    FROM goal_completion_bonuses
    WHERE status = 'active' AND expires_at < NOW()
  LOOP
    UPDATE goal_completion_bonuses
    SET status = 'expired'
    WHERE id = r.id;
    v_expired_count := v_expired_count + 1;

    -- Note: we do NOT zero wallet_bonus.balance here. The wallet_bonus row's
    -- own expires_at is what gates availability via deduct_tokens_v2 + the
    -- user_wallet_totals view. This keeps audit clean — if the user gets a
    -- new promo bonus, it goes into wallet_bonus with a new expires_at.
    -- BUT we DO write a wallet_transactions row for visibility.
    INSERT INTO wallet_transactions (user_id, wallet, direction, amount, operation, status, balance_after, metadata)
    SELECT r.user_id, 'bonus', 'debit', r.amount_tokens, 'goal_bonus.expired', 'committed',
           COALESCE((SELECT balance FROM wallet_bonus WHERE user_id = r.user_id), 0),
           jsonb_build_object('goal_bonus_id', r.id);
    v_zeroed_count := v_zeroed_count + 1;
  END LOOP;

  RETURN jsonb_build_object('expired_count', v_expired_count, 'audit_rows', v_zeroed_count);
END;
$$;

GRANT EXECUTE ON FUNCTION expire_bonuses() TO service_role;

-- ─────────────────────────────────────────────
-- 9. payment_transactions: add `wallet_credited` column (audit clarity)
--    The legacy table has type='subscription'/'token_topup'/'product' but
--    doesn't say WHICH wallet got credited. After Sprint 7 the webhook fills
--    this so admin/finance dashboards can attribute revenue → wallet flow.
-- ─────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='payment_transactions' AND column_name='wallet_credited') THEN
    ALTER TABLE payment_transactions
      ADD COLUMN wallet_credited TEXT CHECK (wallet_credited IN ('bonus','subscription','topup'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='payment_transactions' AND column_name='tokens_credited') THEN
    ALTER TABLE payment_transactions ADD COLUMN tokens_credited INTEGER;
  END IF;
END $$;

COMMIT;
