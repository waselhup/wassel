const fs = require('fs');
const s = fs.readFileSync('api/index.js', 'utf8');
console.log('has logApiCall:', s.includes('logApiCall'));
console.log('has api_logs:', s.includes('api_logs'));
console.log('has mapAnthropicStatusToArabic:', s.includes('mapAnthropicStatusToArabic'));
console.log('has systemStatus:', s.includes('systemStatus'));
console.log('has TELEGRAM_ALERT_SENT:', s.includes('TELEGRAM_ALERT_SENT'));
console.log('has analyzeDeep:', s.includes('analyzeDeep'));
console.log('size KB:', Math.round(s.length / 1024));
