// Quick sanity test for the Bright Data adapter.
// Run with:
//   BRIGHT_DATA_API_KEY=... npx tsx scripts/test-bright-data.ts
//
// Prints normalized profile summaries for 3 URLs: 1 real, 1 fake, 1 real.

import { scrapeLinkedInProfileBrightData, BrightDataProfileNotFoundError } from '../server/_core/services/bright-data';

const URLS = [
  'https://www.linkedin.com/in/alhashimali/',
  'https://www.linkedin.com/in/fake-profile-xyz-9999-abc/',
  'https://www.linkedin.com/in/satyanadella/',
];

async function main() {
  for (const url of URLS) {
    console.log('\n─────────────────────────────────────────');
    console.log('URL:', url);
    try {
      const outcome = await scrapeLinkedInProfileBrightData(url);
      console.log('OK:', {
        source: outcome.source,
        requestedSlug: outcome.requestedSlug,
        returnedSlug: outcome.returnedSlug,
        fullName: outcome.profile.fullName,
        headline: outcome.profile.headline,
        completeness: outcome.completeness,
        experience: outcome.profile.experience.length,
        education: outcome.profile.education.length,
        skills: outcome.profile.skills.length,
      });
    } catch (e: any) {
      if (e instanceof BrightDataProfileNotFoundError) {
        console.log('NOT_FOUND:', { slug: e.requestedSlug, errorCode: e.errorCode, message: e.message });
      } else {
        console.log('FAIL:', { kind: e.kind, message: e.message });
      }
    }
  }
}

main().catch((e) => {
  console.error('fatal:', e);
  process.exit(1);
});
