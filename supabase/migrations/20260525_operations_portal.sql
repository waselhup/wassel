-- ═══════════════════════════════════════════
-- Operations Portal — schema + RLS + signup event trigger
--
-- NOTES on what's NOT in this migration:
-- - payment_transactions already exists (created earlier; see 001_initial-era
--   schema). We do NOT recreate it here.
-- - api_logs already exists.
-- - user_subscriptions already exists for Moyasar fulfillment. The new
--   `subscriptions` table below is a denormalised view-of-truth optimized
--   for the Operations watchtower; backfill script populates it from
--   profiles + user_subscriptions.
-- ═══════════════════════════════════════════

-- Subscriptions watchtower table
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan TEXT NOT NULL CHECK (plan IN ('free','starter','pro','elite')),
  status TEXT NOT NULL CHECK (status IN ('active','trialing','past_due','canceled','expired')),
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMPTZ NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  canceled_at TIMESTAMPTZ,
  moyasar_subscription_id TEXT,
  monthly_amount_sar NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_expiring ON subscriptions(current_period_end) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status, updated_at DESC);

-- Signup funnel events
CREATE TABLE IF NOT EXISTS signup_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  email TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('signup_started','email_verified','profile_completed','onboarding_started','onboarding_step','onboarding_completed','first_action','abandoned')),
  step_name TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_signup_events_user ON signup_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_signup_events_recent ON signup_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_signup_events_type ON signup_events(event_type, created_at DESC);

-- Incidents log
CREATE TABLE IF NOT EXISTS incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  severity TEXT NOT NULL CHECK (severity IN ('info','warning','error','critical')),
  source TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  affected_service TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','investigating','resolved','dismissed')),
  acknowledged_by TEXT,
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_incidents_open ON incidents(severity, created_at DESC) WHERE status IN ('open','investigating');
CREATE INDEX IF NOT EXISTS idx_incidents_recent ON incidents(created_at DESC);

-- Maintenance mode setting (idempotent)
INSERT INTO system_settings (key, value, description)
VALUES (
  'maintenance_mode',
  jsonb_build_object('enabled', false, 'message_ar', '', 'message_en', ''),
  'Operations portal: maintenance-mode toggle + banner copy'
)
ON CONFLICT (key) DO NOTHING;

-- RLS — admins only (use is_admin profile column)
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE signup_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own subscriptions" ON subscriptions;
CREATE POLICY "users read own subscriptions" ON subscriptions FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "admins all subscriptions" ON subscriptions;
CREATE POLICY "admins all subscriptions" ON subscriptions FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));

DROP POLICY IF EXISTS "admins read signup_events" ON signup_events;
CREATE POLICY "admins read signup_events" ON signup_events FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));

DROP POLICY IF EXISTS "admins all incidents" ON incidents;
CREATE POLICY "admins all incidents" ON incidents FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));

-- Trigger — log signup_started on every new auth.users row
CREATE OR REPLACE FUNCTION log_signup_event() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO signup_events (user_id, email, event_type, metadata)
  VALUES (
    NEW.id,
    NEW.email,
    'signup_started',
    jsonb_build_object('provider', NEW.raw_app_meta_data->>'provider')
  );
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- never block signup if logging fails
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_signup_event ON auth.users;
CREATE TRIGGER on_auth_user_signup_event
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION log_signup_event();
