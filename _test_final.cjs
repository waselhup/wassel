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
  console.log('=== SIGN IN ===');
  const signIn = await post(SUPABASE_URL, '/auth/v1/token?grant_type=password', {
    email: 'alhashimali649@gmail.com', password: 'TestWassel2026!'
  }, { 'apikey': ANON_KEY });
  const auth = JSON.parse(signIn.data);
  if (!auth.access_token) { console.log('FAIL: Sign-in failed'); return; }
  console.log('OK');
  const hdr = { 'Authorization': 'Bearer ' + auth.access_token };

  // Test 1: auth.profile
  console.log('\n=== TEST 1: auth.profile ===');
  const prof = await get('wassel-alpha.vercel.app', '/api/trpc/auth.profile', hdr);
  const profData = JSON.parse(prof.data);
  if (profData.result?.data) {
    const p = profData.result.data;
    console.log('tokens:', p.token_balance, '| plan:', p.plan);
    console.log(p.token_balance >= 1000 ? 'PASS' : 'FAIL: tokens < 1000');
  } else { console.log('FAIL:', prof.data.substring(0, 200)); }

  // Test 2: campaign.previewMessages
  console.log('\n=== TEST 2: campaign.previewMessages ===');
  const camp = await post('wassel-alpha.vercel.app', '/api/trpc/campaign.previewMessages', {
    jobTitle: 'Software Engineer', targetCompanies: ['STC'], language: 'ar'
  }, hdr);
  console.log('Status:', camp.status);
  const campData = JSON.parse(camp.data);
  if (campData.result?.data?.messages) {
    console.log('PASS: Got', campData.result.data.messages.length, 'messages');
  } else { console.log('FAIL:', camp.data.substring(0, 300)); }

  // Test 3: cv.parseUpload (send a simple text CV)
  console.log('\n=== TEST 3: cv.parseUpload ===');
  const fakeCV = Buffer.from('Ali Alhashim\nSoftware Engineer\nEmail: ali@test.com\nPhone: +966501234567\nSkills: React, Node.js, TypeScript\nEducation: BS Computer Science, KFUPM\nExperience: 5 years full-stack development\nLanguages: Arabic, English').toString('base64');
  const cvParse = await post('wassel-alpha.vercel.app', '/api/trpc/cv.parseUpload', {
    fileBase64: fakeCV, fileName: 'cv.txt'
  }, hdr);
  console.log('Status:', cvParse.status);
  const cvParseData = JSON.parse(cvParse.data);
  if (cvParseData.result?.data?.name) {
    console.log('PASS: Extracted name:', cvParseData.result.data.name);
    console.log('  skills:', cvParseData.result.data.skills);
  } else { console.log('FAIL:', cvParse.data.substring(0, 300)); }

  // Test 4: cv.generate
  console.log('\n=== TEST 4: cv.generate ===');
  const cvGen = await post('wassel-alpha.vercel.app', '/api/trpc/cv.generate', {
    fields: ['headline'],
    context: { name: 'Ali', jobTitle: 'Software Engineer', company: 'Aramco', experience: '5', skills: 'React, Node.js' }
  }, hdr);
  console.log('Status:', cvGen.status);
  const cvData = JSON.parse(cvGen.data);
  if (cvData.result?.data?.versions) {
    console.log('PASS: CV generated, versions:', cvData.result.data.versions.length);
  } else { console.log('FAIL:', cvGen.data.substring(0, 300)); }

  // Test 5: campaign.discoverProspects (quick test - may timeout)
  console.log('\n=== TEST 5: campaign.discoverProspects ===');
  try {
    const disc = await post('wassel-alpha.vercel.app', '/api/trpc/campaign.discoverProspects', {
      jobTitle: 'Marketing Manager', location: 'Saudi Arabia'
    }, hdr);
    console.log('Status:', disc.status);
    if (disc.status === 200) {
      const discData = JSON.parse(disc.data);
      if (discData.result?.data?.prospects) {
        console.log('PASS: Found', discData.result.data.prospects.length, 'prospects');
      } else {
        console.log('Response:', disc.data.substring(0, 300));
      }
    } else {
      console.log('Note: May timeout on Vercel (Apify takes 60s+). Status:', disc.status);
      console.log(disc.data.substring(0, 200));
    }
  } catch (e) { console.log('Note: Expected - Apify discovery takes too long for serverless'); }

  console.log('\n=== ALL TESTS DONE ===');
}

main().catch(e => console.error('Fatal:', e.message));
