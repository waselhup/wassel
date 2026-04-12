const fs = require('fs');
let c = fs.readFileSync('client/src/pages/LandingPage.tsx', 'utf8');
if (c.charCodeAt(0) === 0xFEFF) c = c.slice(1);
console.log('=== FULL CONTENT ===');
console.log(c);