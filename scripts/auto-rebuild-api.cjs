// Rebuild api/index.js only if server/_core/* was touched recently
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SERVER_DIR = path.join(process.cwd(), 'server', '_core');
const API_OUT = path.join(process.cwd(), 'api', 'index.js');

if (!fs.existsSync(SERVER_DIR)) process.exit(0);

function latestMtime(dir) {
  let latest = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    const stat = fs.statSync(full);
    if (e.isDirectory()) {
      const sub = latestMtime(full);
      if (sub > latest) latest = sub;
    } else if (stat.mtimeMs > latest) latest = stat.mtimeMs;
  }
  return latest;
}

const serverM = latestMtime(SERVER_DIR);
const apiM = fs.existsSync(API_OUT) ? fs.statSync(API_OUT).mtimeMs : 0;

if (serverM > apiM) {
  console.log('[auto-rebuild] server/_core changed — rebuilding api/index.js');
  execSync(
    'npx esbuild server/_core/vercel.ts --platform=node --bundle --format=cjs --outfile=api/index.js',
    { stdio: 'inherit' }
  );
  console.log('[auto-rebuild] done.');
} else {
  console.log('[auto-rebuild] api/index.js up-to-date — skipping.');
}
