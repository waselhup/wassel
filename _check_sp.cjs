const fs = require('fs');
const files = [
  'client/src/components/landing/Features.tsx',
  'client/src/pages/CVTailor.tsx',
  'client/src/pages/DashboardHome.tsx',
  'client/src/pages/Tokens.tsx',
];
for (const fp of files) {
  const c = fs.readFileSync(fp, 'utf8');
  const lines = c.split('\n');
  console.log('\n=== ' + fp + ' ===');
  lines.forEach((line, i) => {
    if (line.includes('Sparkles')) console.log('  L' + (i+1) + ': ' + line.trim());
  });
}