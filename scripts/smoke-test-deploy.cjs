#!/usr/bin/env node
/**
 * smoke-test-deploy.cjs
 *
 * Production smoke test. Run AFTER every deploy, or as a final step in
 * full_deploy.bat. Verifies that:
 *   1. Critical public routes return HTTP 200 with expected HTML markers
 *   2. The HTML references a JS bundle that itself returns 200
 *   3. Critical tRPC public endpoints return well-formed JSON
 *   4. The pricing endpoint returns at least one plan with required fields
 *
 * Exits non-zero on any failure so CI/scripts can halt the release.
 *
 * Usage:
 *   node scripts/smoke-test-deploy.cjs
 *   node scripts/smoke-test-deploy.cjs --base https://wassel-alpha.vercel.app
 */

const DEFAULT_BASE = 'https://wasselhub.com';
const args = process.argv.slice(2);
const baseIdx = args.indexOf('--base');
const BASE = baseIdx >= 0 ? args[baseIdx + 1] : DEFAULT_BASE;

const TIMEOUT_MS = 15000;

function color(c, s) {
  const codes = { red: 31, green: 32, yellow: 33, cyan: 36, gray: 90 };
  return process.stdout.isTTY ? `\x1b[${codes[c]}m${s}\x1b[0m` : s;
}

async function fetchWithTimeout(url, opts = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

const failures = [];

function pass(name) {
  console.log(`  ${color('green', 'PASS')}  ${name}`);
}
function fail(name, detail) {
  console.log(`  ${color('red', 'FAIL')}  ${name}  ${color('gray', detail || '')}`);
  failures.push({ name, detail });
}

async function checkPublicRoute(path, expectedMarker) {
  const url = `${BASE}${path}`;
  const name = `GET ${path}`;
  try {
    const res = await fetchWithTimeout(url);
    if (res.status !== 200) return fail(name, `HTTP ${res.status}`);
    const html = await res.text();
    if (expectedMarker && !html.includes(expectedMarker)) {
      return fail(name, `missing marker "${expectedMarker}"`);
    }
    pass(`${name} (${res.status})`);
    // Extract first JS bundle and verify it loads
    const m = html.match(/src="(\/assets\/index-[A-Za-z0-9_-]+\.js)"/);
    if (m) {
      const jsUrl = `${BASE}${m[1]}`;
      const jsRes = await fetchWithTimeout(jsUrl);
      if (jsRes.status === 200) pass(`  └─ ${m[1]} (${jsRes.status})`);
      else fail(`  └─ ${m[1]}`, `HTTP ${jsRes.status}`);
    }
  } catch (e) {
    fail(name, e.message || String(e));
  }
}

async function checkTrpc(name, path, validator) {
  const url = `${BASE}/api/trpc/${path}`;
  const display = `tRPC ${path}`;
  try {
    const res = await fetchWithTimeout(url, { headers: { Accept: 'application/json' } });
    if (res.status !== 200) return fail(display, `HTTP ${res.status}`);
    const j = await res.json();
    const data = j && j.result && j.result.data;
    if (data === undefined) return fail(display, 'missing result.data');
    const issue = validator ? validator(data) : null;
    if (issue) return fail(display, issue);
    pass(`${display} (${res.status})`);
  } catch (e) {
    fail(display, e.message || String(e));
  }
}

async function main() {
  console.log(color('cyan', `\nWassel smoke test — ${BASE}\n`));

  // Public routes
  console.log(color('cyan', 'Public routes:'));
  await checkPublicRoute('/v2', 'وصل');
  await checkPublicRoute('/v2/pricing', 'وصل');
  await checkPublicRoute('/v2/pricing/products', 'وصل');
  await checkPublicRoute('/v2/login', 'وصل');

  // Health endpoint
  console.log(color('cyan', '\nAPI health:'));
  try {
    const res = await fetchWithTimeout(`${BASE}/api/health`);
    const j = await res.json();
    if (j && j.status === 'ok') pass(`/api/health (${res.status})`);
    else fail('/api/health', JSON.stringify(j).slice(0, 100));
  } catch (e) { fail('/api/health', e.message); }

  // Critical public tRPC endpoints
  console.log(color('cyan', '\ntRPC endpoints:'));
  await checkTrpc('plans', 'pricing.getPlans', (data) => {
    if (!Array.isArray(data)) return 'not an array';
    if (data.length === 0) return 'no plans returned';
    const required = ['id', 'name_ar', 'name_en', 'monthly_price_sar', 'monthly_tokens'];
    for (const plan of data) {
      for (const k of required) {
        if (plan[k] === undefined) return `plan ${plan.id || '?'} missing ${k}`;
      }
    }
    return null;
  });
  await checkTrpc('products', 'pricing.getProducts', (data) => {
    if (!Array.isArray(data)) return 'not an array';
    if (data.length === 0) return 'no products returned';
    return null;
  });

  // Summary
  console.log();
  if (failures.length === 0) {
    console.log(color('green', `✓ ALL SMOKE TESTS PASSED (${BASE})\n`));
    process.exit(0);
  } else {
    console.log(color('red', `✗ ${failures.length} SMOKE TEST FAILURE(S):`));
    for (const f of failures) console.log(`  - ${f.name}: ${f.detail || ''}`);
    console.log();
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(color('red', 'Smoke test runner crashed:'), e);
  process.exit(2);
});
