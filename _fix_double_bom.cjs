const fs = require('fs');
const path = require('path');
let fixed = 0;
function fixDir(dir) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).filter(f => f.endsWith('.tsx') || f.endsWith('.ts') || f.endsWith('.json')).forEach(f => {
    const fp = path.join(dir, f);
    const buf = fs.readFileSync(fp);
    // Check double-encoded BOM: C3 AF C2 BB C2 BF
    if (buf[0] === 0xC3 && buf[1] === 0xAF && buf[2] === 0xC2 && buf[3] === 0xBB && buf[4] === 0xC2 && buf[5] === 0xBF) {
      fs.writeFileSync(fp, buf.slice(6));
      console.log('Fixed DOUBLE BOM: ' + fp);
      fixed++;
    }
    // Check standard BOM: EF BB BF
    else if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
      fs.writeFileSync(fp, buf.slice(3));
      console.log('Fixed standard BOM: ' + fp);
      fixed++;
    }
  });
}
fixDir('client/src/pages');
fixDir('client/src/components');
fixDir('client/src/contexts');
fixDir('client/src/lib');
fixDir('client/src');
fixDir('client/public/locales/ar');
fixDir('client/public/locales/en');
fixDir('server/_core');
console.log('Total fixed: ' + fixed);
