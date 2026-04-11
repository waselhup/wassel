const fs = require('fs');
const base = 'C:\\Users\\WIN11-24H2GPT\\Desktop\\wassel-v2\\client\\src';
let issues = [];

// 1. Check CSS vars
const css = fs.readFileSync(base + '\\index.css', 'utf8');
if (!css.includes('--accent-primary: #0A8F84')) issues.push('CSS accent-primary not teal');
if (!css.includes('--accent-secondary: #C9922A')) issues.push('CSS accent-secondary not gold');
if (css.includes('orange')) issues.push('CSS still has orange');
if (!css.includes('--wsl-teal')) issues.push('CSS missing --wsl-teal vars');

// 2. Check DashboardLayout
const dl = fs.readFileSync(base + '\\components\\DashboardLayout.tsx', 'utf8');
if (!dl.includes('WasselLogo')) issues.push('DashboardLayout missing WasselLogo');
if (!dl.includes('borderInlineEnd') && !dl.includes('borderInlineStart')) issues.push('DashboardLayout missing logical borders');

// 3. Check WasselLogo exists
if (!fs.existsSync(base + '\\components\\WasselLogo.tsx')) issues.push('WasselLogo.tsx missing');

// 4. Check pages for orange
const pages = ['DashboardHome','CampaignList','CampaignNew','LinkedInAnalyzer','CVTailor','Tokens','Profile','Payment'];
for (const p of pages) {
  const fp = base + '\\pages\\' + p + '.tsx';
  if (fs.existsSync(fp)) {
    const c = fs.readFileSync(fp, 'utf8');
    if (c.includes('#ff6b35') || c.includes('#FF6B35')) issues.push(p + ' has old orange #ff6b35');
    if (c.includes('#1e3a5f')) issues.push(p + ' has old navy #1e3a5f');
  }
}

// 5. Check favicon
if (!fs.existsSync(base + '\\..\\..\\public\\favicon.svg')) issues.push('favicon.svg missing');

// 6. Check landing components
const landingDir = base + '\\components\\landing';
if (fs.existsSync(landingDir)) {
  const files = fs.readdirSync(landingDir);
  for (const f of files) {
    const c = fs.readFileSync(landingDir + '\\' + f, 'utf8');
    if (c.includes('#ff6b35')) issues.push('Landing ' + f + ' has #ff6b35');
  }
}

if (issues.length === 0) {
  console.log('ALL CHECKS PASSED - brand update is complete on disk');
} else {
  console.log('ISSUES FOUND:');
  issues.forEach(i => console.log('  -', i));
}
