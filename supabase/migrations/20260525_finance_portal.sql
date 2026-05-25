-- ═══════════════════════════════════════════
-- Finance Portal — schema + seed
-- ═══════════════════════════════════════════
-- 1) Add `feature` column to token_transactions so we can attribute burn to
--    a feature (linkedin / cv / campaign / other / admin) for the finance
--    cost-control dashboard.
ALTER TABLE token_transactions
  ADD COLUMN IF NOT EXISTS feature TEXT;

CREATE INDEX IF NOT EXISTS idx_token_transactions_feature
  ON token_transactions (feature);

-- 2) Seed system_settings rows used by the finance portal so first-load
--    queries don't return null. ON CONFLICT keeps any value Ali has already
--    set manually via the portal's edit pencil.
INSERT INTO system_settings (key, value, description)
VALUES
  ('cash_on_hand_sar',        '0',     'Manual: current cash balance in SAR'),
  ('usd_sar_rate',            '3.75',  'Manual: USD→SAR conversion rate'),
  ('apify_monthly_cost_usd',  '49',    'Manual: Apify monthly subscription cost in USD'),
  ('infra_monthly_cost_usd',  '20',    'Manual: combined Supabase+Vercel infra cost in USD')
ON CONFLICT (key) DO NOTHING;
