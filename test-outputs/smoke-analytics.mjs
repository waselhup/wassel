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

async function call(name, input, token) {
  const url = input !== undefined
    ? `${HOST}/api/trpc/${name}?input=${encodeURIComponent(JSON.stringify(input))}`
    : `${HOST}/api/trpc/${name}`;
  const t0 = Date.now();
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const ms = Date.now() - t0;
  const txt = await r.text();
  let parsed;
  try { parsed = JSON.parse(txt); } catch { parsed = { raw: txt.slice(0, 200) }; }
  return { name, status: r.status, ms, ok: r.ok && !parsed.error, body: parsed };
}

(async () => {
  const token = await login();
  console.log(`✓ Login OK  (token len ${token.length})\n`);

  const tests = [
    ['analytics.overview', { range: 'month' }],
    ['analytics.activityTimeseries', { days: 30 }],
    ['analytics.campaignPerformance', undefined],
    ['analytics.prospectStatusDistribution', undefined],
    ['analytics.tokensBreakdown', { range: 'month' }],
  ];

  let pass = 0, fail = 0;
  for (const [name, input] of tests) {
    const r = await call(name, input, token);
    const flag = r.ok ? '✅' : '❌';
    console.log(`${flag}  ${name.padEnd(38)}  HTTP=${r.status}  ${String(r.ms).padStart(4)}ms`);
    if (!r.ok) {
      fail++;
      console.log(`    ${JSON.stringify(r.body).slice(0, 250)}`);
    } else {
      pass++;
      // print a tiny shape preview
      const data = r.body?.result?.data?.json ?? r.body?.result?.data;
      if (data) {
        const preview = Array.isArray(data) ? `array(${data.length})` : Object.keys(data).slice(0, 6).join(', ');
        console.log(`    → ${preview}`);
      }
    }
  }

  console.log(`\nResult: ${pass}/5 passed${fail ? ` (${fail} failed)` : ''}`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e.message); process.exit(2); });
