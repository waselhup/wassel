const fs = require('fs');
const buf = fs.readFileSync('client/src/pages/CVTailor.tsx');
console.log('First 10 bytes:', Array.from(buf.slice(0, 10)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
const s = fs.readFileSync('client/src/pages/CVTailor.tsx', 'utf8');
console.log('First 5 charCodes:', Array.from(s.slice(0, 5)).map(c => '0x' + c.charCodeAt(0).toString(16)).join(' '));
console.log('First 20 chars:', JSON.stringify(s.slice(0, 20)));
