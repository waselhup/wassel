-- ═══════════════════════════════════════════
-- Radar M2 — free diagnostic / locked fixes
-- ═══════════════════════════════════════════
-- Author:  M2 Explanation session (feat/m2-explanation)
-- Date:    2026-06-01 (target apply date — pending Ali's go-ahead)
-- Scope:   Adds radar_cache.fixes_unlocked so the radar diagnostic can be FREE
--          while the ready-made fixes (included_fixes[].suggestion/.rationale)
--          stay LOCKED until the user spends 149 tokens (radar.unlockFixes).
--
-- Pricing inversion (Ali's decision):
--   - BEFORE: radar.run charged 149 → diagnosis + fixes together; apply was free.
--   - AFTER:  radar.run is FREE (tokens_charged stays 0). The diagnostic — scores,
--             8 per-dimension cards, gaps, recommendations — is returned in full.
--             The ready-made fix REWRITES are stripped from the response until
--             radar.unlockFixes deducts 149 and flips fixes_unlocked = true.
--
-- Single source of truth: after this migration every code path checks this
-- column ONLY. The backfill below grandfathers every pre-M2 paid analysis
-- (tokens_charged > 0 means the user already bought its fixes), so existing
-- results keep their unlocked fixes with no user action.

BEGIN;

ALTER TABLE radar_cache
  ADD COLUMN IF NOT EXISTS fixes_unlocked BOOLEAN NOT NULL DEFAULT false;

-- Grandfather: every pre-M2 paid analysis (149 charged) already bought its fixes.
UPDATE radar_cache SET fixes_unlocked = true WHERE tokens_charged > 0;

COMMIT;
