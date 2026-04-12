const fs = require('fs');
const path = require('path');

const sparklesFiles = [
  'client/src/components/AuthLayout.tsx',
  'client/src/components/landing/Features.tsx',
  'client/src/pages/CampaignNew.tsx',
  'client/src/pages/CVTailor.tsx',
  'client/src/pages/DashboardHome.tsx',
  'client/src/pages/LandingPage.tsx',
  'client/src/pages/Onboarding.tsx',
  'client/src/pages/Tokens.tsx',
];

let fixed = 0;
for (const fp of sparklesFiles) {
  if (!fs.existsSync(fp)) { console.log('SKIP (not found): ' + fp); continue; }
  let c = fs.readFileSync(fp, 'utf8');
  if (c.charCodeAt(0) === 0xFEFF) c = c.slice(1);
  if (!c.includes('Sparkles')) { console.log('SKIP (no Sparkles): ' + fp); continue; }

  const orig = c;

  // Step 1: Add WasselLogo import if missing
  if (!c.includes('WasselLogo')) {
    // Try to add after lucide-react import
    const lucideMatch = c.match(/import \{[^}]*\} from ['"]lucide-react['"];?\n/);
    if (lucideMatch) {
      const insertAfter = lucideMatch[0];
      // Determine correct relative path
      const dir = path.dirname(fp).replace(/\\/g,'/');
      let relPath;
      if (dir.includes('components/landing')) {
        relPath = '../WasselLogo';
      } else if (dir.includes('components')) {
        relPath = './WasselLogo';
      } else if (dir.includes('pages')) {
        relPath = '../components/WasselLogo';
      }
      c = c.replace(insertAfter, insertAfter + "import { WasselLogo } from '" + relPath + "';\n");
    }
  }

  // Step 2: Remove Sparkles from lucide imports
  // Handle: Sparkles at start, middle, or end of import list
  c = c.replace(/import \{([^}]*)\} from ['"]lucide-react['"];?/g, (match, imports) => {
    const items = imports.split(',').map(s => s.trim()).filter(s => s && s !== 'Sparkles');
    if (items.length === 0) return '// lucide-react import cleaned';
    return "import { " + items.join(', ') + " } from 'lucide-react';";
  });

  // Step 3: Replace <Sparkles .../> JSX with <WasselLogo size={44} />
  // Various patterns: <Sparkles size={X} className="..." />, <Sparkles className="..." size={X} />
  c = c.replace(/<Sparkles\b[^>]*\/>/g, '<WasselLogo size={44} />');

  if (c !== orig) {
    fs.writeFileSync(fp, c, 'utf8');
    console.log('FIXED: ' + fp);
    fixed++;
  } else {
    console.log('NO CHANGE: ' + fp);
  }
}

console.log('\nTotal fixed: ' + fixed + ' files');

// Verify no Sparkles remain
let remaining = 0;
function checkDir(dir) {
  for (const e of fs.readdirSync(dir, {withFileTypes:true})) {
    const fp = path.join(dir, e.name);
    if (e.isDirectory() && e.name !== 'node_modules') checkDir(fp);
    else if (e.isFile() && fp.endsWith('.tsx')) {
      const c = fs.readFileSync(fp, 'utf8');
      if (c.includes('Sparkles') && !fp.includes('node_modules')) {
        console.log('STILL HAS Sparkles: ' + fp);
        remaining++;
      }
    }
  }
}
checkDir('client/src');
console.log('Remaining Sparkles files: ' + remaining);