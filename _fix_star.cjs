const fs = require('fs');
const path = require('path');

function writeNoBOM(filePath, content) {
  fs.writeFileSync(filePath, content, { encoding: 'utf8' });
  const buf = fs.readFileSync(filePath);
  if (buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
    fs.writeFileSync(filePath, buf.slice(3));
    console.log('  (stripped BOM)');
  }
}

const starFiles = [
  'client/src/components/landing/Features.tsx',
  'client/src/pages/CVTailor.tsx',
  'client/src/pages/DashboardHome.tsx',
  'client/src/pages/Tokens.tsx',
];

for (const f of starFiles) {
  const full = path.join('C:/Users/WIN11-24H2GPT/Desktop/wassel-v2', f);
  let c = fs.readFileSync(full, 'utf8');
  const re = /import\s*\{([^}]+)\}\s*from\s*['"]lucide-react['"]\s*;?/;
  const m = c.match(re);
  if (!m) { console.log('NO IMPORT FOUND:', f); continue; }
  const names = m[1].split(',').map(s => s.trim()).filter(Boolean);
  if (names.includes('Star')) { console.log('Already has Star:', f); continue; }
  names.push('Star');
  const newImport = "import { " + names.join(', ') + " } from 'lucide-react';";
  c = c.replace(re, newImport);
  writeNoBOM(full, c);
  console.log('FIXED:', f);
}

const paPath = 'C:/Users/WIN11-24H2GPT/Desktop/wassel-v2/client/src/pages/ProfileAnalysis.tsx';
let pa = fs.readFileSync(paPath, 'utf8');

const before = "const analyzeDeep = trpc.linkedin.analyzeDeep.useMutation();";
const after = "// analyzeDeep client method (uses fetch wrapper)\n  const callAnalyzeDeep = async (input: { imageBase64?: string; mediaType?: string; profileUrl?: string }) => {\n    const { trpcMutation } = await import('../lib/trpc');\n    return trpcMutation('linkedin.analyzeDeep', input);\n  };";
if (pa.includes(before)) {
  pa = pa.replace(before, after);
  console.log('FIXED ProfileAnalysis line 128');
}

const mutBefore = "await analyzeDeep.mutateAsync({";
const mutAfter = "await callAnalyzeDeep({";
if (pa.includes(mutBefore)) {
  pa = pa.replace(mutBefore, mutAfter);
  console.log('FIXED mutateAsync call');
}

pa = pa.replace(/analyzeDeep\.isPending|analyzeDeep\.isLoading/g, 'loading');
pa = pa.replace(/analyzeDeep\.data/g, 'result');

writeNoBOM(paPath, pa);

const trpcLib = fs.readFileSync('C:/Users/WIN11-24H2GPT/Desktop/wassel-v2/client/src/lib/trpc.ts', 'utf8');
console.log('trpcMutation exported:', /export\s+(async\s+)?function\s+trpcMutation/.test(trpcLib));