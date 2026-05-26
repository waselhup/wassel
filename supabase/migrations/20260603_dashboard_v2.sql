-- ═══════════════════════════════════════════
-- Dashboard v2 — Career Copilot Sprint 6
-- ═══════════════════════════════════════════
-- Author:  Career Copilot session (feat/career-copilot-sprint-6-dashboard)
-- Date:    2026-06-03 (target apply date — pending Ali's go-ahead)
-- Scope:   Extends existing activity_log + ai_suggestions (from Sprint 1) with
--          dashboard-specific columns; adds career_pulse_snapshots and
--          wallet_suffices_for_cache; bumps profiles with two dashboard columns;
--          backfills activity_log from radar_analyses + resume_versions +
--          content_versions so the timeline has content on day 1.
--
-- Reads from: profiles, career_profile, wallet_*, radar_*, resume_*, content_*.
-- DOES NOT touch: any portal/agent tables, war room, finance, ops.
--
-- Idempotent — every CREATE is `IF NOT EXISTS`, every ALTER uses `IF NOT EXISTS`
-- on the column, every backfill is `WHERE NOT EXISTS (…)`.

BEGIN;

-- ─────────────────────────────────────────────
-- 1. Extend the existing activity_log (Sprint 1) with dashboard columns
--    Existing columns: id BIGSERIAL, user_id, action, target, payload, created_at
--    New columns (all nullable so legacy rows keep working):
-- ─────────────────────────────────────────────
ALTER TABLE activity_log
  ADD COLUMN IF NOT EXISTS pillar                 TEXT CHECK (pillar IN ('onboarding','radar','resume','content','profile','wallet','dashboard','system')),
  ADD COLUMN IF NOT EXISTS related_resource_type  TEXT,
  ADD COLUMN IF NOT EXISTS related_resource_id    UUID,
  ADD COLUMN IF NOT EXISTS tokens_charged         INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS language               TEXT CHECK (language IN ('ar','en'));

CREATE INDEX IF NOT EXISTS idx_activity_log_pillar
  ON activity_log(user_id, pillar, created_at DESC);

-- ─────────────────────────────────────────────
-- 2. Extend the existing ai_suggestions (Sprint 1) with dashboard columns
--    Existing: id, user_id, headline, rationale, cta_url, score 1-10,
--              language, dismissed, actioned, computed_for_date, created_at.
--    New (all nullable / defaulted):
-- ─────────────────────────────────────────────
ALTER TABLE ai_suggestions
  ADD COLUMN IF NOT EXISTS suggestion_type   TEXT DEFAULT 'next_task' CHECK (suggestion_type IN ('next_task','quick_win','reminder','opportunity')),
  ADD COLUMN IF NOT EXISTS pillar            TEXT CHECK (pillar IN ('radar','resume','content','profile','wallet')),
  ADD COLUMN IF NOT EXISTS cta_label         TEXT,
  ADD COLUMN IF NOT EXISTS cta_payload       JSONB,
  ADD COLUMN IF NOT EXISTS priority_score    NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS status            TEXT DEFAULT 'active' CHECK (status IN ('active','dismissed','acted_upon','expired')),
  ADD COLUMN IF NOT EXISTS expires_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS acted_upon_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dismissed_at      TIMESTAMPTZ;

-- Backfill `status` for the legacy boolean flags so the query model is unified
UPDATE ai_suggestions
  SET status = CASE
    WHEN dismissed THEN 'dismissed'
    WHEN actioned THEN 'acted_upon'
    ELSE 'active'
  END
  WHERE status IS NULL OR status = 'active' AND (dismissed OR actioned);

-- Default expires_at = created_at + 7 days for any rows that don't have one
UPDATE ai_suggestions
  SET expires_at = created_at + INTERVAL '7 days'
  WHERE expires_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_suggestions_active
  ON ai_suggestions(user_id, status, priority_score DESC NULLS LAST)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_suggestions_expiry
  ON ai_suggestions(expires_at)
  WHERE status = 'active';

-- ─────────────────────────────────────────────
-- 3. career_pulse_snapshots — daily KPI aggregates for trend lines
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS career_pulse_snapshots (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot_date            DATE NOT NULL,
  radar_score              INTEGER,
  resume_count             INTEGER,
  active_resume_ats_score  INTEGER,
  content_count_30d        INTEGER,
  wallet_total             INTEGER,
  wallet_bonus             INTEGER,
  wallet_subscription      INTEGER,
  wallet_topup             INTEGER,
  bonus_expires_at         TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_pulse_user_date
  ON career_pulse_snapshots(user_id, snapshot_date DESC);

ALTER TABLE career_pulse_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pulse_own_read ON career_pulse_snapshots;
CREATE POLICY pulse_own_read ON career_pulse_snapshots FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS pulse_admin_all ON career_pulse_snapshots;
CREATE POLICY pulse_admin_all ON career_pulse_snapshots FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));

-- ─────────────────────────────────────────────
-- 4. wallet_suffices_for_cache — Suffices-For widget cache
--    One row per user; recomputed when wallet balance changes
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wallet_suffices_for_cache (
  user_id        UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_total   INTEGER NOT NULL,
  suffices_for   JSONB NOT NULL,
  computed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE wallet_suffices_for_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS suffices_own_read ON wallet_suffices_for_cache;
CREATE POLICY suffices_own_read ON wallet_suffices_for_cache FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS suffices_admin_all ON wallet_suffices_for_cache;
CREATE POLICY suffices_admin_all ON wallet_suffices_for_cache FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));

-- ─────────────────────────────────────────────
-- 5. profiles — dashboard streak / last-visit columns
-- ─────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_dashboard_visit   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dashboard_streak_days  INTEGER DEFAULT 0;

-- ─────────────────────────────────────────────
-- 6. Backfill activity_log from existing v2 history (idempotent)
--    Maps:
--      radar_analyses    → 'radar.completed' / 'radar.cache_hit'
--      resume_versions   → 'resume.built' / 'resume.legacy_imported'
--      content_versions  → 'content.<type>.created' / 'content.legacy_imported'
--    Skips rows already present (joined by related_resource_type+id).
-- ─────────────────────────────────────────────

-- Radar: every analysis
INSERT INTO activity_log (user_id, action, pillar, payload, related_resource_type, related_resource_id, tokens_charged, language, created_at)
SELECT
  ra.user_id,
  CASE WHEN ra.is_cache_hit THEN 'radar.cache_hit' ELSE 'radar.completed' END,
  'radar',
  jsonb_build_object(
    'target_role', ra.target_role,
    'current_score', ra.current_score,
    'target_score', ra.target_score,
    'wallet_used', ra.wallet_used
  ),
  'radar_analyses',
  ra.id,
  ra.tokens_charged,
  ra.language,
  ra.created_at
FROM radar_analyses ra
WHERE NOT EXISTS (
  SELECT 1 FROM activity_log al
   WHERE al.related_resource_type = 'radar_analyses'
     AND al.related_resource_id = ra.id
);

-- Resume: every version
INSERT INTO activity_log (user_id, action, pillar, payload, related_resource_type, related_resource_id, tokens_charged, language, created_at)
SELECT
  rv.user_id,
  CASE WHEN rv.status = 'legacy' THEN 'resume.legacy_imported' ELSE 'resume.built' END,
  'resume',
  jsonb_build_object(
    'target_role', rv.target_role,
    'template_id', rv.template_id,
    'ats_score', rv.ats_score,
    'display_name', rv.display_name
  ),
  'resume_versions',
  rv.id,
  rv.tokens_charged,
  rv.language,
  rv.created_at
FROM resume_versions rv
WHERE NOT EXISTS (
  SELECT 1 FROM activity_log al
   WHERE al.related_resource_type = 'resume_versions'
     AND al.related_resource_id = rv.id
);

-- Content: every version
INSERT INTO activity_log (user_id, action, pillar, payload, related_resource_type, related_resource_id, tokens_charged, language, created_at)
SELECT
  cv.user_id,
  CASE
    WHEN cv.status = 'legacy' THEN 'content.legacy_imported'
    ELSE 'content.' || cv.content_type || '.created'
  END,
  'content',
  jsonb_build_object(
    'content_type', cv.content_type,
    'topic', cv.topic,
    'display_title', cv.display_title
  ),
  'content_versions',
  cv.id,
  cv.tokens_charged,
  cv.language,
  cv.created_at
FROM content_versions cv
WHERE NOT EXISTS (
  SELECT 1 FROM activity_log al
   WHERE al.related_resource_type = 'content_versions'
     AND al.related_resource_id = cv.id
);

COMMIT;
