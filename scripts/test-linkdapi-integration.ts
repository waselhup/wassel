// LinkdAPI + hybrid orchestrator integration test.
//
// Exercises the adapter and hybrid scraper directly — no tRPC, no DB, no
// tokens charged. Safe to run locally or against staging. For full end-to-end
// verification through the Vercel route, see the companion curl commands
// printed by `npm run print-curl-tests` (or ask Claude).
//
// Required env:
//   LINKDAPI_API_KEY    — LinkdAPI credential (never paste into source)
//   BRIGHT_DATA_API_KEY — for fallback test (optional; skipped if missing)
//
// Run:
//   LINKDAPI_API_KEY=... BRIGHT_DATA_API_KEY=... npx tsx scripts/test-linkdapi-integration.ts

import { scrapeLinkedInProfileLinkdAPI, LinkdApiProfileNotFoundError } from '../server/_core/services/linkdapi';
import { scrapeLinkedInProfileHybrid } from '../server/_core/services/profile-scraper';

interface TestCase {
  label: string;
  url: string;
  expect: 'success' | 'not_found';
  minCompleteness?: number;
  minSkills?: number;
  // If set, profile must have this many or more honors/certs/langs.
  minCerts?: number;
  minLangs?: number;
}

const CASES: TestCase[] = [
  {
    label: 'rich profile (alhashimali)',
    url: 'https://www.linkedin.com/in/alhashimali/',
    expect: 'success',
    minCompleteness: 85,
    minSkills: 15,
    minCerts: 1,
    minLangs: 2,
  },
  {
    label: 'medium profile (ali-alhashim-b786b626a)',
    url: 'https://www.linkedin.com/in/ali-alhashim-b786b626a/',
    expect: 'success',
    minCompleteness: 55,
  },
  {
    label: 'celebrity profile (williamhgates)',
    url: 'https://www.linkedin.com/in/williamhgates/',
    expect: 'success',
    // Celebrity LinkedIn profiles often omit skills arrays — expected to
    // land ~60-70% on completeness. Lower bar than a full professional
    // profile, higher than a placeholder. (Observed: 68%.)
    minCompleteness: 60,
  },
  {
    label: 'fake non-existent URL',
    url: 'https://www.linkedin.com/in/fake-nonexistent-xyz-9999-notreal/',
    expect: 'not_found',
  },
];

interface Result {
  label: string;
  url: string;
  pass: boolean;
  details: string;
  completeness?: number;
  skillsCount?: number;
  certsCount?: number;
  langsCount?: number;
  honorsCount?: number;
  source?: string;
  durationMs: number;
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`\n✗ Missing required env var: ${name}`);
    console.error(`  Run with: ${name}=... npx tsx scripts/test-linkdapi-integration.ts`);
    process.exit(2);
  }
  return v;
}

async function runCase(tc: TestCase): Promise<Result> {
  const t0 = Date.now();
  try {
    const outcome = await scrapeLinkedInProfileHybrid(tc.url);
    const durationMs = Date.now() - t0;

    if (tc.expect === 'not_found') {
      return {
        label: tc.label, url: tc.url, pass: false,
        details: `expected NOT_FOUND but got profile (completeness=${outcome.completeness}, source=${outcome.source})`,
        completeness: outcome.completeness,
        source: outcome.source,
        durationMs,
      };
    }

    const p = outcome.profile;
    const skillsCount = p.skills?.length || 0;
    const certsCount = p.certifications?.length || 0;
    const langsCount = p.languages?.length || 0;
    const honorsCount = p.honorsAndAwards?.length || 0;

    const failures: string[] = [];
    if (typeof tc.minCompleteness === 'number' && outcome.completeness < tc.minCompleteness) {
      failures.push(`completeness ${outcome.completeness}% < ${tc.minCompleteness}%`);
    }
    if (typeof tc.minSkills === 'number' && skillsCount < tc.minSkills) {
      failures.push(`skills ${skillsCount} < ${tc.minSkills}`);
    }
    if (typeof tc.minCerts === 'number' && certsCount < tc.minCerts) {
      failures.push(`certs ${certsCount} < ${tc.minCerts}`);
    }
    if (typeof tc.minLangs === 'number' && langsCount < tc.minLangs) {
      failures.push(`langs ${langsCount} < ${tc.minLangs}`);
    }

    return {
      label: tc.label, url: tc.url,
      pass: failures.length === 0,
      details: failures.length ? failures.join('; ') : `ok (source=${outcome.source})`,
      completeness: outcome.completeness,
      skillsCount, certsCount, langsCount, honorsCount,
      source: outcome.source,
      durationMs,
    };
  } catch (err: any) {
    const durationMs = Date.now() - t0;
    const isNotFound = err instanceof LinkdApiProfileNotFoundError || err?.code === 'NOT_FOUND';

    if (tc.expect === 'not_found') {
      return {
        label: tc.label, url: tc.url,
        pass: isNotFound,
        details: isNotFound
          ? `correctly rejected: ${err?.message?.slice(0, 120)}`
          : `expected NOT_FOUND but threw: ${err?.message || err}`,
        durationMs,
      };
    }
    return {
      label: tc.label, url: tc.url, pass: false,
      details: `unexpected error: ${err?.message || err}`,
      durationMs,
    };
  }
}

async function adapterOnlyRichCheck(): Promise<void> {
  // Direct LinkdAPI adapter test — verifies the raw shape maps correctly.
  console.log('\n─── Direct LinkdAPI adapter check (alhashimali) ───');
  try {
    const o = await scrapeLinkedInProfileLinkdAPI('https://www.linkedin.com/in/alhashimali/');
    const p = o.profile;
    console.log('  fullName:       ', p.fullName);
    console.log('  headline:       ', p.headline.slice(0, 80));
    console.log('  summary chars:  ', p.summary.length);
    console.log('  experience:     ', p.experience.length, '→ first:', p.experience[0]?.title, '@', p.experience[0]?.company);
    console.log('  education:      ', p.education.length, '→ first:', p.education[0]?.school);
    console.log('  skills:         ', p.skills.length, '→', p.skills.slice(0, 5).join(', '));
    console.log('  certifications: ', p.certifications.length, '→', p.certifications[0]?.name);
    console.log('  languages:      ', p.languages.length, '→', p.languages.map(l => `${l.name}(${l.proficiency})`).join(', '));
    console.log('  honors:         ', p.honorsAndAwards?.length || 0);
    console.log('  industry:       ', p.industry?.name);
    console.log('  flags:          ', JSON.stringify(p.flags));
    console.log('  completeness:   ', o.completeness, '%');
  } catch (err: any) {
    console.log('  FAIL:', err?.message);
  }
}

async function main() {
  requireEnv('LINKDAPI_API_KEY');

  await adapterOnlyRichCheck();
  // Pace between adapter probe and the main test run.
  await new Promise((r) => setTimeout(r, 10_000));

  console.log('\n─── Running hybrid scraper test cases ───');
  console.log('(pacing requests at 10s intervals to respect LinkdAPI Testing tier: 7 req/min)');
  const results: Result[] = [];
  for (let i = 0; i < CASES.length; i++) {
    const tc = CASES[i];
    console.log(`\n▶ ${tc.label} — ${tc.url}`);
    const r = await runCase(tc);
    results.push(r);
    console.log(`  ${r.pass ? '✓ PASS' : '✗ FAIL'}: ${r.details}`);
    if (r.completeness !== undefined) {
      console.log(`  metrics: completeness=${r.completeness}% skills=${r.skillsCount} certs=${r.certsCount} langs=${r.langsCount} honors=${r.honorsCount} source=${r.source} durMs=${r.durationMs}`);
    }
    if (i < CASES.length - 1) await new Promise((r) => setTimeout(r, 10_000));
  }

  console.log('\n─── Summary ───');
  console.log('| Test                                 | Result | Completeness | Skills | Source                 | Duration |');
  console.log('|--------------------------------------|--------|--------------|--------|------------------------|----------|');
  for (const r of results) {
    const label = r.label.padEnd(36).slice(0, 36);
    const status = r.pass ? '✓ PASS' : '✗ FAIL';
    const comp = r.completeness !== undefined ? `${r.completeness}%`.padStart(12) : 'n/a'.padStart(12);
    const skills = r.skillsCount !== undefined ? String(r.skillsCount).padStart(6) : 'n/a'.padStart(6);
    const src = (r.source || 'n/a').padEnd(22).slice(0, 22);
    const dur = `${r.durationMs}ms`.padStart(8);
    console.log(`| ${label} | ${status} | ${comp} | ${skills} | ${src} | ${dur} |`);
  }

  const failures = results.filter((r) => !r.pass);
  if (failures.length) {
    console.log(`\n✗ ${failures.length}/${results.length} test(s) failed`);
    process.exit(1);
  }
  console.log(`\n✓ All ${results.length} test(s) passed`);
}

main().catch((e) => {
  console.error('fatal:', e);
  process.exit(1);
});
