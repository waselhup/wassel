-- ═══════════════════════════════════════════
-- Resume v2 — M3 "Outputs": keep ONLY Harvard + MIT (real divergent renderers)
-- ═══════════════════════════════════════════
-- Author:  Career Copilot session (feat/m3-outputs)
-- Date:    2026-05-31
-- Scope:   M3 keeps two REAL templates with genuinely different renderers:
--            - harvard_classic → layout_type 'classic'  (mgmt/consulting/general)
--            - mit_technical   → layout_type 'modern'   (tech/eng/data)
--          Saudi Executive + Modern Minimal were visually fake (all 4 shared
--          one renderer). We DEACTIVATE them (is_active = false) rather than
--          DELETE — Archive First. Safe: verified 0 resume_versions and 0
--          resume_cache rows reference either id at apply time, so no user
--          output points at a removed template.
--
-- Also sets industry_boost so recommendTemplate routes tech roles → MIT and
-- everything else → Harvard, and its reasons[] read sensibly.
--
-- Idempotent. Non-destructive (deactivate, not delete; remap is a safety net).

BEGIN;

-- 1. Deactivate the two retired templates (kept for history, hidden from picker
--    via the is_active = TRUE RLS read policy + loadTemplates filter).
UPDATE resume_templates SET is_active = FALSE
  WHERE id IN ('saudi_executive', 'modern_minimal');

-- 2. Safety net: if any version/cache somehow still points at a retired
--    template, remap it to the closest kept one so nothing renders blank.
--    (Verified empty at apply time; this just guarantees forward-safety.)
UPDATE resume_versions SET template_id = 'harvard_classic'
  WHERE template_id IN ('saudi_executive', 'modern_minimal');
UPDATE resume_cache SET template_id = 'harvard_classic'
  WHERE template_id IN ('saudi_executive', 'modern_minimal');

-- 3. Make the two survivors' routing explicit so recommendTemplate's reasons[]
--    are meaningful: MIT boosts on tech/eng/data; Harvard stays general
--    (no boost → wins on level/region fit for mgmt/consulting/general).
UPDATE resume_templates
  SET industry_boost = ARRAY['tech','technology','software','engineering','data','it','developer']::TEXT[]
  WHERE id = 'mit_technical';
UPDATE resume_templates
  SET industry_boost = NULL
  WHERE id = 'harvard_classic';

COMMIT;
