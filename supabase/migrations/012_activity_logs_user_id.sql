-- Migration 012: Add user_id to activity_logs
-- Fixes activity logging for solo users who may not have a team membership.
-- Also makes team_id nullable (remove FK failure for fallback inserts).

ALTER TABLE activity_logs
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id);
