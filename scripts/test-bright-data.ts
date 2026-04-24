// Quick sanity test for the Bright Data adapter.
// Run with:
//   BRIGHT_DATA_API_KEY=... npx tsx scripts/test-bright-data.ts [optional_slug]
//
// Default: tests 3 URLs (1 real, 1 fake, 1 real). Pass a slug to test one.

import { scrapeLinkedInProfileBrightData, BrightDataProfileNotFoundError } from '../server/_core/services/bright-data';

const custom = process.argv[2];
const URLS = custom
  ? [`https://www.linkedin.com/in/${custom.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//, '').replace(/\/$/, '')}/`]
  : [
      'https://www.linkedin.com/in/alhashimali/',
      'https://www.linkedin.com/in/ali-alhashim-b786b626a/',
      'https://www.linkedin.com/in/fake-profile-xyz-9999-abc/',
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
        summaryLen: outcome.profile.summary.length,
        completeness: outcome.completeness,
        experience: outcome.profile.experience.length,
        education: outcome.profile.education.length,
        skills: outcome.profile.skills.length,
        activity: outcome.profile.activity.length,
        missing: outcome.missingSections,
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
