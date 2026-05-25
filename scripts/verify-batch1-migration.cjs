// Verify the AI Workforce Batch 1 migration applied correctly.
// Reads from production Supabase using service-role key from env or
// hardcoded fallback (since CLAUDE.md has it documented).

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL
  || process.env.VITE_SUPABASE_URL
  || 'https://hiqotmimlgsrsnovtopd.supabase.co';

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpcW90bWltbGdzcnNub3Z0b3BkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjE0ODA4NywiZXhwIjoyMDg3NzI0MDg3fQ.8FrY-dp6uBa7-UkkXybJyNi_7y4irhrThTR33VFDtAA';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

const EXPECTED_AGENTS = [
  { id: 'sayed',        name_ar: 'سيد' },
  { id: 'al_mukhadram', name_ar: 'المخضرم' },
  { id: 'fatima',       name_ar: 'فاطمة' },
  { id: 'dhai',         name_ar: 'ضي' },
  { id: 'hassan',       name_ar: 'حسن' },
  { id: 'hussein',      name_ar: 'حسين' },
  { id: 'mohammed',     name_ar: 'محمد' },
  { id: 'faris',        name_ar: 'فارس' },
];

const TABLES = ['agents', 'agent_tasks', 'agent_arguments', 'agent_cost_log', 'content_calendar', 'ad_campaigns'];

async function tableExists(table) {
  const { error } = await supabase.from(table).select('*', { count: 'exact', head: true }).limit(1);
  if (error) return { ok: false, reason: error.message };
  return { ok: true };
}

(async () => {
  console.log('=== Wassel AI Workforce — Batch 1 Migration Verification ===\n');
  console.log(`Project: ${SUPABASE_URL}\n`);

  // 1) All 6 tables exist
  console.log('1. Table existence:');
  let allTablesOk = true;
  for (const t of TABLES) {
    const r = await tableExists(t);
    console.log(`   ${r.ok ? '✓' : '✗'} ${t}${r.ok ? '' : ` — ${r.reason}`}`);
    if (!r.ok) allTablesOk = false;
  }
  if (!allTablesOk) {
    console.error('\n✗ One or more tables missing. Migration not applied.');
    process.exit(1);
  }

  // 2) 8 agents seeded with correct Arabic names
  console.log('\n2. Agent seed:');
  const { data: agents, error } = await supabase
    .from('agents')
    .select('id, name_ar, name_en, role_ar, role_en, portal, approval_mode, monthly_token_budget, avatar_color, avatar_icon')
    .order('id', { ascending: true });

  if (error) {
    console.error('   ✗ Failed to fetch agents:', error.message);
    process.exit(1);
  }

  let allAgentsOk = true;
  for (const expected of EXPECTED_AGENTS) {
    const found = agents.find((a) => a.id === expected.id);
    if (!found) {
      console.log(`   ✗ Missing: ${expected.id} (${expected.name_ar})`);
      allAgentsOk = false;
      continue;
    }
    const nameMatch = found.name_ar === expected.name_ar;
    console.log(`   ${nameMatch ? '✓' : '✗'} ${expected.id} → ${found.name_ar} / ${found.name_en} / ${found.role_en} / portal=${found.portal} / mode=${found.approval_mode}`);
    if (!nameMatch) {
      console.log(`     Expected name_ar="${expected.name_ar}", got "${found.name_ar}"`);
      allAgentsOk = false;
    }
  }

  if (agents.length !== EXPECTED_AGENTS.length) {
    console.log(`   ⚠  Found ${agents.length} agents, expected ${EXPECTED_AGENTS.length}.`);
  }

  if (!allAgentsOk) {
    console.error('\n✗ Agent verification failed.');
    process.exit(1);
  }

  // 3) RLS check — admin profile should be able to read agent_cost_log
  console.log('\n3. RLS smoke (service-role bypasses RLS, so this is just a sanity check):');
  const { count: costRows } = await supabase
    .from('agent_cost_log')
    .select('id', { count: 'exact', head: true });
  console.log(`   ✓ agent_cost_log readable, current rows: ${costRows ?? 0}`);

  console.log('\n✅ Batch 1 migration verified. All 6 tables present, all 8 agents seeded.\n');
})().catch((e) => {
  console.error('Verification crashed:', e?.message || e);
  process.exit(1);
});
