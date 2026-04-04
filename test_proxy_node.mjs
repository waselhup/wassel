import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';

const proxyUrl = 'http://brd-customer-hl_1f8061cb-zone-web_unlocker1:qk43bzokyf2c@brd.superproxy.io:33335';
const agent = new HttpsProxyAgent(proxyUrl, { rejectUnauthorized: false });

console.log('Test 1: Simple LinkedIn homepage via node-fetch...');
try {
  const res = await fetch('https://www.linkedin.com', {
    headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    redirect: 'manual',
    agent,
  });
  console.log('Status:', res.status);
} catch (e) {
  console.error('Error:', e.message);
}

console.log('\nTest 2: LinkedIn Voyager API via node-fetch...');
try {
  const res2 = await fetch('https://www.linkedin.com/voyager/api/me', {
    headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    redirect: 'manual',
    agent,
  });
  console.log('Status:', res2.status);
  const hdrs = {};
  res2.headers.forEach((v, k) => hdrs[k] = v);
  console.log('Headers:', JSON.stringify(hdrs, null, 2));
} catch (e) {
  console.error('Error:', e.message);
}
