-- ═══════════════════════════════════════════
-- Resume v2 — Career Copilot Sprint 4
-- ═══════════════════════════════════════════
-- Author:  Career Copilot session (feat/career-copilot-sprint-4-resume)
-- Date:    2026-06-01 (target apply date — pending Ali's go-ahead)
-- Scope:   Adds resume_cache + resume_versions + resume_refinements +
--          resume_templates (4 seeded); plus 2 columns on profiles. Migrates
--          legacy `cv_versions` rows into resume_versions with status='legacy'
--          so the new CV List screen can show them under a "Legacy" banner.
--
-- Reads from: career_profile (Sprint 1), wallet_* + wallet_transactions
-- (used by deduct_tokens_v2 / refundTokens), radar_cache (deeplinks).
-- Does NOT touch: cv_versions (kept for legacy `cv.*` router), profile_analyses,
-- linkedin_analyses, posts, AI Workforce tables.
--
-- Per Golden Rule R09 caching is keyed on
-- (user_id, target_role, profile_hash, language); hit = 0 tokens.
-- Archive First Policy (per Sprint 4 prompt) — status='archived', never DELETE.
-- Refinements: first 5 per version free; charged 5 tokens after (R12).

BEGIN;

-- ─────────────────────────────────────────────
-- 1. resume_cache — the R09 cache
--    Unique key (user_id, target_role, profile_hash, language); hit = 0 tokens.
--    `is_full_build` distinguishes the 179-token full build from the
--    49-token "new version for a different role" derivative.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS resume_cache (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_role          TEXT NOT NULL,
  profile_hash         TEXT NOT NULL,
  template_id          TEXT NOT NULL,
  language             TEXT NOT NULL CHECK (language IN ('ar','en')),
  result               JSONB NOT NULL,
  ats_score            INTEGER NOT NULL CHECK (ats_score BETWEEN 0 AND 100),
  ats_breakdown        JSONB NOT NULL,
  tokens_charged       INTEGER NOT NULL DEFAULT 0 CHECK (tokens_charged >= 0),
  is_full_build        BOOLEAN NOT NULL DEFAULT TRUE,
  parent_resume_id     UUID REFERENCES resume_cache(id) ON DELETE SET NULL,
  source_linkedin_url  TEXT,
  hit_count            INTEGER NOT NULL DEFAULT 0 CHECK (hit_count >= 0),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_accessed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, target_role, profile_hash, language)
);

CREATE INDEX IF NOT EXISTS idx_resume_cache_user_recent
  ON resume_cache(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_resume_cache_lookup
  ON resume_cache(user_id, target_role, profile_hash, language);

ALTER TABLE resume_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS resume_cache_own_read ON resume_cache;
CREATE POLICY resume_cache_own_read ON resume_cache FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS resume_cache_own_write ON resume_cache;
CREATE POLICY resume_cache_own_write ON resume_cache FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS resume_cache_admin_all ON resume_cache;
CREATE POLICY resume_cache_admin_all ON resume_cache FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));

-- ─────────────────────────────────────────────
-- 2. resume_versions — every CV record, active/archived/legacy.
--    Archive First Policy (Sprint 4 prompt) — we never DELETE rows; archiving
--    sets status='archived'. Legacy rows from the old cv_versions table
--    are imported below with status='legacy'.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS resume_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cache_id        UUID REFERENCES resume_cache(id) ON DELETE SET NULL,
  target_role     TEXT NOT NULL,
  display_name    TEXT NOT NULL,
  template_id     TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','archived','legacy')),
  ats_score       INTEGER CHECK (ats_score IS NULL OR (ats_score BETWEEN 0 AND 100)),
  tokens_charged  INTEGER NOT NULL DEFAULT 0 CHECK (tokens_charged >= 0),
  wallet_used     TEXT CHECK (wallet_used IN ('bonus','subscription','topup','mixed')),
  language        TEXT NOT NULL DEFAULT 'ar' CHECK (language IN ('ar','en')),
  legacy_source   TEXT,
  archived_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resume_versions_user
  ON resume_versions(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_resume_versions_role
  ON resume_versions(user_id, target_role, status);

ALTER TABLE resume_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS resume_versions_own_read ON resume_versions;
CREATE POLICY resume_versions_own_read ON resume_versions FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS resume_versions_own_write ON resume_versions;
CREATE POLICY resume_versions_own_write ON resume_versions FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS resume_versions_admin_all ON resume_versions;
CREATE POLICY resume_versions_admin_all ON resume_versions FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));

-- ─────────────────────────────────────────────
-- 3. resume_refinements — per-section iteration log.
--    R12 — first 5 per version cost 0 tokens; subsequent refinements
--    cost 5 tokens each (logic enforced by the engine, not the schema).
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS resume_refinements (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version_id          UUID NOT NULL REFERENCES resume_versions(id) ON DELETE CASCADE,
  cache_id            UUID REFERENCES resume_cache(id) ON DELETE SET NULL,
  refinement_index    INTEGER NOT NULL CHECK (refinement_index >= 1),
  chip_type           TEXT NOT NULL,
  target_section      TEXT,
  prompt              TEXT NOT NULL,
  result_diff         JSONB,
  tokens_charged      INTEGER NOT NULL DEFAULT 0 CHECK (tokens_charged >= 0),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refinements_version
  ON resume_refinements(version_id, refinement_index);
CREATE INDEX IF NOT EXISTS idx_refinements_user
  ON resume_refinements(user_id, created_at DESC);

ALTER TABLE resume_refinements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS resume_refinements_own_all ON resume_refinements;
CREATE POLICY resume_refinements_own_all ON resume_refinements FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS resume_refinements_admin_all ON resume_refinements;
CREATE POLICY resume_refinements_admin_all ON resume_refinements FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));

-- ─────────────────────────────────────────────
-- 4. resume_templates — catalog of available templates with recommendation
--    metadata (level fit, region fit, industry boost). Public read, admin write.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS resume_templates (
  id                TEXT PRIMARY KEY,
  display_name_ar   TEXT NOT NULL,
  display_name_en   TEXT NOT NULL,
  description_ar    TEXT,
  description_en    TEXT,
  layout_type       TEXT NOT NULL CHECK (layout_type IN ('classic','modern','creative','executive')),
  region_fit        TEXT[] NOT NULL DEFAULT ARRAY['global']::TEXT[],
  language_fit      TEXT[] NOT NULL DEFAULT ARRAY['ar','en']::TEXT[],
  level_fit         TEXT[] NOT NULL DEFAULT ARRAY['entry','mid','senior','executive']::TEXT[],
  industry_boost    TEXT[] DEFAULT NULL,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  preview_url       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO resume_templates (id, display_name_ar, display_name_en, description_ar, description_en, layout_type, region_fit, level_fit) VALUES
  ('harvard_classic',
    'هارفارد الكلاسيكي', 'Harvard Classic',
    'تنسيق احترافي مجرّب، مفضل عالمياً', 'Battle-tested professional layout',
    'classic', ARRAY['global','saudi','gcc'], ARRAY['mid','senior','executive']),
  ('mit_technical',
    'MIT للتقنيين', 'MIT Technical',
    'مناسب للمهندسين والمطورين', 'For engineers and developers',
    'modern', ARRAY['global'], ARRAY['entry','mid','senior']),
  ('saudi_executive',
    'القيادي السعودي', 'Saudi Executive',
    'تنسيق فاخر للقيادات في السوق السعودي', 'Premium layout for KSA market executives',
    'executive', ARRAY['saudi','gcc'], ARRAY['senior','executive']),
  ('modern_minimal',
    'العصري المختصر', 'Modern Minimal',
    'تصميم نظيف عصري للمحترفين', 'Clean modern design for professionals',
    'modern', ARRAY['global','saudi','gcc'], ARRAY['entry','mid','senior'])
ON CONFLICT (id) DO NOTHING;

ALTER TABLE resume_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS resume_templates_public_read ON resume_templates;
CREATE POLICY resume_templates_public_read ON resume_templates FOR SELECT USING (is_active = TRUE);
DROP POLICY IF EXISTS resume_templates_admin_all ON resume_templates;
CREATE POLICY resume_templates_admin_all ON resume_templates FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));

-- ─────────────────────────────────────────────
-- 5. profiles — 2 new columns for CV bookkeeping.
-- ─────────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_resume_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS active_resume_count INTEGER
  NOT NULL DEFAULT 0 CHECK (active_resume_count >= 0);

-- ─────────────────────────────────────────────
-- 6. Migrate legacy cv_versions rows → resume_versions with status='legacy'.
--    The old table only has (id, user_id, field_name, cv_content, download_url,
--    created_at). We don't know the target_role; bucket it under 'legacy'.
--    The new CV List screen will display these under a "Legacy CV" banner with
--    a CTA to start a fresh Sprint-4 build for full features.
--    Idempotent — re-running the migration won't duplicate rows because the
--    legacy_source key encodes the original cv_versions.id.
-- ─────────────────────────────────────────────
INSERT INTO resume_versions (
  user_id, target_role, display_name, template_id, status, language,
  legacy_source, created_at, updated_at
)
SELECT
  cv.user_id,
  'legacy' AS target_role,
  COALESCE(NULLIF(cv.field_name, ''), 'Legacy CV') AS display_name,
  'modern_minimal' AS template_id,
  'legacy' AS status,
  'ar' AS language,
  'cv_versions:' || cv.id::text AS legacy_source,
  cv.created_at,
  cv.created_at
FROM cv_versions cv
WHERE NOT EXISTS (
  SELECT 1 FROM resume_versions rv
  WHERE rv.legacy_source = 'cv_versions:' || cv.id::text
);

COMMIT;
