-- ═══════════════════════════════════════════
-- Career Copilot Foundation — Sprint 1
-- ═══════════════════════════════════════════
-- Author: Career Copilot session (feat/career-copilot-transformation)
-- Date:   2026-05-28 (target apply date — pending Ali's go-ahead)
-- Scope:  Adds the career_profile backbone + section_overrides + 3-wallet system
--         + wallet_transactions audit + token_packages catalog + ai_suggestions
--         + activity_log. Does NOT recreate `subscriptions` (already shipped by
--         20260525_operations_portal.sql).
--
-- IMPORTANT — DO NOT APPLY without explicit approval. The legacy single-balance
-- column `profiles.token_balance` is preserved untouched; legacy code keeps
-- working until Sprint 7 unifies the RPCs. See docs/decisions/A18.md.
--
-- The companion RPC `deduct_tokens_v2` lives in a separate SQL file so it can
-- be reviewed independently before apply.

BEGIN;

-- ─────────────────────────────────────────────
-- 1. career_profile  — the backbone
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS career_profile (
  user_id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  goal              TEXT NOT NULL CHECK (goal IN ('job_search','promotion','personal_brand','opportunities','career_change')),
  level             TEXT NOT NULL CHECK (level IN ('entry','mid','senior','executive')),
  target_role       TEXT NOT NULL,
  industry          TEXT NOT NULL,
  primary_language  TEXT NOT NULL DEFAULT 'ar' CHECK (primary_language IN ('ar','en')),
  linkedin_url      TEXT,
  manual_about      TEXT,
  manual_top_skills TEXT[],
  manual_current_role     TEXT,
  manual_years_experience INTEGER,
  manual_education        TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_career_profile_target_role ON career_profile(target_role);
CREATE INDEX IF NOT EXISTS idx_career_profile_industry ON career_profile(industry);

-- updated_at autopilot
CREATE OR REPLACE FUNCTION career_profile_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS career_profile_touch ON career_profile;
CREATE TRIGGER career_profile_touch
  BEFORE UPDATE ON career_profile
  FOR EACH ROW EXECUTE FUNCTION career_profile_touch_updated_at();

ALTER TABLE career_profile ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS career_profile_own_read ON career_profile;
CREATE POLICY career_profile_own_read ON career_profile FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS career_profile_own_write ON career_profile;
CREATE POLICY career_profile_own_write ON career_profile FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- 2. section_overrides — temporary "act as if" experiments
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS section_overrides (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  section     TEXT NOT NULL CHECK (section IN ('radar','resume','content')),
  payload     JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_section_overrides_user_section
  ON section_overrides(user_id, section)
  WHERE expires_at > NOW();

ALTER TABLE section_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS section_overrides_own_read ON section_overrides;
CREATE POLICY section_overrides_own_read ON section_overrides FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS section_overrides_own_write ON section_overrides;
CREATE POLICY section_overrides_own_write ON section_overrides FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- 3. wallet_bonus
--    Promo grants, refunds-as-bonus, Explore plan first-journey.
--    Expires (default 90 days). Consumed FIRST.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wallet_bonus (
  user_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance     INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  expires_at  TIMESTAMPTZ,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE wallet_bonus ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wallet_bonus_own_read ON wallet_bonus;
CREATE POLICY wallet_bonus_own_read ON wallet_bonus FOR SELECT
  USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- 4. wallet_subscription
--    Monthly plan renewal. Expires monthly. Consumed SECOND.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wallet_subscription (
  user_id      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance      INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  renews_at    TIMESTAMPTZ,
  plan_code    TEXT,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE wallet_subscription ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wallet_subscription_own_read ON wallet_subscription;
CREATE POLICY wallet_subscription_own_read ON wallet_subscription FOR SELECT
  USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- 5. wallet_topup
--    Paid top-ups. Lifetime (never expires). Consumed THIRD.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wallet_topup (
  user_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance     INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE wallet_topup ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wallet_topup_own_read ON wallet_topup;
CREATE POLICY wallet_topup_own_read ON wallet_topup FOR SELECT
  USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- 6. wallet_transactions — unified audit trail
--    Every credit and debit across all 3 wallets writes here.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet        TEXT NOT NULL CHECK (wallet IN ('bonus','subscription','topup')),
  direction     TEXT NOT NULL CHECK (direction IN ('credit','debit')),
  amount        INTEGER NOT NULL CHECK (amount > 0),
  operation     TEXT NOT NULL,            -- e.g. 'radar.analyze', 'topup.purchase'
  status        TEXT NOT NULL DEFAULT 'committed' CHECK (status IN ('pending','committed','failed','refunded')),
  balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
  metadata      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_tx_user_created ON wallet_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_user_status  ON wallet_transactions(user_id, status);

ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wallet_tx_own_read ON wallet_transactions;
CREATE POLICY wallet_tx_own_read ON wallet_transactions FOR SELECT
  USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- 7. token_packages — catalog (read-only to clients)
--    Drives the Pricing page and Top-up purchase flow (Sprint 7 wires it).
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS token_packages (
  code         TEXT PRIMARY KEY,
  name_ar      TEXT NOT NULL,
  name_en      TEXT NOT NULL,
  kind         TEXT NOT NULL CHECK (kind IN ('plan','topup')),
  tokens       INTEGER NOT NULL CHECK (tokens >= 0),
  price_sar    NUMERIC(10,2) NOT NULL CHECK (price_sar >= 0),
  expires_after_days INTEGER,
  description_ar TEXT,
  description_en TEXT,
  display_order  INTEGER NOT NULL DEFAULT 0,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE token_packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS token_packages_public_read ON token_packages;
CREATE POLICY token_packages_public_read ON token_packages FOR SELECT
  USING (is_active = TRUE);

INSERT INTO token_packages (code, name_ar, name_en, kind, tokens, price_sar, description_ar, description_en, display_order) VALUES
  ('plan_explore',  'استكشف',  'Explore',    'plan', 343, 0,     'رحلة كاملة مجانية مرة واحدة',                      '1 full lifetime journey, included',         10),
  ('plan_liftoff',  'الانطلاق','Liftoff',    'plan', 200, 149,   '200 توكن متجددة شهرياً',                            '200 tokens, renews monthly',                20),
  ('plan_growth',   'النمو',   'Growth',     'plan', 500, 299,   '500 توكن متجددة شهرياً',                            '500 tokens, renews monthly',                30),
  ('topup_100',     'حزمة 100','Top-up 100', 'topup', 100, 79,    '100 توكن دائمة (لا تنتهي)',                         '100 tokens, lifetime (no expiry)',          40),
  ('topup_250',     'حزمة 250','Top-up 250', 'topup', 250, 169,   '250 توكن دائمة (لا تنتهي)',                         '250 tokens, lifetime (no expiry)',          50),
  ('topup_500',     'حزمة 500','Top-up 500', 'topup', 500, 299,   '500 توكن دائمة (لا تنتهي)',                         '500 tokens, lifetime (no expiry)',          60)
ON CONFLICT (code) DO NOTHING;

-- ─────────────────────────────────────────────
-- 8. ai_suggestions — Next Task cards (Sprint 6 writes; Dashboard reads)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_suggestions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  headline   TEXT NOT NULL,
  rationale  TEXT NOT NULL,
  cta_url    TEXT NOT NULL,
  score      INTEGER NOT NULL CHECK (score BETWEEN 1 AND 10),
  language   TEXT NOT NULL CHECK (language IN ('ar','en')),
  dismissed  BOOLEAN NOT NULL DEFAULT FALSE,
  actioned   BOOLEAN NOT NULL DEFAULT FALSE,
  computed_for_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_suggestions_user_date
  ON ai_suggestions(user_id, computed_for_date DESC);

ALTER TABLE ai_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_suggestions_own_read ON ai_suggestions;
CREATE POLICY ai_suggestions_own_read ON ai_suggestions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS ai_suggestions_own_write ON ai_suggestions;
CREATE POLICY ai_suggestions_own_write ON ai_suggestions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- 9. activity_log — event source for Sprint 6 (and a useful audit trail now)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_log (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  action     TEXT NOT NULL,
  target     TEXT,
  payload    JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_user_created
  ON activity_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_action
  ON activity_log(action, created_at DESC);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS activity_log_own_read ON activity_log;
CREATE POLICY activity_log_own_read ON activity_log FOR SELECT
  USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- 10. Migration of existing users (decided 2026-05-25, Q2 + Q3 of Stop&Ask)
--     - All existing profiles.token_balance → wallet_topup (lifetime).
--     - Plus a goodwill bonus to every existing user: 343 tokens (one full
--       Explore journey) into wallet_bonus, expiring in 90 days.
--     - profiles.token_balance is kept untouched so legacy code keeps working
--       until Sprint 7 unifies the RPCs.
-- ─────────────────────────────────────────────

INSERT INTO wallet_topup (user_id, balance, updated_at)
SELECT id, COALESCE(token_balance, 0), NOW()
FROM profiles
WHERE id IS NOT NULL
ON CONFLICT (user_id) DO UPDATE
  SET balance = EXCLUDED.balance,
      updated_at = EXCLUDED.updated_at;

INSERT INTO wallet_bonus (user_id, balance, expires_at, updated_at)
SELECT id, 343, NOW() + INTERVAL '90 days', NOW()
FROM profiles
WHERE id IS NOT NULL
ON CONFLICT (user_id) DO UPDATE
  SET balance    = wallet_bonus.balance + 343,
      expires_at = GREATEST(wallet_bonus.expires_at, NOW() + INTERVAL '90 days'),
      updated_at = NOW();

INSERT INTO wallet_subscription (user_id, balance, updated_at)
SELECT id, 0, NOW()
FROM profiles
WHERE id IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- Audit trail rows for the goodwill grant
INSERT INTO wallet_transactions (user_id, wallet, direction, amount, operation, status, balance_after, metadata)
SELECT id, 'bonus', 'credit', 343, 'cutover.goodwill_grant', 'committed', 343,
       jsonb_build_object('source','sprint-1 cutover','expires_at_days',90)
FROM profiles;

INSERT INTO wallet_transactions (user_id, wallet, direction, amount, operation, status, balance_after, metadata)
SELECT id, 'topup', 'credit', COALESCE(token_balance, 0), 'cutover.legacy_balance', 'committed', COALESCE(token_balance, 0),
       jsonb_build_object('source','sprint-1 cutover','from','profiles.token_balance')
FROM profiles
WHERE COALESCE(token_balance, 0) > 0;

COMMIT;
