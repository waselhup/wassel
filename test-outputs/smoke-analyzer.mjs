const SUPA_URL = 'https://hiqotmimlgsrsnovtopd.supabase.co';
const SUPA_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpcW90bWltbGdzcnNub3Z0b3BkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNDgwODcsImV4cCI6MjA4NzcyNDA4N30.jy0blU9Ph4BDmKRxVRP10yUdXKaqBbxI4kpr5SOA9yU';
const HOST = 'https://wasselhub.com';

async function login() {
  const r = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SUPA_ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'alhashimali649@gmail.com', password: 'S1245667' }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error('Login failed: ' + JSON.stringify(j).slice(0, 200));
  return j.access_token;
}

(async () => {
  const token = await login();
  console.log(`✓ Login OK\n`);

  // Use Satya Nadella's public profile — likely cached after multiple calls
  const url = 'https://www.linkedin.com/in/satyanadella/';
  console.log(`Testing analyzeDeep with: ${url}`);
  console.log(`(may take up to 180s — using cache if available)\n`);

  const t0 = Date.now();
  const r = await fetch(`${HOST}/api/trpc/linkedin.analyzeDeep`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ linkedinUrl: url }),
    signal: AbortSignal.timeout(180000),
  });
  const ms = Date.now() - t0;
  const txt = await r.text();
  let j;
  try { j = JSON.parse(txt); } catch { j = { raw: txt.slice(0, 300) }; }

  if (!r.ok || j.error) {
    console.log(`❌  HTTP=${r.status}  ${ms}ms`);
    console.log(`    ${JSON.stringify(j).slice(0, 400)}`);
    process.exit(1);
  }

  const data = j.result?.data || j.result || j.data || j;
  console.log(`✅  HTTP=${r.status}  ${ms}ms`);
  console.log(`\n--- Schema check ---`);
  const checks = {
    'overall_score / score': data.overall_score ?? data.score,
    'tier': data.tier,
    'headline_verdict': data.headline_verdict ? `"${String(data.headline_verdict).slice(0, 60)}..."` : 'MISSING',
    'dimensions (8)': data.dimensions ? Object.keys(data.dimensions).length : 'MISSING',
    'academic_insights': Array.isArray(data.academic_insights) ? data.academic_insights.length : 'MISSING',
    'vision_2030_alignment.thriving_economy': data.vision_2030_alignment?.thriving_economy?.note ? 'OK' : 'MISSING',
    'vision_2030_alignment.vibrant_society': data.vision_2030_alignment?.vibrant_society?.note ? 'OK' : 'MISSING',
    'vision_2030_alignment.ambitious_nation': data.vision_2030_alignment?.ambitious_nation?.note ? 'OK' : 'MISSING',
    'before_after.headline.before/after': (data.before_after?.headline?.before || data.before_after?.headline?.current) ? 'OK' : 'MISSING',
    'action_plan (4 weeks)': Array.isArray(data.action_plan) ? data.action_plan.length : 'MISSING',
  };
  let pass = 0, total = 0;
  for (const [k, v] of Object.entries(checks)) {
    total++;
    const ok = v && v !== 'MISSING' && v !== 0;
    if (ok) pass++;
    console.log(`  ${ok ? '✓' : '✗'}  ${k.padEnd(46)} = ${v}`);
  }
  console.log(`\nSchema coverage: ${pass}/${total}`);
  process.exit(pass === total ? 0 : 1);
})().catch(e => {
  console.error('FATAL', e.message);
  process.exit(2);
});
