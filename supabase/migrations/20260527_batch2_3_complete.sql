-- ════════════════════════════════════════════════════════════════════
-- BATCH 2+3 COMBINED — Al-Mukhadram + Hassan + Fatima + Dhai + Hussein
--                      + Mohammed + ZATCA + Compliance + Health + Crons
-- 18 new tables + RLS + seed default email sequences + settings backfill.
-- ════════════════════════════════════════════════════════════════════

-- =====================================================================
-- AL-MUKHADRAM (Customer Success) — channels + sequences + health
-- =====================================================================

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  agent_id TEXT REFERENCES agents(id),
  task_id UUID REFERENCES agent_tasks(id) ON DELETE SET NULL,
  direction TEXT NOT NULL CHECK (direction IN ('outbound','inbound')),
  to_phone TEXT NOT NULL,
  from_phone TEXT,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text','template','image','document','interactive')),
  language TEXT CHECK (language IN ('ar','en')),
  template_name TEXT,
  body TEXT NOT NULL,
  whatsapp_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','delivered','read','failed')),
  error_message TEXT,
  raw_payload JSONB,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_whatsapp_user ON whatsapp_messages(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_status ON whatsapp_messages(status, created_at DESC);

CREATE TABLE IF NOT EXISTS email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  agent_id TEXT REFERENCES agents(id),
  task_id UUID REFERENCES agent_tasks(id) ON DELETE SET NULL,
  to_email TEXT NOT NULL,
  from_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  language TEXT CHECK (language IN ('ar','en')),
  sequence_name TEXT,
  sequence_step INT,
  resend_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','delivered','opened','clicked','bounced','failed')),
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_email_user ON email_messages(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_sequence ON email_messages(user_id, sequence_name, sequence_step);

CREATE TABLE IF NOT EXISTS email_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  trigger_event TEXT NOT NULL,
  steps JSONB NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_sequence_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sequence_id UUID NOT NULL REFERENCES email_sequences(id),
  current_step INT DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','paused','exited')),
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  last_sent_at TIMESTAMPTZ,
  next_send_at TIMESTAMPTZ,
  exit_reason TEXT,
  UNIQUE(user_id, sequence_id)
);
CREATE INDEX IF NOT EXISTS idx_enrollment_next_send ON user_sequence_enrollments(next_send_at) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS user_health_scores (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  score INT NOT NULL CHECK (score BETWEEN 0 AND 100),
  segment TEXT NOT NULL CHECK (segment IN ('hot_lead','warm_lead','active','at_risk','dormant','churned','vip')),
  upgrade_propensity NUMERIC(3,2) CHECK (upgrade_propensity BETWEEN 0 AND 1),
  churn_risk NUMERIC(3,2) CHECK (churn_risk BETWEEN 0 AND 1),
  signals JSONB,
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  next_recompute_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_health_segment ON user_health_scores(segment);
CREATE INDEX IF NOT EXISTS idx_health_propensity ON user_health_scores(upgrade_propensity DESC) WHERE upgrade_propensity > 0.5;

-- =====================================================================
-- HASSAN (Revenue Lab) — experiments + pitches + referrals
-- =====================================================================

CREATE TABLE IF NOT EXISTS ab_experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT REFERENCES agents(id),
  name TEXT UNIQUE NOT NULL,
  hypothesis TEXT NOT NULL,
  surface TEXT NOT NULL,
  variants JSONB NOT NULL,
  traffic_allocation JSONB,
  primary_metric TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','awaiting_approval','running','paused','completed','killed')),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  winner_variant TEXT,
  results JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ab_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID NOT NULL REFERENCES ab_experiments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  variant TEXT NOT NULL,
  exposed_at TIMESTAMPTZ DEFAULT NOW(),
  converted BOOLEAN DEFAULT FALSE,
  converted_at TIMESTAMPTZ,
  conversion_value_sar NUMERIC(10,2),
  UNIQUE(experiment_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_ab_user ON ab_assignments(user_id);

CREATE TABLE IF NOT EXISTS upgrade_pitches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  task_id UUID REFERENCES agent_tasks(id) ON DELETE SET NULL,
  trigger TEXT NOT NULL,
  surface TEXT NOT NULL,
  experiment_id UUID REFERENCES ab_experiments(id),
  variant TEXT,
  headline_ar TEXT NOT NULL,
  headline_en TEXT NOT NULL,
  body_ar TEXT NOT NULL,
  body_en TEXT NOT NULL,
  cta_label_ar TEXT,
  cta_label_en TEXT,
  cta_url TEXT,
  recommended_plan TEXT,
  recommended_token_pack TEXT,
  status TEXT NOT NULL DEFAULT 'pending_approval' CHECK (status IN ('pending_approval','approved','rejected','served','clicked','converted','expired')),
  served_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,
  conversion_value_sar NUMERIC(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pitches_user_status ON upgrade_pitches(user_id, status);
CREATE INDEX IF NOT EXISTS idx_pitches_pending ON upgrade_pitches(status, created_at DESC) WHERE status = 'pending_approval';

CREATE TABLE IF NOT EXISTS referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  code TEXT UNIQUE NOT NULL,
  reward_tokens_inviter INT DEFAULT 100,
  reward_tokens_invitee INT DEFAULT 100,
  uses_count INT DEFAULT 0,
  max_uses INT,
  expires_at TIMESTAMPTZ,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_referral_owner ON referral_codes(owner_user_id);

CREATE TABLE IF NOT EXISTS referral_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id UUID NOT NULL REFERENCES referral_codes(id),
  invitee_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  inviter_rewarded BOOLEAN DEFAULT FALSE,
  invitee_rewarded BOOLEAN DEFAULT FALSE,
  redeemed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(invitee_user_id)
);

-- =====================================================================
-- FATIMA (Product Intel) — friction + reports + events
-- =====================================================================

CREATE TABLE IF NOT EXISTS friction_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_key TEXT UNIQUE NOT NULL,
  feature TEXT NOT NULL,
  step TEXT,
  description_ar TEXT NOT NULL,
  description_en TEXT NOT NULL,
  affected_users INT DEFAULT 0,
  total_observations INT DEFAULT 0,
  severity TEXT CHECK (severity IN ('low','medium','high','critical')),
  fatima_recommendation_ar TEXT,
  fatima_recommendation_en TEXT,
  status TEXT NOT NULL DEFAULT 'observed' CHECK (status IN ('observed','acknowledged','planned','shipped','dismissed')),
  first_seen TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_friction_severity ON friction_patterns(severity, last_seen DESC);

CREATE TABLE IF NOT EXISTS weekly_intel_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start DATE NOT NULL UNIQUE,
  summary_ar TEXT NOT NULL,
  summary_en TEXT NOT NULL,
  top_friction_patterns JSONB,
  top_dropoff_points JSONB,
  top_user_quotes JSONB,
  recommendations JSONB,
  metrics JSONB,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS analytics_events (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  distinct_id TEXT,
  event TEXT NOT NULL,
  properties JSONB,
  page_url TEXT,
  session_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_events_user ON analytics_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_name ON analytics_events(event, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_session ON analytics_events(session_id, created_at);

-- =====================================================================
-- DHAI (Compliance & Fraud) — signals + moderation + PDPL
-- =====================================================================

CREATE TABLE IF NOT EXISTS fraud_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  signal_type TEXT NOT NULL CHECK (signal_type IN (
    'duplicate_card','vpn_signup','bot_pattern','multiple_accounts_same_ip',
    'rapid_token_burn','suspicious_email_domain','chargeback','linkedin_url_invalid',
    'profile_data_mismatch','rate_limit_abuse','test_email_pattern'
  )),
  severity TEXT NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  details JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','investigating','confirmed_fraud','false_positive','resolved')),
  auto_action_taken TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fraud_user ON fraud_signals(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fraud_open ON fraud_signals(status, severity, created_at DESC) WHERE status IN ('open','investigating');

CREATE TABLE IF NOT EXISTS content_moderation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('social_post','ad_creative','blog_post','user_generated','email')),
  source_agent TEXT REFERENCES agents(id),
  scanned_text TEXT NOT NULL,
  language TEXT,
  flags JSONB,
  violations JSONB,
  decision TEXT NOT NULL CHECK (decision IN ('approved','flagged','blocked')),
  linkedin_tos_check JSONB,
  reasoning TEXT,
  reviewed_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_moderation_blocked ON content_moderation_log(decision, created_at DESC) WHERE decision IN ('flagged','blocked');

CREATE TABLE IF NOT EXISTS pdpl_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (event_type IN ('data_access','data_export','data_deletion','consent_given','consent_revoked','third_party_share','retention_review')),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  data_category TEXT,
  details JSONB,
  performed_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pdpl_user ON pdpl_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pdpl_type ON pdpl_log(event_type, created_at DESC);

-- =====================================================================
-- MOHAMMED (Finance — ZATCA + snapshots)
-- =====================================================================

CREATE TABLE IF NOT EXISTS zatca_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  payment_transaction_id UUID REFERENCES payment_transactions(id) ON DELETE SET NULL,
  subtotal_sar NUMERIC(10,2) NOT NULL,
  vat_rate NUMERIC(4,2) NOT NULL DEFAULT 15.00,
  vat_amount_sar NUMERIC(10,2) NOT NULL,
  total_sar NUMERIC(10,2) NOT NULL,
  buyer_name TEXT,
  buyer_vat_number TEXT,
  buyer_address TEXT,
  seller_vat_number TEXT NOT NULL DEFAULT '300000000000003',
  seller_commercial_registration TEXT NOT NULL DEFAULT '7052843203',
  issue_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  zatca_qr_payload TEXT,
  zatca_uuid TEXT,
  zatca_hash TEXT,
  pdf_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','issued','sent','paid','refunded','cancelled')),
  language TEXT NOT NULL DEFAULT 'ar',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_zatca_user ON zatca_invoices(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_zatca_status ON zatca_invoices(status, issue_date DESC);

CREATE TABLE IF NOT EXISTS finance_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE NOT NULL UNIQUE,
  mrr_sar NUMERIC(10,2),
  arr_sar NUMERIC(10,2),
  active_subscribers INT,
  new_signups_24h INT,
  paid_conversions_24h INT,
  ad_spend_24h_sar NUMERIC(10,2),
  anthropic_cost_24h_sar NUMERIC(10,2),
  apify_cost_24h_sar NUMERIC(10,2),
  infra_cost_24h_sar NUMERIC(10,2),
  cac_24h_sar NUMERIC(10,2),
  ltv_estimate_sar NUMERIC(10,2),
  cash_on_hand_sar NUMERIC(10,2),
  runway_days INT,
  margin_percent NUMERIC(5,2),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Backfill default cost settings if missing (idempotent)
INSERT INTO system_settings (key, value, description)
VALUES ('apify_monthly_cost_usd', '49'::jsonb, 'Manual: Apify monthly subscription cost in USD')
ON CONFLICT (key) DO NOTHING;

INSERT INTO system_settings (key, value, description)
VALUES ('infra_monthly_cost_usd', '20'::jsonb, 'Manual: combined Supabase+Vercel infra cost in USD')
ON CONFLICT (key) DO NOTHING;

INSERT INTO system_settings (key, value, description)
VALUES ('usd_sar_rate', '3.75'::jsonb, 'Manual: USD→SAR conversion rate')
ON CONFLICT (key) DO NOTHING;

INSERT INTO system_settings (key, value, description)
VALUES ('cash_on_hand_sar', '0'::jsonb, 'Manual: current cash balance in SAR')
ON CONFLICT (key) DO NOTHING;

-- =====================================================================
-- HUSSEIN (Operations) — known error patterns
-- =====================================================================

CREATE TABLE IF NOT EXISTS known_error_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_key TEXT UNIQUE NOT NULL,
  service TEXT NOT NULL,
  error_signature TEXT NOT NULL,
  description TEXT,
  auto_resolution TEXT,
  resolution_steps JSONB,
  occurrences_count INT DEFAULT 0,
  first_seen TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

-- =====================================================================
-- RLS — admins-all on operational tables, user-read-own where applicable
-- =====================================================================
ALTER TABLE whatsapp_messages              ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_messages                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_sequences                ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sequence_enrollments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_health_scores             ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab_experiments                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab_assignments                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE upgrade_pitches                ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_codes                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_redemptions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE friction_patterns              ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_intel_reports           ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events               ENABLE ROW LEVEL SECURITY;
ALTER TABLE fraud_signals                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_moderation_log         ENABLE ROW LEVEL SECURITY;
ALTER TABLE pdpl_log                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE zatca_invoices                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_snapshots              ENABLE ROW LEVEL SECURITY;
ALTER TABLE known_error_patterns           ENABLE ROW LEVEL SECURITY;

-- Drop+create admin policies idempotently
DO $$
DECLARE
  tbl TEXT;
  policy_name TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'whatsapp_messages','email_messages','email_sequences','user_sequence_enrollments',
    'ab_experiments','friction_patterns','weekly_intel_reports','analytics_events',
    'fraud_signals','content_moderation_log','pdpl_log','finance_snapshots','known_error_patterns'
  ])
  LOOP
    policy_name := 'admins_all_' || tbl;
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', policy_name, tbl);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL '
      'USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE))',
      policy_name, tbl);
  END LOOP;
END $$;

-- User read-own policies (the 5 user-scoped tables)
DROP POLICY IF EXISTS users_read_own_health      ON user_health_scores;
CREATE POLICY users_read_own_health     ON user_health_scores FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS users_read_own_assignments ON ab_assignments;
CREATE POLICY users_read_own_assignments ON ab_assignments    FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS users_read_own_pitches     ON upgrade_pitches;
CREATE POLICY users_read_own_pitches    ON upgrade_pitches    FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS users_read_own_codes       ON referral_codes;
CREATE POLICY users_read_own_codes      ON referral_codes     FOR SELECT USING (owner_user_id = auth.uid());

DROP POLICY IF EXISTS users_read_own_invoices    ON zatca_invoices;
CREATE POLICY users_read_own_invoices   ON zatca_invoices     FOR SELECT USING (user_id = auth.uid());

-- Admin-all on the user-readable tables (separate policy because user policies are SELECT-only)
DROP POLICY IF EXISTS admins_all_health       ON user_health_scores;
CREATE POLICY admins_all_health      ON user_health_scores  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));

DROP POLICY IF EXISTS admins_all_assignments  ON ab_assignments;
CREATE POLICY admins_all_assignments ON ab_assignments     FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));

DROP POLICY IF EXISTS admins_all_pitches      ON upgrade_pitches;
CREATE POLICY admins_all_pitches     ON upgrade_pitches     FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));

DROP POLICY IF EXISTS admins_all_codes        ON referral_codes;
CREATE POLICY admins_all_codes       ON referral_codes      FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));

DROP POLICY IF EXISTS admins_all_invoices     ON zatca_invoices;
CREATE POLICY admins_all_invoices    ON zatca_invoices      FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));

DROP POLICY IF EXISTS admins_all_redemptions  ON referral_redemptions;
CREATE POLICY admins_all_redemptions ON referral_redemptions FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));

-- =====================================================================
-- Seed default email sequences (idempotent)
-- =====================================================================
INSERT INTO email_sequences (name, description, trigger_event, steps) VALUES
  ('welcome_7day', 'Bilingual 7-day onboarding flow', 'signup',
   '[
     {"day":0,"placeholder":true,"note":"Al-Mukhadram drafts when first user signs up"},
     {"day":1,"placeholder":true},
     {"day":3,"placeholder":true},
     {"day":7,"placeholder":true}
   ]'::jsonb),
  ('free_trial_consumed', 'User used their free tokens', 'free_tokens_exhausted', '[]'::jsonb),
  ('dormant_14day', 'No activity for 14 days', 'no_activity_14d', '[]'::jsonb)
ON CONFLICT (name) DO NOTHING;
