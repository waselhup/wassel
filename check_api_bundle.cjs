const fs = require('fs');
const c = fs.readFileSync('api/index.js', 'utf8');
const lines = c.split('\n');
console.log('Total lines:', lines.length);
console.log('File size:', (c.length / 1024).toFixed(0), 'KB');

// Check for module.exports
const hasExport = c.includes('module.exports');
console.log('Has module.exports:', hasExport);

// Find module.exports location
const idx = c.lastIndexOf('module.exports');
if (idx !== -1) {
  console.log('Last module.exports at char:', idx);
  console.log('Context:', c.substring(idx, idx + 200));
}

// Check first line for CJS marker
console.log('First 100 chars:', c.substring(0, 100));
