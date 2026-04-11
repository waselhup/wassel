const fs = require('fs');
const dir = fs.readdirSync('dist/assets');
const jsFile = dir.find(f => f.endsWith('.js') && f.startsWith('index-'));
if (!jsFile) { console.log('NO JS BUNDLE FOUND'); process.exit(1); }
const c = fs.readFileSync('dist/assets/' + jsFile, 'utf8');
console.log('FILE:', jsFile);
console.log('SIZE:', c.length);
console.log('HAS_ANON_KEY:', c.includes('eyJhbGci'));
console.log('HAS_SUPABASE_URL:', c.includes('hiqotmimlgsrsnovtopd'));
console.log('HAS_BUILD_VERSION:', c.includes('WASSEL v2.1'));
console.log('HAS_SUPABASE_LOG:', c.includes('[Supabase] Client initialized'));
