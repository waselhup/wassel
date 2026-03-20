-- Posts table for LinkedIn post management
CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  linkedin_post_id TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_posts_team ON posts(team_id);
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Service role full access policy
CREATE POLICY sr_posts ON posts FOR ALL USING (true) WITH CHECK (true);
