const fs = require('fs');
const c = fs.readFileSync('C:\\Users\\WIN11-24H2GPT\\Desktop\\wassel-v2\\server\\_core\\routes\\linkedin.ts', 'utf8');
console.log('Lines:', c.split('\n').length);
console.log('Has isArabicName:', c.includes('isArabicName'));
console.log('Has max_tokens 3000:', c.includes('3000'));
console.log('Has scoreBreakdown:', c.includes('scoreBreakdown'));
console.log('Has actionPlan:', c.includes('actionPlan'));
console.log('First 200 chars:', c.substring(0, 200));
