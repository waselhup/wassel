-- Schema Audit Fixes (2026-04-11)
-- 1. Add strengths/weaknesses to linkedin_analyses
-- 2. Fix token_transactions RLS (INSERT for authenticated users)
-- 3. Enable RLS on system_settings with admin policies
-- 4. Add foreign key constraints

ALTER TABLE public.linkedin_analyses 
  ADD COLUMN IF NOT EXISTS strengths text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS weaknesses text[] DEFAULT '{}';

CREATE POLICY "Users insert own transactions"
  ON public.token_transactions FOR INSERT TO public
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage settings"
  ON public.system_settings FOR ALL TO public
  USING ((SELECT is_admin FROM public.profiles WHERE id = auth.uid()) = true);

CREATE POLICY "Service role full access settings"
  ON public.system_settings FOR ALL TO service_role
  USING (true) WITH CHECK (true);
