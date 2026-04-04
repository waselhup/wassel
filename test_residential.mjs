import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';

const proxyUrl = 'http://brd-customer-hl_1f8061cb-zone-residential_proxy1:xqs290duflmh@brd.superproxy.io:33335';
const agent = new HttpsProxyAgent(proxyUrl, { rejectUnauthorized: false });

console.log('Testing RESIDENTIAL proxy against LinkedIn Voyager API...');
try {
  const res = await fetch('https://www.linkedin.com/voyager/api/me', {
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'accept': 'application/vnd.linkedin.normalized+json+2.1',
      'x-restli-protocol-version': '2.0.0',
    },
    redirect: 'manual',
    agent,
  });
  console.log('Status:', res.status);
  const hdrs = {};
  res.headers.forEach((v, k) => hdrs[k] = v);
  console.log('Key headers:', JSON.stringify({
    'x-brd-error': hdrs['x-brd-error'] || 'none',
    'location': hdrs['location'] || 'none',
    'content-type': hdrs['content-type'] || 'none',
  }, null, 2));
} catch (e) {
  console.error('Error:', e.message);
}
