const https = require('https');

// Read token from env or hardcode for debugging
const projJson = require('./.vercel/project.json');
console.log('Project ID:', projJson.projectId);
console.log('Org ID:', projJson.orgId);

// Just test if the API function responds at all
const options = {
  hostname: 'wassel.vercel.app',
  path: '/api/health',
  method: 'GET',
  headers: { 'Accept': 'application/json' }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Headers:', JSON.stringify(res.headers, null, 2));
    console.log('Body:', data.substring(0, 500));
  });
});
req.on('error', e => console.error('Error:', e.message));
req.end();
