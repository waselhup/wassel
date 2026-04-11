const https = require('https');

const SUPABASE_URL = 'hiqotmimlgsrsnovtopd.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpcW90bWltbGdzcnNub3Z0b3BkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNDgwODcsImV4cCI6MjA4NzcyNDA4N30.jy0blU9Ph4BDmKRxVRP10yUdXKaqBbxI4kpr5SOA9yU';

function post(hostname, path, body, headers) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const opts = { hostname, path, method: 'POST', headers: { 'Content-Type': 'application/json', ...headers, 'Content-Length': Buffer.byteLength(data) } };
    const req = https.request(opts, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, data: d }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function get(hostname, path, headers) {
  return new Promise((resolve, reject) => {
    const opts = { hostname, path, headers };
    https.get(opts, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, data: d }));
    }).on('error', reject);
  });
}

async function main() {
  // Step 1: Sign in
  console.log('1. Signing in...');
  const signIn = await post(SUPABASE_URL, '/auth/v1/token?grant_type=password', {
    email: 'alhashimali649@gmail.com',
    password: 'Ali@2026'
  }, { 'apikey': ANON_KEY });

  let auth;
  try { auth = JSON.parse(signIn.data); } catch(e) { console.log('Parse fail:', signIn.data.substring(0,200)); return; }
  if (!auth.access_token) {
    console.log('Sign-in failed:', signIn.data.substring(0, 300));
    return;
  }
  console.log('   OK! Token:', auth.access_token.substring(0, 30) + '...');

  // Step 2: Call live API auth.profile
  console.log('2. GET auth.profile from live API...');
  const profile = await get('wassel-alpha.vercel.app', '/api/trpc/auth.profile', {
    'Authorization': 'Bearer ' + auth.access_token
  });
  console.log('   Status:', profile.status);
  console.log('   Body:', profile.data.substring(0, 500));

  // Step 3: Test campaign.previewMessages
  console.log('3. POST campaign.previewMessages...');
  const campaign = await post('wassel-alpha.vercel.app', '/api/trpc/campaign.previewMessages', {
    jobTitle: 'Software Engineer',
    targetCompanies: ['Aramco'],
    language: 'ar'
  }, { 'Authorization': 'Bearer ' + auth.access_token });
  console.log('   Status:', campaign.status);
  console.log('   Body:', campaign.data.substring(0, 500));
}

main().catch(e => console.error('Fatal:', e));
