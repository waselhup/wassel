const fs = require('fs');
const path = require('path');
function fixDir(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx') || f.endsWith('.ts'));
  files.forEach(f => {
    const fp = path.join(dir, f);
    const buf = fs.readFileSync(fp);
    if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
      fs.writeFileSync(fp, buf.slice(3));
      console.log('Fixed raw BOM: ' + fp);
    } else {
      let s = fs.readFileSync(fp, 'utf8');
      if (s.charCodeAt(0) === 0xFEFF) {
        fs.writeFileSync(fp, s.slice(1), 'utf8');
        console.log('Fixed FEFF BOM: ' + fp);
      }
    }
  });
}
fixDir('client/src/pages');
fixDir('client/src/components');
fixDir('client/src/contexts');
fixDir('client/src/lib');
fixDir('client/src');
console.log('Done scanning all dirs');
