-- Migration 006: Sequence Engine
-- Adds prospect_step_status for tracking automation progress
-- Modifies campaign_steps: add message_template, rename delay_hours → delay_days

-- 1. Add message_template column to campaign_steps
ALTER TABLE campaign_steps ADD COLUMN IF NOT EXISTS message_template TEXT;

-- 2. Rename delay_hours → delay_days (add delay_days, migrate data, drop delay_hours)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaign_steps' AND column_name = 'delay_hours'
  ) THEN
    ALTER TABLE campaign_steps ADD COLUMN IF NOT EXISTS delay_days INTEGER DEFAULT 0;
    UPDATE campaign_steps SET delay_days = CEIL(delay_hours / 24.0) WHERE delay_hours > 0;
    ALTER TABLE campaign_steps DROP COLUMN delay_hours;
  ELSE
    ALTER TABLE campaign_steps ADD COLUMN IF NOT EXISTS delay_days INTEGER DEFAULT 0;
  END IF;
END $$;

-- 3. Add prospect_id column to linkedin_connections for tracking connection status per prospect
ALTER TABLE linkedin_connections ADD COLUMN IF NOT EXISTS prospect_id UUID REFERENCES prospects(id) ON DELETE SET NULL;
ALTER TABLE linkedin_connections ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'accepted', 'declined'));

-- 4. Create prospect_step_status table
CREATE TABLE IF NOT EXISTS prospect_step_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  step_id UUID NOT NULL REFERENCES campaign_steps(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting','pending','in_progress','completed','failed','skipped')),
  scheduled_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pss_prospect ON prospect_step_status(prospect_id);
CREATE INDEX IF NOT EXISTS idx_pss_campaign ON prospect_step_status(campaign_id);
CREATE INDEX IF NOT EXISTS idx_pss_status ON prospect_step_status(status);
CREATE INDEX IF NOT EXISTS idx_pss_scheduled ON prospect_step_status(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_pss_step ON prospect_step_status(step_id);

-- 5. Enable RLS with proper team isolation
ALTER TABLE prospect_step_status ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'prospect_step_status' AND policyname = 'team_isolation_pss'
  ) THEN
    CREATE POLICY team_isolation_pss ON prospect_step_status
    FOR ALL USING (
      campaign_id IN (
        SELECT id FROM campaigns WHERE team_id IN (
          SELECT team_id FROM team_members
          WHERE user_id = auth.uid()
        )
      )
    ) WITH CHECK (
      campaign_id IN (
        SELECT id FROM campaigns WHERE team_id IN (
          SELECT team_id FROM team_members
          WHERE user_id = auth.uid()
        )
      )
    );
  END IF;
END $$;

-- 6. Also add service role policy for server-side access
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'prospect_step_status' AND policyname = 'sr_pss'
  ) THEN
    CREATE POLICY sr_pss ON prospect_step_status
    FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 7. Create acceptance_check_jobs table for scheduled connection checks
CREATE TABLE IF NOT EXISTS acceptance_check_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_step_status_id UUID NOT NULL REFERENCES prospect_step_status(id) ON DELETE CASCADE,
  prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  next_check_at TIMESTAMPTZ NOT NULL,
  checks_remaining INTEGER DEFAULT 56, -- 14 days * 4 checks/day (every 6 hours)
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_acj_next_check ON acceptance_check_jobs(next_check_at);

ALTER TABLE acceptance_check_jobs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'acceptance_check_jobs' AND policyname = 'sr_acj'
  ) THEN
    CREATE POLICY sr_acj ON acceptance_check_jobs
    FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
