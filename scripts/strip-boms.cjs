// Strip UTF-8 BOMs from all source files after every edit
const fs = require('fs');
const path = require('path');

const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.cjs', '.mjs', '.json', '.md'];
const SKIP_DIRS = ['node_modules', '.git', 'dist', 'api', '.next'];

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!SKIP_DIRS.includes(e.name)) walk(full);
    } else if (EXTENSIONS.includes(path.extname(e.name))) {
      const buf = fs.readFileSync(full);
      if (buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
        fs.writeFileSync(full, buf.slice(3));
        console.log('[strip-boms] cleaned:', full);
      }
    }
  }
}

walk(process.cwd());
