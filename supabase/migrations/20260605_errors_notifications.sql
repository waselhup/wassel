-- ============================================================
-- ERRORS + NOTIFICATIONS — Sprint 8
--
-- Adds:
--   1. notifications              (in-app + email queue)
--   2. notification_preferences   (per user)
--   3. notification_frequency_log (frequency-cap tracking)
--   4. error_events               (analytics + AI formatter feedback)
--   + enqueue_notification(...) RPC with frequency caps
--   + RLS policies
--   + Backfill notification_preferences for existing profiles
-- ============================================================

-- 1. Notifications table (in-app + email queue)
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('in_app', 'email', 'both')),
  category TEXT NOT NULL CHECK (category IN (
    'system',
    'engagement',
    'transactional',
    'marketing'
  )),
  template_key TEXT NOT NULL,
  title_ar TEXT NOT NULL,
  title_en TEXT NOT NULL,
  body_ar TEXT NOT NULL,
  body_en TEXT NOT NULL,
  cta_label_ar TEXT,
  cta_label_en TEXT,
  cta_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'cancelled', 'read', 'dismissed')),
  scheduled_for TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failure_reason TEXT,
  email_resend_id TEXT,
  email_opened_at TIMESTAMPTZ,
  email_clicked_at TIMESTAMPTZ,
  app_opened_within_window BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_status ON notifications(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_pending   ON notifications(scheduled_for, status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_notifications_unread    ON notifications(user_id, status)       WHERE status = 'sent';

-- 2. Notification preferences (per user)
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  email_enabled            BOOLEAN DEFAULT TRUE,
  in_app_enabled           BOOLEAN DEFAULT TRUE,
  marketing_emails_enabled BOOLEAN DEFAULT FALSE,
  system_emails_enabled    BOOLEAN DEFAULT TRUE,
  language                 TEXT NOT NULL DEFAULT 'ar' CHECK (language IN ('ar', 'en')),
  quiet_hours_start        TIME,
  quiet_hours_end          TIME,
  timezone                 TEXT DEFAULT 'Asia/Riyadh',
  daily_email_count        INT DEFAULT 0,
  daily_count_reset_at     TIMESTAMPTZ DEFAULT NOW(),
  last_email_sent_at       TIMESTAMPTZ,
  last_app_opened_at       TIMESTAMPTZ,
  updated_at               TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Frequency-cap log (per template per user)
CREATE TABLE IF NOT EXISTS notification_frequency_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  template_key TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  channel TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_freq_user_template ON notification_frequency_log(user_id, template_key, sent_at DESC);

-- 4. Error event log
CREATE TABLE IF NOT EXISTS error_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  error_code TEXT NOT NULL,
  error_category TEXT NOT NULL CHECK (error_category IN (
    'auth', 'tokens', 'ai_service', 'database', 'network', 'validation', 'payment', 'linkedin', 'unknown'
  )),
  operation TEXT NOT NULL,
  raw_message TEXT,
  formatted_key TEXT,
  formatted_params JSONB,
  user_agent TEXT,
  request_id TEXT,
  refunded_tokens INT DEFAULT 0,
  resolution TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_errors_user      ON error_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_errors_code      ON error_events(error_code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_errors_operation ON error_events(operation, created_at DESC);

-- 5. Backfill notification_preferences for existing users
-- profiles.locale holds the UI language (e.g. 'ar', 'en'); the canonical
-- career-profile language lives on career_profile.primary_language, which
-- may be NULL for users who haven't onboarded yet — fall back to 'ar'.
INSERT INTO notification_preferences (user_id, language)
SELECT
  p.id,
  CASE
    WHEN cp.primary_language IN ('ar','en') THEN cp.primary_language
    WHEN p.locale ILIKE 'en%'               THEN 'en'
    ELSE 'ar'
  END
FROM profiles p
LEFT JOIN career_profile cp ON cp.user_id = p.id
ON CONFLICT (user_id) DO NOTHING;

-- 6. RPC: enqueue notification with frequency-cap + dedup logic
CREATE OR REPLACE FUNCTION enqueue_notification(
  p_user_id      UUID,
  p_template_key TEXT,
  p_category     TEXT,
  p_channel      TEXT,
  p_title_ar     TEXT,
  p_title_en     TEXT,
  p_body_ar      TEXT,
  p_body_en      TEXT,
  p_cta_label_ar TEXT DEFAULT NULL,
  p_cta_label_en TEXT DEFAULT NULL,
  p_cta_url      TEXT DEFAULT NULL,
  p_metadata     JSONB DEFAULT '{}'::jsonb,
  p_priority     TEXT DEFAULT 'normal',
  p_scheduled_for TIMESTAMPTZ DEFAULT NOW()
) RETURNS JSONB AS $$
DECLARE
  v_user_prefs        notification_preferences%ROWTYPE;
  v_recent_count      INT;
  v_max_per_period    INT;
  v_period_hours      INT;
  v_notification_id   UUID;
BEGIN
  SELECT * INTO v_user_prefs FROM notification_preferences WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    INSERT INTO notification_preferences (user_id) VALUES (p_user_id);
    SELECT * INTO v_user_prefs FROM notification_preferences WHERE user_id = p_user_id;
  END IF;

  -- Category-level opt-out: marketing emails default OFF (A21 spirit)
  IF p_category = 'marketing' AND NOT v_user_prefs.marketing_emails_enabled AND p_channel IN ('email', 'both') THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'marketing_opted_out');
  END IF;

  IF NOT v_user_prefs.email_enabled AND p_channel = 'email' THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'email_disabled');
  END IF;

  IF NOT v_user_prefs.in_app_enabled AND p_channel = 'in_app' THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'in_app_disabled');
  END IF;

  -- Per-template frequency caps
  CASE p_template_key
    WHEN 'balance_low' THEN
      v_max_per_period := 1; v_period_hours := 168;
    WHEN 'subscription_renewal' THEN
      v_max_per_period := 1; v_period_hours := 72;
    WHEN 'bonus_expiring' THEN
      v_max_per_period := 1; v_period_hours := 48;
    ELSE
      v_max_per_period := 99; v_period_hours := 1;
  END CASE;

  SELECT COUNT(*) INTO v_recent_count
  FROM notification_frequency_log
  WHERE user_id = p_user_id
    AND template_key = p_template_key
    AND sent_at > NOW() - (v_period_hours || ' hours')::INTERVAL;

  IF v_recent_count >= v_max_per_period THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'frequency_cap');
  END IF;

  -- Daily email cap (max 5/day per user)
  IF p_channel IN ('email', 'both') THEN
    IF v_user_prefs.daily_count_reset_at::date < CURRENT_DATE THEN
      UPDATE notification_preferences
        SET daily_email_count = 0,
            daily_count_reset_at = NOW()
        WHERE user_id = p_user_id;
      v_user_prefs.daily_email_count := 0;
    END IF;

    IF v_user_prefs.daily_email_count >= 5 THEN
      RETURN jsonb_build_object('skipped', true, 'reason', 'daily_email_cap');
    END IF;
  END IF;

  -- Smart dedup: email-only sends are skipped if app was opened in last 10min
  IF p_channel = 'email'
     AND v_user_prefs.last_app_opened_at IS NOT NULL
     AND v_user_prefs.last_app_opened_at > NOW() - INTERVAL '10 minutes'
  THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'app_recently_opened');
  END IF;

  INSERT INTO notifications (
    user_id, channel, category, template_key,
    title_ar, title_en, body_ar, body_en,
    cta_label_ar, cta_label_en, cta_url,
    metadata, priority, scheduled_for
  ) VALUES (
    p_user_id, p_channel, p_category, p_template_key,
    p_title_ar, p_title_en, p_body_ar, p_body_en,
    p_cta_label_ar, p_cta_label_en, p_cta_url,
    p_metadata, p_priority, p_scheduled_for
  ) RETURNING id INTO v_notification_id;

  RETURN jsonb_build_object('queued', true, 'notification_id', v_notification_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION enqueue_notification(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TIMESTAMPTZ
) TO authenticated, service_role, anon;

-- RLS
ALTER TABLE notifications              ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences   ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_frequency_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_events               ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_read_own_notifications   ON notifications;
DROP POLICY IF EXISTS users_update_own_notifications ON notifications;
DROP POLICY IF EXISTS system_all_notifications       ON notifications;
DROP POLICY IF EXISTS admins_all_notifications       ON notifications;

CREATE POLICY users_read_own_notifications   ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY users_update_own_notifications ON notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY system_all_notifications       ON notifications FOR ALL    WITH CHECK (TRUE);
CREATE POLICY admins_all_notifications       ON notifications FOR ALL    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));

DROP POLICY IF EXISTS users_all_own_prefs ON notification_preferences;
DROP POLICY IF EXISTS admins_all_prefs    ON notification_preferences;

CREATE POLICY users_all_own_prefs ON notification_preferences FOR ALL USING (user_id = auth.uid());
CREATE POLICY admins_all_prefs    ON notification_preferences FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));

DROP POLICY IF EXISTS system_all_freq ON notification_frequency_log;
DROP POLICY IF EXISTS admins_all_freq ON notification_frequency_log;

CREATE POLICY system_all_freq ON notification_frequency_log FOR ALL WITH CHECK (TRUE);
CREATE POLICY admins_all_freq ON notification_frequency_log FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));

DROP POLICY IF EXISTS users_read_own_errors  ON error_events;
DROP POLICY IF EXISTS system_insert_errors   ON error_events;
DROP POLICY IF EXISTS admins_all_errors      ON error_events;

CREATE POLICY users_read_own_errors  ON error_events FOR SELECT USING (user_id = auth.uid());
CREATE POLICY system_insert_errors   ON error_events FOR INSERT WITH CHECK (TRUE);
CREATE POLICY admins_all_errors      ON error_events FOR ALL    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));
