-- ═══════════════════════════════════════════
-- Radar v2 — Career Copilot Sprint 3
-- ═══════════════════════════════════════════
-- Author:  Career Copilot session (feat/career-copilot-sprint-3-radar)
-- Date:    2026-05-31 (target apply date — pending Ali's go-ahead)
-- Scope:   Adds radar_cache + radar_analyses + radar_applied_fixes
--          + radar_refresh_triggers; plus 3 new columns on profiles for
--          refresh-trigger bookkeeping.
--
-- Reads from: career_profile (Sprint 1), wallet_* + wallet_transactions
-- (Sprint 1, used by deduct_tokens_v2 / refund_tokens_v2 helpers in TS).
-- Does NOT touch: profile_analyses (legacy, used by linkedin.analyzeTargeted),
-- linkedin_analyses, cv_versions, posts, AI Workforce tables.
--
-- Per Golden Rule R09 ("Caching is non-negotiable"), the unique key
-- (user_id, target_role, profile_hash) is what makes a cache hit free.
-- Per Golden Rule R03 ("Tokens deducted only on success"), the engine
-- deducts AFTER analysis succeeds and refunds on failure — those rules
-- live in TS (server/_core/lib/radar-engine.ts), not in SQL.

BEGIN;

-- ─────────────────────────────────────────────
-- 1. radar_cache — the heart of R09
--    Key: (user_id, target_role, profile_hash, language)
--    A cache hit = 0 wallet tokens, plus hit_count++ for analytics.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS radar_cache (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_role          TEXT NOT NULL,
  profile_hash         TEXT NOT NULL,
  language             TEXT NOT NULL CHECK (language IN ('ar','en')),
  result               JSONB NOT NULL,
  current_score        INTEGER NOT NULL CHECK (current_score BETWEEN 0 AND 100),
  target_score         INTEGER NOT NULL CHECK (target_score BETWEEN 0 AND 100),
  source_linkedin_url  TEXT,
  tokens_charged       INTEGER NOT NULL DEFAULT 0 CHECK (tokens_charged >= 0),
  hit_count            INTEGER NOT NULL DEFAULT 0 CHECK (hit_count >= 0),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_accessed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, target_role, profile_hash, language)
);

CREATE INDEX IF NOT EXISTS idx_radar_cache_user_recent
  ON radar_cache(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_radar_cache_lookup
  ON radar_cache(user_id, target_role, profile_hash, language);

ALTER TABLE radar_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS radar_cache_own_read ON radar_cache;
CREATE POLICY radar_cache_own_read ON radar_cache FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS radar_cache_own_write ON radar_cache;
CREATE POLICY radar_cache_own_write ON radar_cache FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admins (Faris and friends) can see everyone's cache for cost/usage analytics.
DROP POLICY IF EXISTS radar_cache_admin_all ON radar_cache;
CREATE POLICY radar_cache_admin_all ON radar_cache FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));

-- ─────────────────────────────────────────────
-- 2. radar_analyses — every run (hit OR miss) writes here
--    Distinguishes cache hits from real model calls so we can compute
--    "what was the user actually charged for, in aggregate."
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS radar_analyses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cache_id        UUID REFERENCES radar_cache(id) ON DELETE SET NULL,
  target_role     TEXT NOT NULL,
  is_cache_hit    BOOLEAN NOT NULL DEFAULT FALSE,
  tokens_charged  INTEGER NOT NULL DEFAULT 0 CHECK (tokens_charged >= 0),
  wallet_used     TEXT CHECK (wallet_used IN ('bonus','subscription','topup','mixed')),
  current_score   INTEGER,
  target_score    INTEGER,
  language        TEXT NOT NULL CHECK (language IN ('ar','en')),
  override_id     UUID REFERENCES section_overrides(id) ON DELETE SET NULL,
  duration_ms     INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_radar_analyses_user
  ON radar_analyses(user_id, created_at DESC);

ALTER TABLE radar_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS radar_analyses_own_read ON radar_analyses;
CREATE POLICY radar_analyses_own_read ON radar_analyses FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS radar_analyses_own_insert ON radar_analyses;
CREATE POLICY radar_analyses_own_insert ON radar_analyses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS radar_analyses_admin_all ON radar_analyses;
CREATE POLICY radar_analyses_admin_all ON radar_analyses FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));

-- ─────────────────────────────────────────────
-- 3. radar_applied_fixes — Included Fixes the user accepted
--    Sprint 3 just records the choice (no LinkedIn push yet). Sprint 4
--    will actually mutate the LinkedIn profile via API where supported.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS radar_applied_fixes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cache_id        UUID REFERENCES radar_cache(id) ON DELETE SET NULL,
  field           TEXT NOT NULL CHECK (field IN ('headline','about','experience','skills','custom')),
  fix_index       INTEGER,
  original_value  TEXT,
  applied_value   TEXT,
  status          TEXT NOT NULL DEFAULT 'applied' CHECK (status IN ('applied','reverted','skipped')),
  applied_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reverted_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_radar_fixes_user
  ON radar_applied_fixes(user_id, applied_at DESC);

ALTER TABLE radar_applied_fixes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS radar_fixes_own_all ON radar_applied_fixes;
CREATE POLICY radar_fixes_own_all ON radar_applied_fixes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS radar_fixes_admin_all ON radar_applied_fixes;
CREATE POLICY radar_fixes_admin_all ON radar_applied_fixes FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));

-- ─────────────────────────────────────────────
-- 4. radar_refresh_triggers — what nudges a user to re-run the Radar
--    Per A02, triggers include: 5 new posts, target_role changed,
--    new resume built, first LinkedIn link added, 30 days passed.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS radar_refresh_triggers (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trigger_type       TEXT NOT NULL CHECK (trigger_type IN (
    'manual',
    '5_new_posts',
    'target_role_changed',
    'new_resume',
    'linkedin_first_link',
    '30_days_passed',
    'profile_data_changed'
  )),
  metadata           JSONB,
  detected_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notified_user_at   TIMESTAMPTZ,
  acted_upon_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_radar_triggers_user
  ON radar_refresh_triggers(user_id, detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_radar_triggers_unacted
  ON radar_refresh_triggers(user_id, detected_at DESC)
  WHERE acted_upon_at IS NULL;

ALTER TABLE radar_refresh_triggers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS radar_triggers_own_read ON radar_refresh_triggers;
CREATE POLICY radar_triggers_own_read ON radar_refresh_triggers FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS radar_triggers_own_update ON radar_refresh_triggers;
CREATE POLICY radar_triggers_own_update ON radar_refresh_triggers FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- System (service-role) inserts triggers from cron jobs / event hooks.
DROP POLICY IF EXISTS radar_triggers_admin_all ON radar_refresh_triggers;
CREATE POLICY radar_triggers_admin_all ON radar_refresh_triggers FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));

-- ─────────────────────────────────────────────
-- 5. profiles — 3 new columns for refresh-trigger bookkeeping
--    last_radar_at / last_radar_score: drives the "since your last Radar…"
--      copy on the preflight screen and the 30-day refresh trigger.
--    posts_count_since_last_radar: incremented by the posts router on
--      every published post; resets when a new Radar runs.
-- ─────────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_radar_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_radar_score INTEGER
  CHECK (last_radar_score IS NULL OR (last_radar_score BETWEEN 0 AND 100));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS posts_count_since_last_radar INTEGER
  NOT NULL DEFAULT 0 CHECK (posts_count_since_last_radar >= 0);

COMMIT;
