-- ═══════════════════════════════════════════
-- Content v2 — Career Copilot Sprint 5
-- ═══════════════════════════════════════════
-- Author:  Career Copilot session (feat/career-copilot-sprint-5-content)
-- Date:    2026-06-02 (target apply date — pending Ali's go-ahead)
-- Scope:   Adds 5 tables (content_cache, content_versions,
--          content_refinements, content_topic_suggestions, content_reminders)
--          + 2 columns on profiles. Migrates legacy `posts` rows into
--          content_versions with status='legacy' so the new Content Hub
--          can show them under a "Legacy" banner.
--
-- Reads from: career_profile (Sprint 1), wallet_* + wallet_transactions
-- (used by deduct_tokens_v2 / refundTokens), activity_log.
-- Does NOT touch: posts (legacy table — kept for legacy `posts.*` router),
-- profile_analyses, linkedin_analyses, cv_versions, AI Workforce tables,
-- radar_*, resume_*.
--
-- Per Golden Rule R09 caching is keyed on
-- (user_id, content_type, topic_hash, language); hit = 0 tokens.
-- For repurpose, source_post_id is part of the cache identity.
-- Archive First Policy (per Sprint 4 pattern) — status='archived', never DELETE.
-- Refinements: first 5 per version free; charged 5 tokens after (R12 / A12).
-- Tone Rules (A11) — enforced by the engine before write, not by the schema.

BEGIN;

-- ─────────────────────────────────────────────
-- 1. content_cache — R09 cache
--    Unique key (user_id, content_type, topic_hash, language) for post/carousel.
--    For repurpose, topic_hash is derived from source_post_id.
--    expires_at: post/carousel = +7 days, repurpose = +30 days (per PRD/05).
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS content_cache (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type         TEXT NOT NULL CHECK (content_type IN ('post','carousel','repurpose_bundle')),
  topic_hash           TEXT NOT NULL,
  topic                TEXT NOT NULL,
  source_post_id       UUID,                                       -- only for repurpose_bundle
  result               JSONB NOT NULL,
  language             TEXT NOT NULL CHECK (language IN ('ar','en')),
  tokens_charged       INTEGER NOT NULL DEFAULT 0 CHECK (tokens_charged >= 0),
  hit_count            INTEGER NOT NULL DEFAULT 0 CHECK (hit_count >= 0),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_accessed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at           TIMESTAMPTZ NOT NULL,
  UNIQUE(user_id, content_type, topic_hash, language)
);

CREATE INDEX IF NOT EXISTS idx_content_cache_user_recent
  ON content_cache(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_cache_lookup
  ON content_cache(user_id, content_type, topic_hash, language);
CREATE INDEX IF NOT EXISTS idx_content_cache_expiry
  ON content_cache(expires_at);

ALTER TABLE content_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS content_cache_own_all ON content_cache;
CREATE POLICY content_cache_own_all ON content_cache FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS content_cache_admin_all ON content_cache;
CREATE POLICY content_cache_admin_all ON content_cache FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));

-- ─────────────────────────────────────────────
-- 2. content_versions — every piece of content, active/archived/published/legacy.
--    Archive First Policy — we never DELETE rows; archiving sets status='archived'.
--    Legacy rows from the existing `posts` table are imported below with
--    status='legacy'.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS content_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cache_id        UUID REFERENCES content_cache(id) ON DELETE SET NULL,
  content_type    TEXT NOT NULL CHECK (content_type IN ('post','carousel','repurpose_bundle')),
  display_title   TEXT NOT NULL,
  topic           TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','archived','published_externally','legacy')),
  tokens_charged  INTEGER NOT NULL DEFAULT 0 CHECK (tokens_charged >= 0),
  wallet_used     TEXT CHECK (wallet_used IN ('bonus','subscription','topup','mixed')),
  language        TEXT NOT NULL DEFAULT 'ar' CHECK (language IN ('ar','en')),
  legacy_source   TEXT,
  external_url    TEXT,
  archived_at     TIMESTAMPTZ,
  published_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_versions_user
  ON content_versions(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_versions_type
  ON content_versions(user_id, content_type, status);

ALTER TABLE content_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS content_versions_own_all ON content_versions;
CREATE POLICY content_versions_own_all ON content_versions FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS content_versions_admin_all ON content_versions;
CREATE POLICY content_versions_admin_all ON content_versions FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));

-- ─────────────────────────────────────────────
-- 3. content_refinements — per-piece refinement log.
--    R12 / A12 — first 5 per version cost 0 tokens; subsequent refinements
--    cost 5 tokens each (logic enforced by the engine, not the schema).
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS content_refinements (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version_id          UUID NOT NULL REFERENCES content_versions(id) ON DELETE CASCADE,
  cache_id            UUID REFERENCES content_cache(id) ON DELETE SET NULL,
  refinement_index    INTEGER NOT NULL CHECK (refinement_index >= 1),
  chip_type           TEXT NOT NULL,
  prompt              TEXT NOT NULL,
  result_diff         JSONB,
  tokens_charged      INTEGER NOT NULL DEFAULT 0 CHECK (tokens_charged >= 0),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_refinements_version
  ON content_refinements(version_id, refinement_index);
CREATE INDEX IF NOT EXISTS idx_content_refinements_user
  ON content_refinements(user_id, created_at DESC);

ALTER TABLE content_refinements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS content_refinements_own_all ON content_refinements;
CREATE POLICY content_refinements_own_all ON content_refinements FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS content_refinements_admin_all ON content_refinements;
CREATE POLICY content_refinements_admin_all ON content_refinements FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));

-- ─────────────────────────────────────────────
-- 4. content_topic_suggestions — Quick Start suggestions cache.
--    Refreshed every 24h, keyed by (user_id, profile_hash, language).
--    profile_hash captures the user's career_profile state so suggestions
--    refresh automatically when the profile changes.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS content_topic_suggestions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  suggestions     JSONB NOT NULL,           -- array of { topic, recommended_type, reason }
  profile_hash    TEXT NOT NULL,
  language        TEXT NOT NULL CHECK (language IN ('ar','en')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL,
  UNIQUE(user_id, profile_hash, language)
);

CREATE INDEX IF NOT EXISTS idx_content_suggestions_lookup
  ON content_topic_suggestions(user_id, profile_hash, language);
CREATE INDEX IF NOT EXISTS idx_content_suggestions_expiry
  ON content_topic_suggestions(expires_at);

ALTER TABLE content_topic_suggestions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS content_suggestions_own_all ON content_topic_suggestions;
CREATE POLICY content_suggestions_own_all ON content_topic_suggestions FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS content_suggestions_admin_all ON content_topic_suggestions;
CREATE POLICY content_suggestions_admin_all ON content_topic_suggestions FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));

-- ─────────────────────────────────────────────
-- 5. content_reminders — smart reminder for publishing (per A12 V1).
--    NOT scheduled publishing (no LinkedIn API). Triggers an in-app or email
--    nudge at remind_at so the user remembers to post their drafted content.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS content_reminders (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version_id              UUID NOT NULL REFERENCES content_versions(id) ON DELETE CASCADE,
  remind_at               TIMESTAMPTZ NOT NULL,
  status                  TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','sent','dismissed','acted_upon')),
  sent_at                 TIMESTAMPTZ,
  acted_upon_at           TIMESTAMPTZ,
  notification_channel    TEXT[] NOT NULL DEFAULT ARRAY['in_app']::TEXT[],
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_reminders_pending
  ON content_reminders(remind_at, status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_content_reminders_user
  ON content_reminders(user_id, created_at DESC);

ALTER TABLE content_reminders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS content_reminders_own_all ON content_reminders;
CREATE POLICY content_reminders_own_all ON content_reminders FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS content_reminders_admin_all ON content_reminders;
CREATE POLICY content_reminders_admin_all ON content_reminders FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));

-- ─────────────────────────────────────────────
-- 6. profiles — 2 new columns for content bookkeeping.
--    posts_count_since_last_radar already exists from Sprint 3 (idempotent).
-- ─────────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_content_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS active_content_count INTEGER
  NOT NULL DEFAULT 0 CHECK (active_content_count >= 0);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS posts_count_since_last_radar INTEGER
  NOT NULL DEFAULT 0 CHECK (posts_count_since_last_radar >= 0);

-- ─────────────────────────────────────────────
-- 7. Migrate legacy posts → content_versions with status='legacy'.
--    The old `posts` table has (id, user_id, content, topic, status,
--    language, variations, tokens_used, created_at, ...). We bucket all
--    legacy rows as content_type='post' (the closest match in v2).
--    Idempotent — re-running won't duplicate rows because legacy_source
--    encodes the original posts.id.
-- ─────────────────────────────────────────────
INSERT INTO content_versions (
  user_id, content_type, display_title, topic, status, tokens_charged,
  language, legacy_source, created_at, updated_at
)
SELECT
  p.user_id,
  'post' AS content_type,
  COALESCE(
    NULLIF(p.topic, ''),
    NULLIF(LEFT(p.content, 60), ''),
    'Legacy post'
  ) AS display_title,
  COALESCE(NULLIF(p.topic, ''), 'legacy') AS topic,
  'legacy' AS status,
  COALESCE(p.tokens_used, 0) AS tokens_charged,
  COALESCE(NULLIF(p.language, ''), 'ar') AS language,
  'posts:' || p.id::text AS legacy_source,
  COALESCE(p.created_at, NOW()) AS created_at,
  COALESCE(p.updated_at, p.created_at, NOW()) AS updated_at
FROM posts p
WHERE NOT EXISTS (
  SELECT 1 FROM content_versions cv
  WHERE cv.legacy_source = 'posts:' || p.id::text
);

COMMIT;
