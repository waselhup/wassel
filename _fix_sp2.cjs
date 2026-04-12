const fs = require('fs');

const fixes = [
  {
    file: 'client/src/components/landing/Features.tsx',
    find: 'icon: Sparkles,',
    replace: 'icon: Star,',
    importFind: /Sparkles/g,
    importReplace: 'Star'
  },
  {
    file: 'client/src/pages/CVTailor.tsx',
    find: 'icon: Sparkles',
    replace: 'icon: Star',
    importFind: /Sparkles/g,
    importReplace: 'Star'
  },
  {
    file: 'client/src/pages/DashboardHome.tsx',
    find: 'icon: Sparkles,',
    replace: 'icon: Star,',
    importFind: /Sparkles/g,
    importReplace: 'Star'
  },
  {
    file: 'client/src/pages/Tokens.tsx',
    find: 'icon: Sparkles,',
    replace: 'icon: Star,',
    importFind: /Sparkles/g,
    importReplace: 'Star'
  },
];

for (const fix of fixes) {
  let c = fs.readFileSync(fix.file, 'utf8');
  if (c.charCodeAt(0) === 0xFEFF) c = c.slice(1);

  // Replace all 'Sparkles' with 'Star' (both in import and usage)
  c = c.replace(fix.importFind, fix.importReplace);

  fs.writeFileSync(fix.file, c, 'utf8');
  console.log('Fixed: ' + fix.file);
}

// Verify
const path = require('path');
function checkDir(dir) {
  let count = 0;
  for (const e of fs.readdirSync(dir, {withFileTypes:true})) {
    const fp = path.join(dir, e.name);
    if (e.isDirectory() && e.name !== 'node_modules') count += checkDir(fp);
    else if (e.isFile() && fp.endsWith('.tsx') && fs.readFileSync(fp,'utf8').includes('Sparkles')) {
      console.log('STILL: ' + fp);
      count++;
    }
  }
  return count;
}
const rem = checkDir('client/src');
console.log('\nRemaining Sparkles: ' + rem);