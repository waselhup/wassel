-- ═══════════════════════════════════════════
-- Resume v2 — M3 "Outputs": free ATS diagnostic cache
-- ═══════════════════════════════════════════
-- Author:  Career Copilot session (feat/m3-outputs)
-- Date:    2026-05-31
-- Scope:   Adds resume_diagnostics — a tiny free-lifetime cache for the
--          0-token ATS diagnostic (mirrors the radar free-diagnostic pattern).
--          The diagnostic gives the user a full 4-component ATS read +
--          current→expected projection + internal target benchmark at 0 tokens;
--          the paid 179-token tailored build remains the locked output.
--
-- Non-destructive: a brand-new table only. No existing table touched.
-- Token invariant: every row is tokens_charged = 0 (no model spend on this
--   path), so there is no refund path and no abuse surface.

BEGIN;

CREATE TABLE IF NOT EXISTS resume_diagnostics (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source           TEXT NOT NULL CHECK (source IN ('linkedin','upload')),
  source_hash      TEXT NOT NULL,
  target_role      TEXT NOT NULL,
  language         TEXT NOT NULL CHECK (language IN ('ar','en')),
  ats_score        INTEGER NOT NULL CHECK (ats_score BETWEEN 0 AND 100),
  expected_score   INTEGER NOT NULL CHECK (expected_score BETWEEN 0 AND 100),
  ats_breakdown    JSONB NOT NULL,
  benchmark        JSONB NOT NULL,
  tokens_charged   INTEGER NOT NULL DEFAULT 0 CHECK (tokens_charged >= 0),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Dedup key: same source for the same role = the same free diagnostic.
  UNIQUE (user_id, target_role, source, source_hash)
);

CREATE INDEX IF NOT EXISTS idx_resume_diagnostics_user_recent
  ON resume_diagnostics(user_id, created_at DESC);

ALTER TABLE resume_diagnostics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS resume_diagnostics_own_read ON resume_diagnostics;
CREATE POLICY resume_diagnostics_own_read ON resume_diagnostics FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS resume_diagnostics_own_write ON resume_diagnostics;
CREATE POLICY resume_diagnostics_own_write ON resume_diagnostics FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS resume_diagnostics_admin_all ON resume_diagnostics;
CREATE POLICY resume_diagnostics_admin_all ON resume_diagnostics FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));

COMMIT;
