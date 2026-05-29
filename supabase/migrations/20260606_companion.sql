-- ═══════════════════════════════════════════
-- Career Companion — المساعد المهني (Phase 1: post-login)
-- ═══════════════════════════════════════════
-- Author:  Career Companion session (feat/career-companion)
-- Date:    2026-06-06 (target apply date — pending Ali's go-ahead, STOP #2)
-- Scope:   Two new tables for the in-app companion:
--            1. companion_state   — one row per user. Holds the welcome/tour
--               lifecycle flags + the cached (free, Haiku) welcome line +
--               a lightweight visit counter (adaptation seed).
--            2. companion_signals — append-only behavioural signals (last page,
--               last action). STORAGE ONLY — zero analysis this sprint.
--
-- Reads from: auth.users, profiles (admin check only).
-- DOES NOT touch: any existing table, RPC, policy, or column. Purely additive.
--
-- Idempotent — every CREATE/ALTER uses IF NOT EXISTS; every policy is
-- DROP POLICY IF EXISTS ... then CREATE. Safe to re-run.
--
-- RLS model mirrors the house pattern:
--   *_own_read  (SELECT, auth.uid() = user_id)
--   *_own_write (ALL,    auth.uid() = user_id, WITH CHECK auth.uid() = user_id)
--   *_admin_all (ALL,    profiles.is_admin) — support/ops visibility
-- The user reads + writes only their own rows (career_profile pattern).

BEGIN;

-- ─────────────────────────────────────────────
-- 1. companion_state — 1 row per user (companion lifecycle + adaptation seed)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS companion_state (
  user_id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Welcome moment: NULL until the user has seen it once. Persisted so it
  -- never replays on subsequent dashboard loads.
  welcomed_at           TIMESTAMPTZ,
  -- Guided tour (coachmarks): NULL until completed OR dismissed. Either way it
  -- ends forever once set (the user is never nagged again).
  tour_done_at          TIMESTAMPTZ,
  -- The one smart welcome line (generated once, free, via Haiku). Cached so we
  -- don't regenerate on every load. NULL = template-only welcome was shown.
  welcome_message       TEXT,
  -- Language the cached welcome_message was written in. If the user later
  -- switches ar<->en, the engine regenerates in the new language (same lesson
  -- as the Part A getNextTask language fix).
  welcome_message_lang  TEXT CHECK (welcome_message_lang IN ('ar','en')),
  -- Lightweight visit counter — part of the adaptation seed ("عدد الزيارات").
  -- Storage only; no analysis this sprint.
  visit_count           INTEGER NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE companion_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS companion_state_own_read ON companion_state;
CREATE POLICY companion_state_own_read ON companion_state FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS companion_state_own_write ON companion_state;
CREATE POLICY companion_state_own_write ON companion_state FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS companion_state_admin_all ON companion_state;
CREATE POLICY companion_state_admin_all ON companion_state FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));

-- ─────────────────────────────────────────────
-- 2. companion_signals — append-only behavioural signals (adaptation seed)
--    "آخر صفحة، آخر إجراء" live here as the most-recent rows per user.
--    STORAGE ONLY. Nothing reads these for decisions this sprint.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS companion_signals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- What kind of signal this is. Constrained so the seed stays tidy.
  signal_type   TEXT NOT NULL CHECK (signal_type IN ('page_view','action','visit')),
  -- The route the user was on (e.g. '/v2/posts'). NULL for non-navigation signals.
  route         TEXT,
  -- Free-form context for the future (e.g. which CTA, which pillar). Never PII.
  payload       JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Most-recent-per-user lookups (when the next sprint starts reading the seed).
CREATE INDEX IF NOT EXISTS idx_companion_signals_user_recent
  ON companion_signals(user_id, created_at DESC);

ALTER TABLE companion_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS companion_signals_own_read ON companion_signals;
CREATE POLICY companion_signals_own_read ON companion_signals FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS companion_signals_own_write ON companion_signals;
CREATE POLICY companion_signals_own_write ON companion_signals FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS companion_signals_admin_all ON companion_signals;
CREATE POLICY companion_signals_admin_all ON companion_signals FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));

COMMIT;
