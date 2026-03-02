// Direct PostgreSQL migration via pg client
const { Client } = require('pg');

// Supabase direct connection string
// Format: postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
// The service role JWT won't work here - we need the database password
// Let's try the supabase connection pooler with the project password

const PROJECT_REF = 'hiqotmimlgsrsnovtopd';

// Supabase pooler connection (Session mode on port 5432, Transaction mode on 6543)
// Using the default postgres user password from the project creation
// We'll try connecting with the service_role approach first
const connectionStr = `postgresql://postgres.${PROJECT_REF}:${process.env.SUPABASE_DB_PASSWORD || 'NOT_SET'}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`;

const SQL = `
-- 1. Clients
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL,
  email TEXT NOT NULL,
  name TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','invited','connected','revoked')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Client invites  
CREATE TABLE IF NOT EXISTS public.client_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. LinkedIn connections
CREATE TABLE IF NOT EXISTS public.linkedin_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL,
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

-- 4. OAuth states
CREATE TABLE IF NOT EXISTS public.oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state TEXT UNIQUE NOT NULL,
  invite_token TEXT NOT NULL,
  client_id UUID NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Prospects
CREATE TABLE IF NOT EXISTS public.prospects (
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

-- 6. Prospect import jobs
CREATE TABLE IF NOT EXISTS public.prospect_import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL,
  campaign_id UUID,
  source_url TEXT,
  prospect_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_clients_team_id ON public.clients(team_id);
CREATE INDEX IF NOT EXISTS idx_clients_email ON public.clients(email);
CREATE INDEX IF NOT EXISTS idx_client_invites_token ON public.client_invites(token);
CREATE INDEX IF NOT EXISTS idx_linkedin_connections_client_id ON public.linkedin_connections(client_id);
CREATE INDEX IF NOT EXISTS idx_oauth_states_state ON public.oauth_states(state);
CREATE INDEX IF NOT EXISTS idx_prospects_team ON public.prospects(team_id);
CREATE INDEX IF NOT EXISTS idx_prospects_campaign ON public.prospects(campaign_id);

-- RLS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.linkedin_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospect_import_jobs ENABLE ROW LEVEL SECURITY;
`;

// Policies must be separate
const POLICIES = [
    "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='clients' AND policyname='service_role_clients') THEN CREATE POLICY service_role_clients ON public.clients FOR ALL USING (true) WITH CHECK (true); END IF; END $$",
    "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='client_invites' AND policyname='service_role_invites') THEN CREATE POLICY service_role_invites ON public.client_invites FOR ALL USING (true) WITH CHECK (true); END IF; END $$",
    "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='linkedin_connections' AND policyname='service_role_linkedin') THEN CREATE POLICY service_role_linkedin ON public.linkedin_connections FOR ALL USING (true) WITH CHECK (true); END IF; END $$",
    "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='oauth_states' AND policyname='service_role_oauth') THEN CREATE POLICY service_role_oauth ON public.oauth_states FOR ALL USING (true) WITH CHECK (true); END IF; END $$",
    "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='prospects' AND policyname='service_role_prospects') THEN CREATE POLICY service_role_prospects ON public.prospects FOR ALL USING (true) WITH CHECK (true); END IF; END $$",
    "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='prospect_import_jobs' AND policyname='service_role_import_jobs') THEN CREATE POLICY service_role_import_jobs ON public.prospect_import_jobs FOR ALL USING (true) WITH CHECK (true); END IF; END $$",
];

async function run() {
    if (!process.env.SUPABASE_DB_PASSWORD) {
        console.log('ERROR: SUPABASE_DB_PASSWORD environment variable not set.');
        console.log('You need to provide your Supabase database password.');
        console.log('You can find it in: Supabase Dashboard > Settings > Database > Connection string');
        console.log('');
        console.log('Usage: SUPABASE_DB_PASSWORD=your_password node run_migration.cjs');
        process.exit(1);
    }

    const client = new Client({ connectionString: connectionStr, ssl: { rejectUnauthorized: false } });

    try {
        console.log('Connecting to Supabase PostgreSQL...');
        await client.connect();
        console.log('Connected!');

        console.log('\nRunning table creation...');
        await client.query(SQL);
        console.log('Tables + indexes + RLS done!');

        console.log('\nRunning policy creation...');
        for (const p of POLICIES) {
            await client.query(p);
        }
        console.log('Policies done!');

        // Verify
        console.log('\nVerifying tables...');
        const result = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('clients','client_invites','linkedin_connections','oauth_states','prospects','prospect_import_jobs')
      ORDER BY table_name
    `);
        console.log('Tables found:', result.rows.map(r => r.table_name).join(', '));
        console.log('\n✅ Migration complete!');

    } catch (err) {
        console.error('Migration failed:', err.message);
    } finally {
        await client.end();
    }
}

run();
