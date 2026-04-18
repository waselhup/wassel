// After every commit, if message contains "lesson:" or "decision:" or "bug:",
// auto-create a raw/conversations/ entry so Claude can ingest it later.
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

try {
  const msg = execSync('git log -1 --pretty=%B').toString().trim();
  const hash = execSync('git rev-parse --short HEAD').toString().trim();
  const date = new Date().toISOString().slice(0, 10);

  const keywords = ['lesson:', 'decision:', 'bug:', 'feat:', 'fix:'];
  const hit = keywords.find(k => msg.toLowerCase().includes(k));
  if (!hit) process.exit(0);

  const dir = path.join(process.cwd(), 'wassel-wiki', 'raw', 'commits');
  fs.mkdirSync(dir, { recursive: true });

  const filename = `${date}-${hash}.md`;
  const content = `---\nsource: git\ndate: ${date}\ncommit: ${hash}\n---\n\n${msg}\n`;
  fs.writeFileSync(path.join(dir, filename), content, 'utf8');
  console.log(`[auto-ingest] filed ${filename}`);
} catch (e) {
  // non-fatal
}
