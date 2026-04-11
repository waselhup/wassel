const fs = require('fs');
const svg = '<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">\n  <rect width="32" height="32" rx="8" fill="#0A8F84"/>\n  <text x="16" y="23" text-anchor="middle" font-family="Cairo, sans-serif" font-weight="900" font-size="19" fill="white">\u0648</text>\n  <circle cx="25" cy="7" r="4" fill="#C9922A"/>\n</svg>';
fs.writeFileSync('C:\\Users\\WIN11-24H2GPT\\Desktop\\wassel-v2\\client\\public\\favicon.svg', svg, 'utf8');
console.log('favicon.svg created');
