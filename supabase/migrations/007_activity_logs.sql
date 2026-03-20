-- Migration 007: Activity Logs
-- Tracks all automation actions (visit, connect, message) for the dashboard activity feed.

CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  prospect_id UUID REFERENCES prospects(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  prospect_name TEXT,
  linkedin_url TEXT,
  error_message TEXT,
  executed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_team ON activity_logs(team_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at DESC);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Team isolation policy
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'activity_logs' AND policyname = 'team_isolation_activity_logs'
  ) THEN
    CREATE POLICY team_isolation_activity_logs ON activity_logs
    FOR ALL USING (
      team_id IN (
        SELECT team_id FROM team_members WHERE user_id = auth.uid()
      )
    ) WITH CHECK (
      team_id IN (
        SELECT team_id FROM team_members WHERE user_id = auth.uid()
      )
    );
  END IF;
END $$;

-- Service role policy for server-side access
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'activity_logs' AND policyname = 'sr_activity_logs'
  ) THEN
    CREATE POLICY sr_activity_logs ON activity_logs
    FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
