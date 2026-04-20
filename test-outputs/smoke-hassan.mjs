const SUPA_URL = 'https://hiqotmimlgsrsnovtopd.supabase.co';
const SUPA_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpcW90bWltbGdzcnNub3Z0b3BkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNDgwODcsImV4cCI6MjA4NzcyNDA4N30.jy0blU9Ph4BDmKRxVRP10yUdXKaqBbxI4kpr5SOA9yU';
const HOST = 'https://wasselhub.com';

const r1 = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: SUPA_ANON, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'alhashimali649@gmail.com', password: 'S1245667' }),
});
const tok = (await r1.json()).access_token;
console.log('✓ Login OK\n');

console.log('Calling analyzeDeep on hassan-almodhi (cache cleared, fresh ~120s)...');
const t0 = Date.now();
const r = await fetch(`${HOST}/api/trpc/linkedin.analyzeDeep`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ linkedinUrl: 'https://www.linkedin.com/in/hassan-almodhi' }),
  signal: AbortSignal.timeout(200000),
});
const ms = Date.now() - t0;
const j = await r.json();
if (!r.ok || j.error) {
  console.log('❌  HTTP=' + r.status, JSON.stringify(j).slice(0, 400));
  process.exit(1);
}
const d = j.result?.data || j.result || j;
console.log(`✅  HTTP=${r.status}  ${(ms / 1000).toFixed(1)}s\n`);

console.log('═══ SCRAPER VERIFICATION ═══');
console.log(`Source:        ${d._meta?.source}`);
console.log(`Completeness:  ${d._meta?.completeness}%`);
console.log(`Attempts:      ${(d._meta?.attempts || []).join(' | ')}`);
console.log(`Lang detected: ${d._meta?.detected_language}`);
console.log();
console.log('Profile data captured:');
const p = d._profile || {};
console.log(`  fullName:        ${p.fullName}`);
console.log(`  headline:        ${(p.headline || '').slice(0, 60)}`);
console.log(`  summary chars:   ${(p.summary || '').length}`);
console.log(`  experience:      ${p.experience?.length || 0} items`);
console.log(`  experience[0]:   ${p.experience?.[0]?.title} @ ${p.experience?.[0]?.company}`);
console.log(`  skills:          ${p.skills?.length || 0} items`);
console.log(`  skills sample:   ${(p.skills || []).slice(0, 5).join(', ')}`);
console.log(`  education:       ${p.education?.length || 0} items`);
console.log(`  certifications:  ${p.certifications?.length || 0} items`);
console.log(`  languages:       ${p.languages?.length || 0} items`);
console.log(`  location:        ${p.location}`);
console.log();
console.log('Dimensions scored:');
for (const k of ['headline', 'summary', 'experience', 'skills', 'education', 'recommendations', 'activity', 'media']) {
  const dim = d.dimensions?.[k];
  console.log(`  ${k.padEnd(16)} score=${String(dim?.score ?? '—').padStart(4)}  data_found=${dim?.data_found}`);
}
console.log();
console.log(`Quick wins: ${d.quick_wins?.length || 0}`);
console.log(`Insights:   ${d.academic_insights?.length || 0}`);
console.log(`Vision 2030 pillars present: ${['thriving_economy', 'vibrant_society', 'ambitious_nation'].filter(p => d.vision_2030_alignment?.[p]?.note).length}/3`);

const ok = (d._meta?.completeness ?? 0) >= 70 && (p.skills?.length || 0) >= 5 && (p.experience?.length || 0) >= 1;
process.exit(ok ? 0 : 1);
