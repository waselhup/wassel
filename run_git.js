const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const repo = 'C:\\Users\\WIN11-24H2GPT\\Desktop\\New folder\\wassel';
const lock = path.join(repo, '.git', 'index.lock');
const out = [];

try { fs.unlinkSync(lock); out.push('Lock removed'); } catch(e) { out.push('No lock: ' + e.message); }

process.chdir(repo);

const files = [
  'client/src/pages/Campaigns.tsx',
  'client/src/pages/CampaignWizard.tsx',
  'client/src/pages/CampaignDetail.tsx',
  'client/public/locales/ar/translation.json',
  'client/public/locales/en/translation.json',
].join(' ');

try {
  const addOut = execSync('git add ' + files, { encoding: 'utf8' });
  out.push('add: ' + (addOut || 'ok'));
} catch(e) { out.push('add ERROR: ' + e.message); }

try {
  const msg = 'fix: campaign system overhaul - smooth Waalaxy-like flow\n\nCampaignWizard: use /launch endpoint, check session not extension\nCampaignDetail: remove dead tick polling, fix i18n hardcoded Arabic\nCampaigns list: status tabs + search + pause/resume per card\nTranslations: 25+ missing AR/EN keys added\n\nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>';
  const commitOut = execSync('git commit -m "' + msg.replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"', { encoding: 'utf8' });
  out.push('commit: ' + commitOut);
} catch(e) { out.push('commit ERROR: ' + e.message); }

try {
  const pushOut = execSync('git push origin master', { encoding: 'utf8', timeout: 60000 });
  out.push('push: ' + pushOut);
} catch(e) { out.push('push ERROR: ' + e.message); }

const result = out.join('\n');
console.log(result);
fs.writeFileSync('C:\\Users\\WIN11-24H2GPT\\Desktop\\git_result.txt', result, 'utf8');
