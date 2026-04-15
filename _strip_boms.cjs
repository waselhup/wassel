const fs = require('fs');
const path = require('path');

function walk(dir, cb) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name === '.git' || name === '.next' || name === 'api') continue;
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, cb);
    else cb(full);
  }
}

let stripped = 0;
const roots = ['server', 'client/src'];
for (const root of roots) {
  if (!fs.existsSync(root)) continue;
  walk(root, (f) => {
    if (!/\.(ts|tsx|json)$/.test(f)) return;
    const b = fs.readFileSync(f);
    if (b.length >= 3 && b[0] === 0xEF && b[1] === 0xBB && b[2] === 0xBF) {
      fs.writeFileSync(f, b.slice(3));
      stripped++;
      console.log('stripped:', f);
    }
  });
}
console.log('Total BOMs stripped:', stripped);
