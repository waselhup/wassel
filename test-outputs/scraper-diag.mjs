// Diagnostic: hit each Apify actor on the same profile, dump raw shape.
import fs from 'node:fs';
const TOKEN = 'apify_api_CWdZMugTbgkgRByDMhsYDTAmCzez3g4EZ4S9';
const url = 'https://www.linkedin.com/in/hassan-almodhi';

const actors = [
  { id: 'dev_fusion~Linkedin-Profile-Scraper', inputs: [{ profileUrls: [url] }] },
  { id: 'apimaestro~linkedin-profile-detail', inputs: [{ profileUrls: [url] }, { urls: [url] }] },
  { id: 'harvestapi~linkedin-profile-scraper', inputs: [{ linkedinUrls: [url] }, { profileUrls: [url] }] },
  { id: 'curious_coder~linkedin-profile-scraper', inputs: [{ urls: [url] }, { profileUrls: [url] }] },
  { id: 'bebity~linkedin-profile-scraper', inputs: [{ urls: [url] }, { profileUrls: [url] }] },
];

for (const a of actors) {
  console.log(`\n=== ${a.id} ===`);
  let ok = false;
  for (const body of a.inputs) {
    try {
      const t0 = Date.now();
      const r = await fetch(
        `https://api.apify.com/v2/acts/${a.id}/run-sync-get-dataset-items?token=${TOKEN}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(120000),
        }
      );
      const ms = Date.now() - t0;
      if (!r.ok) { console.log(`  body=${Object.keys(body)[0]}: HTTP ${r.status} (${ms}ms)`); continue; }
      const data = await r.json();
      const p = Array.isArray(data) ? data[0] : data;
      if (!p) { console.log(`  body=${Object.keys(body)[0]}: empty (${ms}ms)`); continue; }

      const short = a.id.split('~').pop();
      fs.writeFileSync(`test-outputs/diag-${short}.json`, JSON.stringify(p, null, 2), 'utf8');
      const keys = Object.keys(p);
      const expArr = p.experience || p.experiences || p.positions || p.workExperience || [];
      const skillsArr = p.skills || p.skillsList || p.topSkills || [];
      const eduArr = p.education || p.educations || p.schools || [];
      console.log(`  body=${Object.keys(body)[0]}: ${ms}ms`);
      console.log(`  root keys (first 18): ${keys.slice(0, 18).join(', ')}`);
      console.log(`  fullName: ${(p.fullName || p.name || `${p.firstName || ''} ${p.lastName || ''}`.trim()).slice(0, 60)}`);
      console.log(`  headline: ${(p.headline || p.jobTitle || '').slice(0, 60)}`);
      console.log(`  summary len: ${(p.summary || p.about || p.description || '').length}`);
      console.log(`  experience: ${Array.isArray(expArr) ? expArr.length : '?'} items`);
      console.log(`  skills: ${Array.isArray(skillsArr) ? skillsArr.length : '?'} items`);
      console.log(`  education: ${Array.isArray(eduArr) ? eduArr.length : '?'} items`);
      console.log(`  certifications: ${(p.certifications || p.licenses || []).length}`);
      ok = true;
      break;
    } catch (e) {
      console.log(`  body=${Object.keys(body)[0]}: ERR ${e.message}`);
    }
  }
  if (!ok) console.log(`  → no working input shape`);
}
