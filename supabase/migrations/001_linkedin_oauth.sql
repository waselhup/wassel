-- LinkedIn OAuth + Client Invite Flow + Extension Tables
-- Run this SQL in Supabase SQL Editor to create required tables

-- 1. Clients table: tracks client accounts managed by admin
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL,
  email TEXT NOT NULL,
  name TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'invited', 'connected', 'revoked')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clients_team_id ON clients(team_id);
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);

-- 2. Client invites table: stores invite tokens sent to clients
CREATE TABLE IF NOT EXISTS client_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_invites_token ON client_invites(token);

-- 3. LinkedIn connections table: stores encrypted OAuth tokens
CREATE TABLE IF NOT EXISTS linkedin_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  linkedin_member_id TEXT,
  linkedin_name TEXT,
  linkedin_email TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  scopes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(client_id)
);

CREATE INDEX IF NOT EXISTS idx_linkedin_connections_client_id ON linkedin_connections(client_id);

-- 4. OAuth state table: short-lived CSRF state for OAuth flow
CREATE TABLE IF NOT EXISTS oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state TEXT UNIQUE NOT NULL,
  invite_token TEXT NOT NULL,
  client_id UUID NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oauth_states_state ON oauth_states(state);

-- 5. Prospects table: stores imported LinkedIn prospects
CREATE TABLE IF NOT EXISTS prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL,
  client_id UUID,
  campaign_id UUID,
  linkedin_url TEXT NOT NULL,
  name TEXT,
  title TEXT,
  company TEXT,
  location TEXT,
  source_url TEXT,
  status TEXT DEFAULT 'imported',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prospects_team ON prospects(team_id);
CREATE INDEX IF NOT EXISTS idx_prospects_campaign ON prospects(campaign_id);

-- 6. Prospect import jobs: tracks extension batch imports
CREATE TABLE IF NOT EXISTS prospect_import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL,
  campaign_id UUID,
  source_url TEXT,
  prospect_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE linkedin_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospect_import_jobs ENABLE ROW LEVEL SECURITY;

-- Policies (service role full access)
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='clients' AND policyname='sr_clients') THEN CREATE POLICY sr_clients ON clients FOR ALL USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='client_invites' AND policyname='sr_invites') THEN CREATE POLICY sr_invites ON client_invites FOR ALL USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='linkedin_connections' AND policyname='sr_linkedin') THEN CREATE POLICY sr_linkedin ON linkedin_connections FOR ALL USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='oauth_states' AND policyname='sr_oauth') THEN CREATE POLICY sr_oauth ON oauth_states FOR ALL USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='prospects' AND policyname='sr_prospects') THEN CREATE POLICY sr_prospects ON prospects FOR ALL USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='prospect_import_jobs' AND policyname='sr_import_jobs') THEN CREATE POLICY sr_import_jobs ON prospect_import_jobs FOR ALL USING (true) WITH CHECK (true); END IF; END $$;
