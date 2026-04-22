const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const skip = new Set(['node_modules', '.git', '.next', '.vercel', 'dist', 'build', '.claude']);
const exts = new Set(['.tsx', '.ts', '.css']);
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
  if (!rel.startsWith('client/src/')) return;
  // Keep legacy index.css and v4 landing components untouched — they use --brand already
  // Focus: auth pages, dashboard, tool pages, admin
  let src = fs.readFileSync(p, 'utf8');
  const orig = src;

  // Replace common old teal colors with v4 brand var
  src = src.replace(/#0A8F84/g, '#14b8a6');
  src = src.replace(/#12B5A8/g, '#0d9488');
  src = src.replace(/#064E49/g, '#0f766e');
  src = src.replace(/#043530/g, '#0f766e');

  if (src !== orig) {
    fs.writeFileSync(p, src, 'utf8');
    touched++;
    console.log('TOUCHED', rel);
  }
}

walk(path.join(root, 'client', 'src'));
console.log('Total touched:', touched);
