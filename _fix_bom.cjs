const fs = require('fs');
const path = require('path');
const dir = 'client/src/pages';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx') || f.endsWith('.ts'));
let fixed = 0;
files.forEach(f => {
  const fp = path.join(dir, f);
  let s = fs.readFileSync(fp, 'utf8');
  if (s.charCodeAt(0) === 0xFEFF) {
    s = s.slice(1);
    fs.writeFileSync(fp, s, 'utf8');
    console.log('Fixed BOM in: ' + f);
    fixed++;
  }
});
// Also check components
const dir2 = 'client/src/components';
const files2 = fs.readdirSync(dir2).filter(f => f.endsWith('.tsx') || f.endsWith('.ts'));
files2.forEach(f => {
  const fp = path.join(dir2, f);
  let s = fs.readFileSync(fp, 'utf8');
  if (s.charCodeAt(0) === 0xFEFF) {
    s = s.slice(1);
    fs.writeFileSync(fp, s, 'utf8');
    console.log('Fixed BOM in: ' + f);
    fixed++;
  }
});
console.log('Total fixed: ' + fixed);
