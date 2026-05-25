-- ═══════════════════════════════════════════
-- AI Workforce — Batch 1 schema + seed
-- 8 named agents, approval queue, argue thread, COGS tracking,
-- content calendar, ad campaigns.
-- ═══════════════════════════════════════════

-- Agent registry
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  role_ar TEXT NOT NULL,
  role_en TEXT NOT NULL,
  portal TEXT NOT NULL,
  approval_mode TEXT NOT NULL DEFAULT 'approval_required'
    CHECK (approval_mode IN ('approval_required','suggest_only','auto_with_bounds','auto')),
  argue_mode_enabled BOOLEAN DEFAULT TRUE,
  monthly_token_budget INT DEFAULT 1000000,
  is_active BOOLEAN DEFAULT TRUE,
  avatar_color TEXT,
  avatar_icon TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent task queue (the Approval Queue)
CREATE TABLE IF NOT EXISTS agent_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL REFERENCES agents(id),
  task_type TEXT NOT NULL,
  title TEXT NOT NULL,
  payload JSONB NOT NULL,
  preview JSONB,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','edited_approved','executing','completed','failed','cancelled')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  scheduled_for TIMESTAMPTZ,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  edited_payload JSONB,
  rejection_reason TEXT,
  execution_result JSONB,
  execution_error TEXT,
  related_resource_id TEXT,
  estimated_token_cost INT,
  actual_token_cost INT,
  estimated_money_cost_sar NUMERIC(10,4),
  expected_impact TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_status ON agent_tasks(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_agent ON agent_tasks(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_pending ON agent_tasks(status, priority, created_at) WHERE status = 'pending';

-- Argue mode — multi-turn discussion when Ali edits a task
CREATE TABLE IF NOT EXISTS agent_arguments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES agent_tasks(id) ON DELETE CASCADE,
  turn_number INT NOT NULL DEFAULT 1,
  speaker TEXT NOT NULL CHECK (speaker IN ('agent','ali')),
  message TEXT NOT NULL,
  supporting_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_agent_arguments_task ON agent_arguments(task_id, turn_number);

-- AI cost log (COGS) — every Claude call by every agent
CREATE TABLE IF NOT EXISTS agent_cost_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL REFERENCES agents(id),
  task_id UUID REFERENCES agent_tasks(id) ON DELETE SET NULL,
  model TEXT NOT NULL,
  input_tokens INT NOT NULL,
  output_tokens INT NOT NULL,
  cache_read_tokens INT DEFAULT 0,
  cache_write_tokens INT DEFAULT 0,
  cost_usd NUMERIC(10,6) NOT NULL,
  cost_sar NUMERIC(10,4) NOT NULL,
  purpose TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_agent_cost_agent_time ON agent_cost_log(agent_id, created_at DESC);
-- NOTE: monthly bucket index removed — date_trunc(timestamptz) is STABLE not
-- IMMUTABLE, so Postgres rejects it as an index expression. The
-- (agent_id, created_at DESC) index above is sufficient for the monthly
-- aggregate queries in farisRouter.agentCostReport / listAgents.

-- Content calendar (Sayed's output destination)
CREATE TABLE IF NOT EXISTS content_calendar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL REFERENCES agents(id),
  task_id UUID REFERENCES agent_tasks(id) ON DELETE SET NULL,
  platform TEXT NOT NULL CHECK (platform IN ('snapchat','linkedin','instagram','tiktok','twitter','whatsapp','blog','email')),
  content_type TEXT NOT NULL CHECK (content_type IN ('post','carousel','reel','story','short_video','ad','email','message')),
  language TEXT NOT NULL CHECK (language IN ('ar','en','both')),
  title TEXT,
  caption TEXT NOT NULL,
  hashtags TEXT[],
  visual_prompt TEXT,
  visual_url TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  published_at TIMESTAMPTZ,
  published_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','awaiting_approval','approved','scheduled','published','failed')),
  performance_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_content_calendar_schedule ON content_calendar(scheduled_at, status);
CREATE INDEX IF NOT EXISTS idx_content_calendar_platform ON content_calendar(platform, scheduled_at DESC);

-- Ad campaigns (Sayed manages later)
CREATE TABLE IF NOT EXISTS ad_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL REFERENCES agents(id),
  channel TEXT NOT NULL CHECK (channel IN ('snapchat','linkedin','google','tiktok','instagram','meta')),
  name TEXT NOT NULL,
  objective TEXT,
  daily_budget_sar NUMERIC(10,2),
  total_spend_sar NUMERIC(10,2) DEFAULT 0,
  impressions INT DEFAULT 0,
  clicks INT DEFAULT 0,
  conversions INT DEFAULT 0,
  cac_sar NUMERIC(10,2),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','awaiting_approval','active','paused','completed','killed')),
  external_campaign_id TEXT,
  config JSONB,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_status ON ad_campaigns(status, channel);

-- Seed the 8 agents (Ali's exact names)
INSERT INTO agents (id, name_ar, name_en, role_ar, role_en, portal, approval_mode, monthly_token_budget, avatar_color, avatar_icon) VALUES
  ('sayed',        'سيد',     'Sayed',        'قائد المحتوى والإعلانات',     'Content & Ads Maestro',         'growth',           'approval_required', 2000000, '#10B981', 'Megaphone'),
  ('al_mukhadram', 'المخضرم', 'Al-Mukhadram', 'حارس العملاء',                'Onboarding & Retention',        'customer_success', 'approval_required', 1000000, '#F59E0B', 'HeartHandshake'),
  ('fatima',       'فاطمة',   'Fatima',       'محللة الاستخدام والاحتكاك',   'Research & Friction Analyst',   'product_intel',    'suggest_only',      500000,  '#EC4899', 'Microscope'),
  ('dhai',         'ضي',      'Dhai',         'حارسة الامتثال والاحتيال',    'Compliance & Fraud Guardian',   'compliance',       'auto_with_bounds',  500000,  '#6366F1', 'ShieldCheck'),
  ('hassan',       'حسن',     'Hassan',       'مهندس التحويل والترقية',      'Conversion & Upsell Engineer',  'revenue_lab',      'approval_required', 1000000, '#EF4444', 'TrendingUp'),
  ('hussein',      'حسين',    'Hussein',      'حارس المنصة',                 'Platform Guardian',             'operations',       'auto_with_bounds',  300000,  '#0EA5E9', 'Activity'),
  ('mohammed',     'محمد',    'Mohammed',     'المحاسب وحارس الهامش',        'Accountant & Margin Watcher',   'finance',          'auto_with_bounds',  300000,  '#D4AF37', 'Calculator'),
  ('faris',        'فارس',    'Faris',        'قمرة القيادة',                'Workforce Cockpit',             'workforce_hq',     'auto',              100000,  '#8B5CF6', 'LayoutDashboard')
ON CONFLICT (id) DO UPDATE SET
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  role_ar = EXCLUDED.role_ar,
  role_en = EXCLUDED.role_en,
  portal = EXCLUDED.portal,
  avatar_color = EXCLUDED.avatar_color,
  avatar_icon = EXCLUDED.avatar_icon,
  updated_at = NOW();

-- RLS — admins only
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_arguments ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_cost_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_calendar ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins all agents" ON agents;
CREATE POLICY "admins all agents" ON agents FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));

DROP POLICY IF EXISTS "admins all agent_tasks" ON agent_tasks;
CREATE POLICY "admins all agent_tasks" ON agent_tasks FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));

DROP POLICY IF EXISTS "admins all agent_arguments" ON agent_arguments;
CREATE POLICY "admins all agent_arguments" ON agent_arguments FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));

DROP POLICY IF EXISTS "admins read agent_cost_log" ON agent_cost_log;
CREATE POLICY "admins read agent_cost_log" ON agent_cost_log FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));

DROP POLICY IF EXISTS "admins all content_calendar" ON content_calendar;
CREATE POLICY "admins all content_calendar" ON content_calendar FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));

DROP POLICY IF EXISTS "admins all ad_campaigns" ON ad_campaigns;
CREATE POLICY "admins all ad_campaigns" ON ad_campaigns FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));
