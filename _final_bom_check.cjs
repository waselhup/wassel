const fs = require('fs');
const path = require('path');
let total = 0;
function scan(dir, exts) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(f => {
    if (!exts.some(e => f.endsWith(e))) return;
    const fp = path.join(dir, f);
    const buf = fs.readFileSync(fp);
    if (buf[0] === 0xC3 && buf[1] === 0xAF && buf[2] === 0xC2 && buf[3] === 0xBB && buf[4] === 0xC2 && buf[5] === 0xBF) {
      fs.writeFileSync(fp, buf.slice(6));
      console.log('FIXED double: ' + fp);
      total++;
    } else if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
      fs.writeFileSync(fp, buf.slice(3));
      console.log('FIXED std: ' + fp);
      total++;
    }
  });
}
const e = ['.tsx','.ts','.css','.json','.svg','.html','.jsx'];
scan('client/src/pages', e);
scan('client/src/components', e);
scan('client/src/contexts', e);
scan('client/src/lib', e);
scan('client/src', e);
scan('client/public/locales/ar', e);
scan('client/public/locales/en', e);
scan('client/public', e);
scan('client', e);
scan('server/_core', e);
console.log('Total fixed: ' + total);
