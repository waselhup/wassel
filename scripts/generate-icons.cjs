const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// Use the first command-line arg as the input path, or default
const INPUT = process.argv[2] || path.join(__dirname, '..', 'icon-source.jpeg');
const OUT_DIR = path.join(__dirname, '..', 'apps', 'extension', 'icons');

if (!fs.existsSync(INPUT)) {
  console.error('❌ Input file not found:', INPUT);
  process.exit(1);
}

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const sizes = [16, 32, 48, 128];

Promise.all(sizes.map(size =>
  sharp(INPUT)
    .resize(size, size, { fit: 'cover' })
    .png()
    .toFile(path.join(OUT_DIR, `icon${size}.png`))
    .then(() => console.log(`✅ icon${size}.png created (${size}x${size})`))
)).then(() => console.log('\n🎉 All icons generated in', OUT_DIR))
  .catch(err => { console.error('❌ Error:', err.message); process.exit(1); });
