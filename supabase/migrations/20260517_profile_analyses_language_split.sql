-- Asymmetric language model for LinkedIn Radar.
-- report_language is what the user picks; suggestion_language is derived:
--   reportLang=en -> en; reportLang=ar -> profileLang (detected from text).
-- profile_language records what the detector saw so we can audit drift.
ALTER TABLE public.profile_analyses
  ADD COLUMN IF NOT EXISTS suggestion_language TEXT,
  ADD COLUMN IF NOT EXISTS profile_language    TEXT;

COMMENT ON COLUMN public.profile_analyses.report_language IS
  'Language for ALL explanations (commentary, scoring rationale, action items). User-picked.';
COMMENT ON COLUMN public.profile_analyses.suggestion_language IS
  'Language of sections[].suggested copy. Asymmetric: when report_language=ar -> profile_language; when report_language=en -> en.';
COMMENT ON COLUMN public.profile_analyses.profile_language IS
  'Auto-detected language of the user''s LinkedIn profile text (headline + summary). ar or en.';
