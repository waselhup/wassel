const fs = require('fs');
const path = require('path');
let bomCount = 0;
function stripBoms(dir) {
  for (const e of fs.readdirSync(dir, {withFileTypes:true})) {
    const fp = path.join(dir, e.name);
    if (e.isDirectory() && e.name !== 'node_modules' && !e.name.startsWith('.')) stripBoms(fp);
    else if (e.isFile() && /\.(tsx?|jsx?)$/.test(e.name)) {
      const buf = fs.readFileSync(fp);
      if (buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
        fs.writeFileSync(fp, buf.slice(3));
        bomCount++;
        console.log('BOM: ' + e.name);
      } else if (buf.length >= 6 && buf[0] === 0xC3 && buf[1] === 0xAF && buf[2] === 0xC2) {
        fs.writeFileSync(fp, buf.slice(6));
        bomCount++;
        console.log('DblBOM: ' + e.name);
      }
    }
  }
}
stripBoms('client/src');
stripBoms('server');
console.log('Total BOMs: ' + bomCount);