const fs = require('fs');
const base = 'C:\\Users\\WIN11-24H2GPT\\Desktop\\wassel-v2\\client\\src';

// Check CSS vars
const css = fs.readFileSync(base + '\\index.css', 'utf8');
const m1 = css.match(/--accent-primary:\s*([^;]+)/);
const m2 = css.match(/--accent-secondary:\s*([^;]+)/);
console.log('accent-primary:', m1 ? m1[1].trim() : 'NOT FOUND');
console.log('accent-secondary:', m2 ? m2[1].trim() : 'NOT FOUND');

// Check if WasselLogo exists
const logoExists = fs.existsSync(base + '\\..\\..\\..\\client\\src\\components\\WasselLogo.tsx');
const logoExists2 = fs.existsSync(base + '\\components\\WasselLogo.tsx');
console.log('WasselLogo exists:', logoExists, logoExists2);

// Check DashboardLayout for WasselLogo import
const dl = fs.readFileSync(base + '\\components\\DashboardLayout.tsx', 'utf8');
console.log('Has WasselLogo import:', dl.includes('WasselLogo'));
console.log('Has direction style:', dl.includes('direction:'));
console.log('Has borderInlineStart:', dl.includes('borderInlineStart'));
console.log('Has Link>a nesting:', dl.includes('<Link') && dl.includes('<a\n'));

// Check orange remnants
const hasOrange = css.includes('orange');
console.log('CSS has orange:', hasOrange);

// Check Payment.tsx
const pay = fs.readFileSync(base + '\\pages\\Payment.tsx', 'utf8');
console.log('Payment has orange:', pay.includes('orange'));
