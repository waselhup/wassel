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
  // Sign in
  console.log('=== SIGNING IN ===');
  const signIn = await post(SUPABASE_URL, '/auth/v1/token?grant_type=password', {
    email: 'alhashimali649@gmail.com',
    password: 'TestWassel2026!'
  }, { 'apikey': ANON_KEY });
  const auth = JSON.parse(signIn.data);
  if (!auth.access_token) { console.log('FAIL:', signIn.data.substring(0,300)); return; }
  console.log('OK! Signed in as:', auth.user.email);
  const token = auth.access_token;
  const hdr = { 'Authorization': 'Bearer ' + token };

  // Test 1: auth.profile (check tokens + plan)
  console.log('\n=== TEST 1: auth.profile ===');
  const prof = await get('wassel-alpha.vercel.app', '/api/trpc/auth.profile', hdr);
  const profData = JSON.parse(prof.data);
  if (profData.result && profData.result.data) {
    const p = profData.result.data;
    console.log('token_balance:', p.token_balance, '| plan:', p.plan, '| name:', p.full_name);
    console.log(p.token_balance === 1000 ? 'PASS: 1000 tokens' : 'FAIL: expected 1000, got ' + p.token_balance);
    console.log(p.plan === 'pro' ? 'PASS: pro plan' : 'FAIL: expected pro, got ' + p.plan);
  } else {
    console.log('FAIL:', prof.data.substring(0,300));
  }

  // Test 2: CV generation
  console.log('\n=== TEST 2: cv.generate ===');
  try {
    const cv = await post('wassel-alpha.vercel.app', '/api/trpc/cv.generate', {
      fields: ['headline', 'summary'],
      context: {
        name: 'Ali Alhashim',
        jobTitle: 'Software Engineer',
        company: 'Aramco',
        jobDescription: 'Full-stack developer for digital transformation',
        currentRole: 'Senior Developer',
        experience: '5 years',
        skills: 'React, Node.js, TypeScript',
        education: 'BS Computer Science',
        achievements: 'Led 3 major projects',
        languages: 'Arabic, English'
      }
    }, hdr);
    console.log('Status:', cv.status);
    const cvData = JSON.parse(cv.data);
    if (cvData.result && cvData.result.data) {
      console.log('PASS: CV generated. Versions:', cvData.result.data.versions?.length);
      console.log('Tokens remaining:', cvData.result.data.tokensRemaining);
    } else if (cvData.error) {
      console.log('FAIL:', JSON.stringify(cvData.error).substring(0,400));
    } else {
      console.log('Response:', cv.data.substring(0,400));
    }
  } catch(e) { console.log('ERROR:', e.message); }

  // Test 3: LinkedIn analysis
  console.log('\n=== TEST 3: linkedin.analyze ===');
  try {
    const li = await post('wassel-alpha.vercel.app', '/api/trpc/linkedin.analyze', {
      profileUrl: 'https://www.linkedin.com/in/alhashimali/'
    }, hdr);
    console.log('Status:', li.status);
    const liData = JSON.parse(li.data);
    if (liData.result && liData.result.data) {
      console.log('PASS: Score:', liData.result.data.score);
    } else if (liData.error) {
      console.log('FAIL:', JSON.stringify(liData.error).substring(0,500));
    } else {
      console.log('Response:', li.data.substring(0,500));
    }
  } catch(e) { console.log('ERROR:', e.message); }

  console.log('\n=== ALL TESTS DONE ===');
}

main().catch(e => console.error('Fatal:', e));
