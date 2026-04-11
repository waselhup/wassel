const fs = require('fs');
const files = [
  'client/src/components/WasselLogo.tsx',
  'client/src/components/DashboardLayout.tsx',
  'client/src/index.css',
  'client/index.html',
  'client/public/favicon.svg',
];
files.forEach(fp => {
  const buf = fs.readFileSync(fp);
  const hex = Array.from(buf.slice(0,6)).map(b => b.toString(16).padStart(2,'0')).join(' ');
  console.log(fp + ' starts: ' + hex);
  if (buf[0] === 0xC3 && buf[1] === 0xAF && buf[2] === 0xC2 && buf[3] === 0xBB && buf[4] === 0xC2 && buf[5] === 0xBF) {
    fs.writeFileSync(fp, buf.slice(6));
    console.log('  -> stripped double BOM');
  } else if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
    fs.writeFileSync(fp, buf.slice(3));
    console.log('  -> stripped standard BOM');
  } else {
    console.log('  -> clean');
  }
});
