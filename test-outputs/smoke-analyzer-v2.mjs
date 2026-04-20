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
  console.log('✓ Login OK\n');

  // Page HTTP
  const pageRes = await fetch(`${HOST}/app/profile-analysis`);
  console.log(`✅  Page HTTP: ${pageRes.status}\n`);

  // analyzeDeep — fresh (cache cleared)
  const url = 'https://www.linkedin.com/in/satyanadella/';
  console.log(`Testing analyzeDeep: ${url}  (fresh, ~120s)`);
  const t0 = Date.now();
  const r = await fetch(`${HOST}/api/trpc/linkedin.analyzeDeep`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ linkedinUrl: url }),
    signal: AbortSignal.timeout(180000),
  });
  const ms = Date.now() - t0;
  const txt = await r.text();
  let j; try { j = JSON.parse(txt); } catch { j = { raw: txt.slice(0, 400) }; }

  if (!r.ok || j.error) {
    console.log(`❌  HTTP=${r.status}  ${ms}ms`);
    console.log('   ', JSON.stringify(j).slice(0, 400));
    process.exit(1);
  }
  const data = j.result?.data || j.result || j.data || j;
  console.log(`✅  HTTP=${r.status}  ${(ms / 1000).toFixed(1)}s\n`);

  console.log('--- v2 schema check ---');
  const checks = [
    ['overall_score', data.overall_score ?? data.score],
    ['tier', data.tier],
    ['headline_verdict (truncated)', data.headline_verdict ? `"${String(data.headline_verdict).slice(0, 70)}..."` : null],
    ['_meta.completeness', data._meta?.completeness],
    ['_meta.actor', data._meta?.actor],
    ['_meta.detected_language', data._meta?.detected_language],
    ['_meta.missing_sections', Array.isArray(data._meta?.missing_sections) ? data._meta.missing_sections.length + ' items' : null],
    ['dimensions count', data.dimensions ? Object.keys(data.dimensions).length : 0],
    ['dimensions[experience].data_found', data.dimensions?.experience?.data_found],
    ['dimensions[skills].data_found', data.dimensions?.skills?.data_found],
    ['quick_wins count', Array.isArray(data.quick_wins) ? data.quick_wins.length : 0],
    ['quick_wins[0].action', data.quick_wins?.[0]?.action ? data.quick_wins[0].action.slice(0, 60) + '...' : null],
    ['quick_wins[0].effort', data.quick_wins?.[0]?.effort],
    ['quick_wins[0].priority', data.quick_wins?.[0]?.priority],
    ['before_after.headline.kept_as_is', data.before_after?.headline?.kept_as_is],
    ['before_after.headline.language', data.before_after?.headline?.language],
    ['vision_2030.thriving_economy.note', data.vision_2030_alignment?.thriving_economy?.note ? 'present' : null],
    ['academic_insights count', Array.isArray(data.academic_insights) ? data.academic_insights.length : 0],
  ];
  let pass = 0, total = 0;
  for (const [k, v] of checks) {
    total++;
    const ok = v !== null && v !== undefined && v !== 0 && v !== '';
    if (ok) pass++;
    console.log(`  ${ok ? '✓' : '✗'}  ${k.padEnd(42)} = ${v}`);
  }
  console.log(`\nv2 schema coverage: ${pass}/${total}\n`);

  // Email endpoint smoke test (does NOT actually send to anything except the test inbox)
  console.log('Testing email endpoint...');
  const er = await fetch(`${HOST}/api/analyzer/send-email`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipientEmail: 'alhashimali649@gmail.com',
      language: 'ar',
      result: data,
      linkedinUrl: url,
    }),
  });
  const ej = await er.json().catch(() => ({}));
  console.log(`${er.ok && ej.ok ? '✅' : '❌'}  Email endpoint: HTTP=${er.status} ok=${ej.ok} ${ej.skipped ? '(skipped: ' + ej.reason + ')' : ''}`);
  if (!er.ok) console.log('   error:', ej.error || JSON.stringify(ej).slice(0, 200));

  process.exit(pass < 12 ? 1 : 0);
})().catch(e => { console.error('FATAL', e.message); process.exit(2); });
