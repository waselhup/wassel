const fs = require('fs');
const b = fs.readFileSync('client/public/locales/ar/translation.json');
console.log('First 5 bytes:', b[0], b[1], b[2], b[3], b[4]);
console.log('Length:', b.length);
// Try stripping BOM and parsing
let s = b.toString('utf8');
console.log('First charCode:', s.charCodeAt(0), s.charCodeAt(1));
s = s.replace(/^\uFEFF/, '').replace(/^\xEF\xBB\xBF/, '');
console.log('After strip charCode:', s.charCodeAt(0));
try {
  JSON.parse(s);
  console.log('JSON parse OK');
} catch(e) {
  console.log('Still fails, trying trim...');
  s = s.trim();
  console.log('Trimmed charCode:', s.charCodeAt(0));
  try { JSON.parse(s); console.log('JSON parse OK after trim'); }
  catch(e2) { console.log('FAIL:', e2.message); }
}
