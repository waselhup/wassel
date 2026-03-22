-- 010_messages.sql — Message templates for LinkedIn outreach
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL,
  user_id UUID,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'connection_note'
    CHECK (message_type IN ('connection_note', 'follow_up', 'inmail')),
  purpose TEXT,
  tone TEXT,
  variables TEXT[] DEFAULT '{}',
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_team ON messages(team_id);
CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(message_type);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='messages' AND policyname='sr_messages'
  ) THEN
    CREATE POLICY sr_messages ON messages FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
