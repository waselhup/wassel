const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://hiqotmimlgsrsnovtopd.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpcW90bWltbGdzcnNub3Z0b3BkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjE0ODA4NywiZXhwIjoyMDg3NzI0MDg3fQ.8FrY-dp6uBa7-UkkXybJyNi_7y4irhrThTR33VFDtAA';

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

async function run() {
  console.log('=== Running 005_saas_roles.sql migration ===');

  // Step 1: Check if role column exists
  const { data: testData, error: testErr } = await sb.from('profiles').select('id, email, is_admin').limit(1);
  console.log('Current profiles:', JSON.stringify(testData));

  // Step 2: Try to add role column via REST API (alter table)
  // Supabase REST doesn't support DDL, so use the SQL endpoint
  const sqlStatements = [
    // Add role column
    `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'client_user' CHECK (role IN ('super_admin', 'client_user'))`,
    // Migrate existing is_admin  
    `UPDATE profiles SET role = 'super_admin' WHERE is_admin = true AND (role IS NULL OR role = 'client_user')`,
  ];

  for (const sql of sqlStatements) {
    console.log('Running:', sql.substring(0, 80) + '...');
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({ query: sql }),
    });

    if (!res.ok) {
      // Try the management API
      console.log('REST RPC failed, trying pg_query...');
    }
  }

  // Use the Supabase SQL execution endpoint (Management API)
  const migrationSQL = `
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'client_user' CHECK (role IN ('super_admin', 'client_user'));
    UPDATE profiles SET role = 'super_admin' WHERE is_admin = true AND (role IS NULL OR role = 'client_user');
  `;

  // Try via Supabase's pg REST endpoint
  const pgRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Prefer': 'return=representation',
    },
    body: JSON.stringify({ sql_query: migrationSQL }),
  });

  console.log('exec_sql status:', pgRes.status);
  const pgBody = await pgRes.text();
  console.log('exec_sql response:', pgBody.substring(0, 500));

  // Verify by checking if role column exists now
  const { data: verify, error: verifyErr } = await sb.from('profiles').select('id, email, is_admin, role').limit(5);
  if (verifyErr) {
    console.log('VERIFY ERROR (role column may not exist):', verifyErr.message);
    console.log('');
    console.log('*** FALLBACK: Will use Supabase Dashboard SQL Editor ***');
    console.log('The migration SQL needs to be run manually in the SQL editor.');
  } else {
    console.log('SUCCESS! Profiles with role:', JSON.stringify(verify, null, 2));
  }
}

run().catch(e => console.error('FATAL:', e));
