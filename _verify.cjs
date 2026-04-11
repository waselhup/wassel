const fs = require('fs');
const buf = fs.readFileSync('client/src/pages/CVTailor.tsx');
console.log('CVTailor first 5 bytes:', Array.from(buf.slice(0,5)).map(x => '0x'+x.toString(16)).join(' '));
console.log('Starts with import:', buf.slice(0,6).toString('utf8'));
