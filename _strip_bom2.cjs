const fs = require('fs');
const path = require('path');
let fixed = 0;
function scan(dir) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  for (const f of files) {
    const fp = path.join(dir, f.name);
    if (f.isDirectory() && f.name !== 'node_modules' && !f.name.startsWith('.')) {
      scan(fp);
    } else if (f.isFile() && /\.(tsx?|css)$/.test(f.name)) {
      const b = fs.readFileSync(fp);
      let start = 0;
      if (b.length >= 6 && b[0]===0xC3 && b[1]===0xAF && b[2]===0xC2 && b[3]===0xBB && b[4]===0xC2 && b[5]===0xBF) {
        start = 6;
      } else if (b.length >= 3 && b[0]===0xEF && b[1]===0xBB && b[2]===0xBF) {
        start = 3;
      }
      if (start > 0) {
        fs.writeFileSync(fp, b.slice(start));
        console.log('Fixed BOM:', fp);
        fixed++;
      }
    }
  }
}
scan(path.join('C:\\Users\\WIN11-24H2GPT\\Desktop\\wassel-v2', 'client', 'src'));
console.log('Done. Fixed', fixed, 'files');
