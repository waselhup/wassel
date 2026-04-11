-- AI Cache table for 24h caching of Claude/Haiku responses
CREATE TABLE IF NOT EXISTS public.ai_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text NOT NULL UNIQUE,
  result jsonb NOT NULL,
  model text NOT NULL,
  tokens_used integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_cache_key ON public.ai_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_ai_cache_expires ON public.ai_cache(expires_at);

ALTER TABLE public.ai_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages cache" ON public.ai_cache FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users read cache" ON public.ai_cache FOR SELECT TO public USING (true);
