/**
 * Generate Wassel favicon PNG set from the SpinningLogo design.
 * Renders directly with @napi-rs/canvas — no SVG-to-canvas dependency.
 *
 * Outputs:
 *   client/public/favicon.ico            (multi-size 16/32/48 PNG-in-ICO)
 *   client/public/favicons/favicon-16x16.png
 *   client/public/favicons/favicon-32x32.png
 *   client/public/favicons/favicon-48x48.png
 *   client/public/favicons/apple-touch-icon.png   (180×180, white bg)
 *   client/public/favicons/android-chrome-192x192.png
 *   client/public/favicons/android-chrome-512x512.png
 *
 * Re-run with: node scripts/generate-favicons.cjs
 */

const { createCanvas } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');

const PUBLIC = path.resolve(__dirname, '..', 'client', 'public');
const FAV_DIR = path.join(PUBLIC, 'favicons');
fs.mkdirSync(FAV_DIR, { recursive: true });

/**
 * Draw the Wassel mark scaled to `px`. `withBg` paints a white background
 * (used for apple-touch-icon, which iOS prefers solid).
 */
function drawMark(ctx, px, withBg) {
  // Coordinate space scaled from the 80×80 logo viewBox.
  const s = px / 80;

  if (withBg) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, px, px);
  } else {
    ctx.clearRect(0, 0, px, px);
  }

  // Outer soft ring (#99f6e4 @ 45% opacity)
  ctx.strokeStyle = 'rgba(153, 246, 228, 0.45)';
  ctx.lineWidth = 3 * s;
  ctx.beginPath();
  ctx.arc(40 * s, 40 * s, 32 * s, 0, Math.PI * 2);
  ctx.stroke();

  // Active arc — quarter ring with rounded caps, teal gradient
  const grad = ctx.createLinearGradient(0, 0, px, px);
  grad.addColorStop(0, '#0d9488');
  grad.addColorStop(1, '#14b8a6');
  ctx.strokeStyle = grad;
  ctx.lineWidth = 4 * s;
  ctx.lineCap = 'round';
  ctx.beginPath();
  // start at top (rotate -90deg), arc length matches dasharray 48 of full 200 ≈ 24%
  const start = -Math.PI / 2;
  const end = start + Math.PI * 2 * (48 / (2 * Math.PI * 32)); // dasharray 48 over circumference 2*pi*32
  ctx.arc(40 * s, 40 * s, 32 * s, start, end);
  ctx.stroke();

  // Center core — filled teal disc
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(40 * s, 40 * s, 14 * s, 0, Math.PI * 2);
  ctx.fill();

  // Gold accent
  ctx.fillStyle = '#C9922A';
  ctx.beginPath();
  ctx.arc(62 * s, 18 * s, 3.5 * s, 0, Math.PI * 2);
  ctx.fill();
}

function renderPng(px, withBg = false) {
  const canvas = createCanvas(px, px);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  drawMark(ctx, px, withBg);
  return canvas.toBuffer('image/png');
}

const targets = [
  { name: 'favicon-16x16.png', size: 16, bg: false, dir: FAV_DIR },
  { name: 'favicon-32x32.png', size: 32, bg: false, dir: FAV_DIR },
  { name: 'favicon-48x48.png', size: 48, bg: false, dir: FAV_DIR },
  { name: 'apple-touch-icon.png', size: 180, bg: true, dir: FAV_DIR },
  { name: 'android-chrome-192x192.png', size: 192, bg: false, dir: FAV_DIR },
  { name: 'android-chrome-512x512.png', size: 512, bg: false, dir: FAV_DIR },
];

for (const t of targets) {
  const buf = renderPng(t.size, t.bg);
  fs.writeFileSync(path.join(t.dir, t.name), buf);
  console.log('  wrote', path.relative(PUBLIC, path.join(t.dir, t.name)), `(${buf.length} bytes)`);
}

// === Build a multi-resolution favicon.ico (16, 32, 48) ===
// ICO format: 6-byte header, n × 16-byte entries, then PNG data per entry.
// PNG-in-ICO is widely supported (Vista+ on Windows, all modern browsers).
function buildIco(pngBuffers) {
  const count = pngBuffers.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);     // reserved
  header.writeUInt16LE(1, 2);     // type: 1 = ICO
  header.writeUInt16LE(count, 4); // image count

  const entries = Buffer.alloc(16 * count);
  let offset = header.length + entries.length;
  const ordered = [];

  pngBuffers.forEach(({ size, buf }, i) => {
    const e = i * 16;
    entries.writeUInt8(size === 256 ? 0 : size, e + 0); // width (0 = 256)
    entries.writeUInt8(size === 256 ? 0 : size, e + 1); // height
    entries.writeUInt8(0, e + 2);                       // palette
    entries.writeUInt8(0, e + 3);                       // reserved
    entries.writeUInt16LE(1, e + 4);                    // color planes
    entries.writeUInt16LE(32, e + 6);                   // bpp
    entries.writeUInt32LE(buf.length, e + 8);           // size
    entries.writeUInt32LE(offset, e + 12);              // offset
    ordered.push(buf);
    offset += buf.length;
  });

  return Buffer.concat([header, entries, ...ordered]);
}

const icoBuf = buildIco([
  { size: 16, buf: renderPng(16) },
  { size: 32, buf: renderPng(32) },
  { size: 48, buf: renderPng(48) },
]);
fs.writeFileSync(path.join(PUBLIC, 'favicon.ico'), icoBuf);
console.log('  wrote favicon.ico', `(${icoBuf.length} bytes, multi-res 16/32/48)`);

console.log('\nDone. Favicons written under client/public/favicons/ + favicon.ico at root.');
