const fs = require('fs');
const path = require('path');

// 1. Strip BOMs from all source files
function stripBom(fp) {
  const buf = fs.readFileSync(fp);
  // Double-encoded BOM: C3 AF C2 BB C2 BF
  if (buf[0] === 0xC3 && buf[1] === 0xAF && buf[2] === 0xC2 && buf[3] === 0xBB && buf[4] === 0xC2 && buf[5] === 0xBF) {
    fs.writeFileSync(fp, buf.slice(6));
    console.log('Fixed double BOM: ' + fp);
    return true;
  }
  // Standard BOM: EF BB BF
  if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
    fs.writeFileSync(fp, buf.slice(3));
    console.log('Fixed standard BOM: ' + fp);
    return true;
  }
  return false;
}

function scanDir(dir, exts) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(f => {
    if (exts.some(e => f.endsWith(e))) {
      stripBom(path.join(dir, f));
    }
  });
}

const exts = ['.tsx', '.ts', '.css', '.json', '.svg', '.html'];
scanDir('client/src/pages', exts);
scanDir('client/src/components', exts);
scanDir('client/src/contexts', exts);
scanDir('client/src/lib', exts);
scanDir('client/src', exts);
scanDir('client/public/locales/ar', exts);
scanDir('client/public/locales/en', exts);
scanDir('client/public', exts);
scanDir('client', ['.html']);
scanDir('server/_core', exts);
console.log('--- BOM scan complete ---');

// 2. Replace old orange colors with teal in page files
const pageFiles = [
  'client/src/pages/DashboardHome.tsx',
  'client/src/pages/CampaignList.tsx',
  'client/src/pages/CampaignNew.tsx',
  'client/src/pages/LinkedInAnalyzer.tsx',
  'client/src/pages/CVTailor.tsx',
  'client/src/pages/Tokens.tsx',
  'client/src/pages/Profile.tsx',
  'client/src/pages/KnowledgeBase.tsx',
  'client/src/pages/Onboarding.tsx',
  'client/src/pages/Payment.tsx',
  'client/src/pages/AdminDashboard.tsx',
  'client/src/pages/AdminUsers.tsx',
  'client/src/pages/AdminCampaigns.tsx',
  'client/src/pages/AdminSettings.tsx',
  'client/src/pages/CampaignReport.tsx',
];

let colorFixed = 0;
pageFiles.forEach(fp => {
  if (!fs.existsSync(fp)) return;
  let s = fs.readFileSync(fp, 'utf8');
  const orig = s;
  
  // Replace hex colors
  s = s.replace(/#ff6b35/gi, '#0A8F84');
  s = s.replace(/#FF6B35/g, '#0A8F84');
  s = s.replace(/#1e3a5f/gi, '#0B1220');
  s = s.replace(/#1E3A5F/g, '#0B1220');
  
  // Replace Tailwind arbitrary values
  s = s.replace(/bg-\[#ff6b35\]/gi, 'bg-[#0A8F84]');
  s = s.replace(/text-\[#ff6b35\]/gi, 'text-[#0A8F84]');
  s = s.replace(/border-\[#ff6b35\]/gi, 'border-[#0A8F84]');
  s = s.replace(/bg-\[#1e3a5f\]/gi, 'bg-[#0B1220]');
  s = s.replace(/text-\[#1e3a5f\]/gi, 'text-[#0B1220]');
  
  // Replace common Tailwind orange classes with teal equivalents
  s = s.replace(/bg-orange-500/g, 'bg-teal-600');
  s = s.replace(/bg-orange-600/g, 'bg-teal-700');
  s = s.replace(/text-orange-500/g, 'text-teal-600');
  s = s.replace(/text-orange-600/g, 'text-teal-700');
  s = s.replace(/border-orange-500/g, 'border-teal-600');
  s = s.replace(/hover:bg-orange-600/g, 'hover:bg-teal-700');
  s = s.replace(/hover:bg-orange-500/g, 'hover:bg-teal-600');
  s = s.replace(/from-orange-500/g, 'from-teal-600');
  s = s.replace(/to-orange-600/g, 'to-teal-700');
  s = s.replace(/ring-orange-500/g, 'ring-teal-600');
  
  // Replace blue-navy with ink
  s = s.replace(/bg-\[#2a5a8f\]/gi, 'bg-[#064E49]');
  s = s.replace(/text-\[#2a5a8f\]/gi, 'text-[#064E49]');
  
  if (s !== orig) {
    fs.writeFileSync(fp, s, 'utf8');
    console.log('Updated colors: ' + fp);
    colorFixed++;
  }
});

console.log('--- Color replacements: ' + colorFixed + ' files updated ---');
console.log('DONE');
