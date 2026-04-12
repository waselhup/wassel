const fs = require('fs');
const path = require('path');

console.log('=== SPARKLES SCAN ===');
function scan(dir) {
  fs.readdirSync(dir).forEach(f => {
    const fp = path.join(dir, f);
    if (fs.statSync(fp).isDirectory()) { scan(fp); return; }
    if (!f.endsWith('.tsx') && !f.endsWith('.ts')) return;
    const c = fs.readFileSync(fp, 'utf8');
    if (c.includes('Sparkles')) {
      const lines = c.split('\n');
      lines.forEach((line, i) => {
        if (line.includes('Sparkles')) console.log(fp + ':' + (i+1) + ': ' + line.trim());
      });
    }
  });
}
scan('client/src');

console.log('\n=== VIDEODEMO EXPORT ===');
const vd = fs.readFileSync('client/src/components/landing/VideoDemo.tsx', 'utf8');
const expMatches = vd.match(/export\s+(default\s+)?(function|const|class)\s+\w+|export\s+default\s+\w+|export\s+\{[^}]*\}/g);
console.log('Exports found:', expMatches);
console.log('Has export default:', /export\s+default/.test(vd));

console.log('\n=== HERO KEYS ===');
['client/public/locales/ar/translation.json', 'client/public/locales/en/translation.json'].forEach(p => {
  try {
    const d = JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));
    console.log(p + ':');
    console.log('  hero.title:', d.hero && d.hero.title ? d.hero.title.substring(0, 80) : 'MISSING');
    console.log('  hero.title2:', d.hero && d.hero.title2 ? d.hero.title2 : 'MISSING');
    console.log('  hero.subtitle:', d.hero && d.hero.subtitle ? d.hero.subtitle.substring(0, 80) : 'MISSING');
  } catch(e) { console.log(p, 'ERROR:', e.message); }
});

console.log('\n=== LP H1 DETAIL ===');
const lp = fs.readFileSync('client/src/pages/LandingPage.tsx', 'utf8');
const h1Idx = lp.indexOf('<h1');
if (h1Idx > -1) {
  const h1End = lp.indexOf('</h1>', h1Idx);
  console.log(lp.substring(h1Idx, h1End + 5));
}