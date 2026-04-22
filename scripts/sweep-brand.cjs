const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const skip = new Set(['node_modules', '.git', '.next', '.vercel', 'dist', 'build', '.claude']);
const exts = new Set(['.tsx', '.ts', '.js', '.jsx', '.json', '.md', '.html', '.txt', '.mjs']);
let touched = 0;

function walk(p) {
  const name = path.basename(p);
  if (skip.has(name)) return;
  let st;
  try { st = fs.statSync(p); } catch { return; }
  if (st.isDirectory()) {
    for (const f of fs.readdirSync(p)) walk(path.join(p, f));
    return;
  }
  if (!exts.has(path.extname(p))) return;
  const rel = path.relative(root, p).split(path.sep).join('/');
  if (rel.startsWith('.claude/') || rel.startsWith('node_modules/') || rel.startsWith('api/') ||
      rel.startsWith('wassel-wiki/') || rel.startsWith('.vercel/') || rel.startsWith('reference/') ||
      rel.startsWith('test-outputs/') || rel.startsWith('server/') || rel.startsWith('scripts/')) return;

  let src = fs.readFileSync(p, 'utf8');
  const orig = src;

  // Shadda removal: literal + unicode escape forms
  src = src.replace(/\u0648\u0635\u0651\u0644/g, '\u0648\u0635\u0644');
  src = src.replace(/\\u0648\\u0635\\u0651\\u0644/g, '\\u0648\\u0635\\u0644');

  // Location
  src = src.replace(/\u0627\u0644\u062f\u0645\u0627\u0645/g, '\u0627\u0644\u0623\u062d\u0633\u0627\u0621');
  src = src.replace(/Dammam/g, 'Al-Ahsa');
  src = src.replace(/dammam/g, 'al-ahsa');

  if (src !== orig) {
    fs.writeFileSync(p, src, 'utf8');
    touched++;
    console.log('TOUCHED', rel);
  }
}

walk(path.join(root, 'client'));
const claudePath = path.join(root, 'CLAUDE.md');
if (fs.existsSync(claudePath)) walk(claudePath);
console.log('Total touched:', touched);
