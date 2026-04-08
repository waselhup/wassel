-- ═══════════════════════════════════════════
-- WASSEL V2 — Initial Database Schema
-- ═══════════════════════════════════════════

-- Profiles table (auto-created on signup via trigger)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  location TEXT,
  title TEXT,
  company TEXT,
  linkedin_url TEXT,
  resume_url TEXT,
  resume_data JSONB,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free','starter','pro','elite')),
  token_balance INTEGER DEFAULT 100,
  is_banned BOOLEAN DEFAULT false,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- LinkedIn Analyses
CREATE TABLE IF NOT EXISTS linkedin_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  profile_url TEXT NOT NULL,
  score INTEGER CHECK (score >= 0 AND score <= 100),
  headline_current TEXT,
  headline_suggestion TEXT,
  summary_current TEXT,
  summary_suggestion TEXT,
  keywords_suggestions TEXT[],
  experience_suggestions JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CV Versions
CREATE TABLE IF NOT EXISTS cv_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  field_name TEXT NOT NULL,
  cv_content JSONB,
  download_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email Campaigns
CREATE TABLE IF NOT EXISTS email_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  campaign_name TEXT NOT NULL,
  job_title TEXT,
  target_companies TEXT[],
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','running','completed','paused')),
  total_recipients INTEGER DEFAULT 0,
  emails_sent INTEGER DEFAULT 0,
  opens_count INTEGER DEFAULT 0,
  replies_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Email Recipients
CREATE TABLE IF NOT EXISTS email_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES email_campaigns(id) ON DELETE CASCADE NOT NULL,
  full_name TEXT,
  email TEXT NOT NULL,
  company TEXT,
  job_title TEXT,
  linkedin_url TEXT,
  email_body TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','sent','opened','replied','bounced')),
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ
);

-- Token Transactions
CREATE TABLE IF NOT EXISTS token_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('purchase','spend','bonus','refund','admin_adjust')),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- System Settings
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_linkedin_analyses_user ON linkedin_analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_cv_versions_user ON cv_versions(user_id);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_user ON email_campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_email_recipients_campaign ON email_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_recipients_email ON email_recipients(email);
CREATE INDEX IF NOT EXISTS idx_token_transactions_user ON token_transactions(user_id);

-- ═══════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE linkedin_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE cv_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Profiles: users manage own
CREATE POLICY "Users manage own profile" ON profiles FOR ALL USING (auth.uid() = id);

-- LinkedIn analyses: users see own
CREATE POLICY "Users see own analyses" ON linkedin_analyses FOR ALL USING (auth.uid() = user_id);

-- CV versions: users see own
CREATE POLICY "Users see own CVs" ON cv_versions FOR ALL USING (auth.uid() = user_id);

-- Email campaigns: users see own
CREATE POLICY "Users see own campaigns" ON email_campaigns FOR ALL USING (auth.uid() = user_id);

-- Email recipients: users see own via campaign
CREATE POLICY "Users see own recipients" ON email_recipients FOR ALL USING (
  campaign_id IN (SELECT id FROM email_campaigns WHERE user_id = auth.uid())
);

-- Token transactions: users see own
CREATE POLICY "Users see own tokens" ON token_transactions FOR ALL USING (auth.uid() = user_id);

-- System settings: service role only
CREATE POLICY "Service role settings" ON system_settings FOR ALL USING (auth.role() = 'service_role');

-- ═══════════════════════════════════════════
-- TRIGGERS
-- ═══════════════════════════════════════════

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists then create
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ═══════════════════════════════════════════
-- DEFAULT DATA
-- ═══════════════════════════════════════════
INSERT INTO system_settings (key, value) VALUES
  ('token_prices', '{"100": 50, "500": 200, "1000": 350}'::jsonb),
  ('plans', '{"free": 0, "starter": 99, "pro": 199, "elite": 299}'::jsonb),
  ('daily_limits', '{"free": 5, "starter": 50, "pro": 200, "elite": 500}'::jsonb),
  ('feature_flags', '{"ai_tailor": true, "email_campaign": true, "linkedin_optimizer": true}'::jsonb)
ON CONFLICT (key) DO NOTHING;