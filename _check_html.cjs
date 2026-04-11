const fs = require('fs');
const html = fs.readFileSync('C:\\Users\\WIN11-24H2GPT\\Desktop\\wassel-v2\\client\\index.html', 'utf8');
console.log(html.includes('favicon.svg') ? 'favicon.svg referenced OK' : 'MISSING favicon.svg reference');
console.log(html.substring(0, 500));
