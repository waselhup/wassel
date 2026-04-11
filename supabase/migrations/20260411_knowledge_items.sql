-- Knowledge items table for NotebookLM integration
CREATE TABLE IF NOT EXISTS knowledge_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('linkedin_analysis', 'campaign_result', 'market_insight')),
  title text NOT NULL,
  content jsonb NOT NULL,
  tags text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- RLS: users can only see their own items
ALTER TABLE knowledge_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own knowledge items"
  ON knowledge_items FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own knowledge items"
  ON knowledge_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own knowledge items"
  ON knowledge_items FOR DELETE
  USING (auth.uid() = user_id);

-- Index for fast user queries
CREATE INDEX IF NOT EXISTS idx_knowledge_items_user_id ON knowledge_items(user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_type ON knowledge_items(type);
