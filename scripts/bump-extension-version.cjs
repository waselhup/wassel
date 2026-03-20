/**
 * Wassel Extension — Version Bump Script
 *
 * Usage:
 *   node scripts/bump-extension-version.js "Description of changes" "file1.js, file2.js"
 *
 * - Reads current version from apps/extension/manifest.json
 * - Increments the patch number (e.g. 1.1.0 → 1.1.1)
 * - Writes new version back to manifest.json
 * - Creates/appends to apps/extension/CHANGELOG.md
 */

const fs = require('fs');
const path = require('path');

const MANIFEST_PATH = path.resolve(__dirname, '..', 'apps', 'extension', 'manifest.json');
const CHANGELOG_PATH = path.resolve(__dirname, '..', 'apps', 'extension', 'CHANGELOG.md');

// --- Read manifest ---
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
const oldVersion = manifest.version;
const parts = oldVersion.split('.').map(Number);

if (parts.length !== 3) {
  console.error(`❌ Invalid version format: "${oldVersion}" — expected major.minor.patch`);
  process.exit(1);
}

// --- Bump patch ---
parts[2] += 1;
const newVersion = parts.join('.');
manifest.version = newVersion;

// --- Write manifest ---
fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');

// --- Build changelog entry ---
const description = process.argv[2] || 'No description provided';
const files = process.argv[3] || 'Not specified';
const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

const entry = [
  `## v${newVersion} — ${today}`,
  `- ${description}`,
  `- Files modified: ${files}`,
  '',
].join('\n');

// --- Create or prepend to CHANGELOG ---
if (fs.existsSync(CHANGELOG_PATH)) {
  const existing = fs.readFileSync(CHANGELOG_PATH, 'utf-8');
  // Insert after the title line
  const titleEnd = existing.indexOf('\n');
  if (titleEnd > 0) {
    const title = existing.slice(0, titleEnd + 1);
    const rest = existing.slice(titleEnd + 1);
    fs.writeFileSync(CHANGELOG_PATH, title + '\n' + entry + '\n' + rest, 'utf-8');
  } else {
    fs.writeFileSync(CHANGELOG_PATH, existing + '\n' + entry + '\n', 'utf-8');
  }
} else {
  const content = '# Wassel Extension Changelog\n\n' + entry + '\n';
  fs.writeFileSync(CHANGELOG_PATH, content, 'utf-8');
}

console.log(`✅ Extension bumped to v${newVersion}  (was v${oldVersion})`);
console.log(`📋 CHANGELOG updated: ${CHANGELOG_PATH}`);
