-- ═══════════════════════════════════════════
-- deduct_tokens_v2 — Career Copilot 3-wallet RPC
-- ═══════════════════════════════════════════
-- Author: Career Copilot session
-- Date:   2026-05-28 (target apply date — pending Ali's go-ahead)
-- Scope:  Adds a NEW RPC that deducts in order bonus → subscription → topup.
--         Runs IN PARALLEL with the legacy `deduct_tokens_atomic` per
--         docs/decisions/A22.md (Q4 of pre-flight). Sprint 7 unifies them.
--
-- IMPORTANT: This RPC does NOT touch profiles.token_balance. Legacy code that
-- reads/writes profiles.token_balance continues to work; new code uses this RPC.
-- See docs/MASTER-BRIEF.md §6 and docs/decisions/A18.md.
--
-- Behavior:
--   - Returns JSON { success: bool, new_balance: int, error?: text, debited: jsonb }
--   - If the user has insufficient tokens, returns { success: false, error: 'INSUFFICIENT_TOKENS', ... }
--   - On success, writes one wallet_transactions row per wallet touched (1–3 rows)
--   - All-or-nothing: wrapped in plpgsql; either deduction completes across wallets or none does
--   - Expired bonus tokens are NOT counted as available (expires_at <= NOW())
--   - For monthly subscription: balance is whatever's in the table; expiration is owned by the renewal cron

BEGIN;

CREATE OR REPLACE FUNCTION deduct_tokens_v2(
  p_user_id   UUID,
  p_amount    INTEGER,
  p_operation TEXT,
  p_metadata  JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remaining       INTEGER := p_amount;
  v_bonus           INTEGER := 0;
  v_bonus_expired   BOOLEAN := FALSE;
  v_subscription    INTEGER := 0;
  v_topup           INTEGER := 0;
  v_total_available INTEGER := 0;
  v_take            INTEGER;
  v_new_bonus       INTEGER;
  v_new_sub         INTEGER;
  v_new_topup       INTEGER;
  v_debited         JSONB := '[]'::JSONB;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error',   'INVALID_AMOUNT',
      'new_balance', NULL
    );
  END IF;

  -- Lock all three wallet rows for this user (read or create-if-missing).
  -- We use FOR UPDATE to serialize concurrent deducts.
  INSERT INTO wallet_bonus       (user_id, balance) VALUES (p_user_id, 0) ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO wallet_subscription(user_id, balance) VALUES (p_user_id, 0) ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO wallet_topup       (user_id, balance) VALUES (p_user_id, 0) ON CONFLICT (user_id) DO NOTHING;

  SELECT balance,
         (expires_at IS NOT NULL AND expires_at <= NOW())
  INTO v_bonus, v_bonus_expired
  FROM wallet_bonus
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_bonus_expired THEN
    v_bonus := 0;  -- expired bonus tokens are unavailable but the row remains for audit
  END IF;

  SELECT balance INTO v_subscription
  FROM wallet_subscription
  WHERE user_id = p_user_id
  FOR UPDATE;

  SELECT balance INTO v_topup
  FROM wallet_topup
  WHERE user_id = p_user_id
  FOR UPDATE;

  v_total_available := COALESCE(v_bonus, 0) + COALESCE(v_subscription, 0) + COALESCE(v_topup, 0);

  IF v_total_available < p_amount THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error',   'INSUFFICIENT_TOKENS',
      'new_balance', v_total_available,
      'available', jsonb_build_object(
        'bonus',        v_bonus,
        'subscription', v_subscription,
        'topup',        v_topup
      )
    );
  END IF;

  -- 1) Pull from bonus first
  IF v_remaining > 0 AND v_bonus > 0 THEN
    v_take := LEAST(v_remaining, v_bonus);
    v_new_bonus := v_bonus - v_take;
    v_remaining := v_remaining - v_take;

    UPDATE wallet_bonus
       SET balance    = v_new_bonus,
           updated_at = NOW()
     WHERE user_id = p_user_id;

    INSERT INTO wallet_transactions (user_id, wallet, direction, amount, operation, status, balance_after, metadata)
    VALUES (p_user_id, 'bonus', 'debit', v_take, p_operation, 'committed', v_new_bonus, p_metadata);

    v_debited := v_debited || jsonb_build_array(jsonb_build_object('wallet','bonus','amount',v_take,'after',v_new_bonus));
  END IF;

  -- 2) Then subscription
  IF v_remaining > 0 AND v_subscription > 0 THEN
    v_take := LEAST(v_remaining, v_subscription);
    v_new_sub := v_subscription - v_take;
    v_remaining := v_remaining - v_take;

    UPDATE wallet_subscription
       SET balance    = v_new_sub,
           updated_at = NOW()
     WHERE user_id = p_user_id;

    INSERT INTO wallet_transactions (user_id, wallet, direction, amount, operation, status, balance_after, metadata)
    VALUES (p_user_id, 'subscription', 'debit', v_take, p_operation, 'committed', v_new_sub, p_metadata);

    v_debited := v_debited || jsonb_build_array(jsonb_build_object('wallet','subscription','amount',v_take,'after',v_new_sub));
  END IF;

  -- 3) Then top-up
  IF v_remaining > 0 AND v_topup > 0 THEN
    v_take := LEAST(v_remaining, v_topup);
    v_new_topup := v_topup - v_take;
    v_remaining := v_remaining - v_take;

    UPDATE wallet_topup
       SET balance    = v_new_topup,
           updated_at = NOW()
     WHERE user_id = p_user_id;

    INSERT INTO wallet_transactions (user_id, wallet, direction, amount, operation, status, balance_after, metadata)
    VALUES (p_user_id, 'topup', 'debit', v_take, p_operation, 'committed', v_new_topup, p_metadata);

    v_debited := v_debited || jsonb_build_array(jsonb_build_object('wallet','topup','amount',v_take,'after',v_new_topup));
  END IF;

  -- Sanity: we should have exhausted v_remaining (we checked total above)
  IF v_remaining > 0 THEN
    -- Should never happen, but bail clean if it does
    RAISE EXCEPTION 'deduct_tokens_v2: invariant violated; remaining=% after total check=%', v_remaining, v_total_available;
  END IF;

  RETURN jsonb_build_object(
    'success',     TRUE,
    'new_balance', v_total_available - p_amount,
    'debited',     v_debited
  );
END;
$$;

GRANT EXECUTE ON FUNCTION deduct_tokens_v2(UUID, INTEGER, TEXT, JSONB) TO authenticated, service_role;

-- Read helper — returns the combined balance and per-wallet breakdown.
-- Cheap to call; useful for the UI to render wallet display + pre-flight check.
CREATE OR REPLACE FUNCTION get_wallets_v2(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bonus           INTEGER := 0;
  v_bonus_expires   TIMESTAMPTZ;
  v_bonus_expired   BOOLEAN := FALSE;
  v_subscription    INTEGER := 0;
  v_sub_renews      TIMESTAMPTZ;
  v_topup           INTEGER := 0;
BEGIN
  SELECT balance, expires_at, (expires_at IS NOT NULL AND expires_at <= NOW())
    INTO v_bonus, v_bonus_expires, v_bonus_expired
    FROM wallet_bonus WHERE user_id = p_user_id;

  IF v_bonus_expired THEN v_bonus := 0; END IF;

  SELECT balance, renews_at INTO v_subscription, v_sub_renews
    FROM wallet_subscription WHERE user_id = p_user_id;

  SELECT balance INTO v_topup
    FROM wallet_topup WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'bonus',        jsonb_build_object('balance', COALESCE(v_bonus,0),        'expires_at', v_bonus_expires, 'expired', v_bonus_expired),
    'subscription', jsonb_build_object('balance', COALESCE(v_subscription,0), 'renews_at',  v_sub_renews),
    'topup',        jsonb_build_object('balance', COALESCE(v_topup,0)),
    'total',        COALESCE(v_bonus,0) + COALESCE(v_subscription,0) + COALESCE(v_topup,0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_wallets_v2(UUID) TO authenticated, service_role;

COMMIT;
