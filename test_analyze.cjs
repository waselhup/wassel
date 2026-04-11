const https = require('https');

const SK = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpcW90bWltbGdzcnNub3Z0b3BkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjE0ODA4NywiZXhwIjoyMDg3NzI0MDg3fQ.8FrY-dp6uBa7-UkkXybJyNi_7y4irhrThTR33VFDtAA';
const AK = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpcW90bWltbGdzcnNub3Z0b3BkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNDgwODcsImV4cCI6MjA4NzcyNDA4N30.jy0blU9Ph4BDmKRxVRP10yUdXKaqBbxI4kpr5SOA9yU';

function post(host, path, headers, body) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname: host, port: 443, path, method: 'POST', headers }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(180000);
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  try {
    // Step 1: Generate magic link and get full response
    console.log('Step 1: Generating auth link...');
    const r1 = await post(
      'hiqotmimlgsrsnovtopd.supabase.co',
      '/auth/v1/admin/generate_link',
      { 'Content-Type': 'application/json', 'apikey': AK, 'Authorization': 'Bearer ' + SK },
      JSON.stringify({ type: 'magiclink', email: 'alhashimali649@gmail.com' })
    );
    
    const d = JSON.parse(r1.body);
    
    // Try multiple places for action_link
    let actionLink = '';
    if (d.properties && d.properties.action_link) actionLink = d.properties.action_link;
    else if (d.action_link) actionLink = d.action_link;
    
    let tokenHash = '';
    if (d.properties && d.properties.hashed_token) tokenHash = d.properties.hashed_token;
    else if (d.hashed_token) tokenHash = d.hashed_token;
    
    // Also try extracting from action_link URL
    if (!tokenHash && actionLink) {
      const m = actionLink.match(/token_hash=([^&]+)/);
      if (m) tokenHash = m[1];
    }
    
    if (!tokenHash) {
      console.log('Top-level keys:', Object.keys(d));
      // Print all string values that look like tokens
      for (const [k, v] of Object.entries(d)) {
        if (typeof v === 'string' && v.length > 20) {
          console.log(`  ${k}: ${v.substring(0, 100)}...`);
        }
      }
      console.log('No token_hash found, trying password reset approach instead...');
      
      // Alternative: Use admin to update user password temporarily, then sign in
      console.log('Setting temporary password...');
      const r_pw = await post(
        'hiqotmimlgsrsnovtopd.supabase.co',
        '/auth/v1/admin/users/7eb1cb9e-d210-4faf-8d4f-03ed16df3084',
        { 'Content-Type': 'application/json', 'apikey': AK, 'Authorization': 'Bearer ' + SK },
        JSON.stringify({ password: 'TempTest123!' })
      );
      
      // Use PUT method for update
      const r_pw2 = await new Promise((resolve, reject) => {
        const req = https.request({
          hostname: 'hiqotmimlgsrsnovtopd.supabase.co',
          port: 443,
          path: '/auth/v1/admin/users/7eb1cb9e-d210-4faf-8d4f-03ed16df3084',
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'apikey': AK, 'Authorization': 'Bearer ' + SK }
        }, res => {
          let data = '';
          res.on('data', c => data += c);
          res.on('end', () => resolve({ status: res.statusCode, body: data }));
        });
        req.on('error', reject);
        req.write(JSON.stringify({ password: 'TempTest123!' }));
        req.end();
      });
      
      console.log('Password update status:', r_pw2.status);
      
      if (r_pw2.status === 200) {
        console.log('Signing in with temp password...');
        const r_sign = await post(
          'hiqotmimlgsrsnovtopd.supabase.co',
          '/auth/v1/token?grant_type=password',
          { 'Content-Type': 'application/json', 'apikey': AK },
          JSON.stringify({ email: 'alhashimali649@gmail.com', password: 'TempTest123!' })
        );
        
        const sess = JSON.parse(r_sign.body);
        if (sess.access_token) {
          console.log('Auth success! Calling LinkedIn analyze...');
          await callAnalyze(sess.access_token);
        } else {
          console.log('Sign in failed:', r_sign.body.substring(0, 500));
        }
      }
      return;
    }

    console.log('Got token_hash, verifying...');
    const r2 = await post(
      'hiqotmimlgsrsnovtopd.supabase.co',
      '/auth/v1/verify',
      { 'Content-Type': 'application/json', 'apikey': AK },
      JSON.stringify({ type: 'magiclink', token_hash: tokenHash })
    );

    const session = JSON.parse(r2.body);
    if (!session.access_token) {
      console.log('Verify failed:', r2.body.substring(0, 500));
      return;
    }

    console.log('Auth success!');
    await callAnalyze(session.access_token);
    
  } catch (err) {
    console.log('Script error:', err.message, err.stack);
  }
}

async function callAnalyze(token) {
  console.log('Calling LinkedIn analyze (takes 60-120s for Apify + Claude)...');
  
  const r3 = await post(
    'wassel-alpha.vercel.app',
    '/api/trpc/linkedin.analyze',
    { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    JSON.stringify({ profileUrl: 'https://www.linkedin.com/in/ali-alhashim-b786b626a' })
  );

  console.log('HTTP Status:', r3.status);
  
  try {
    const result = JSON.parse(r3.body);
    if (result.result && result.result.data && result.result.data.score) {
      console.log('========= SUCCESS! =========');
      console.log('Score:', result.result.data.score);
      console.log('Headline Current:', result.result.data.headlineCurrent);
      console.log('Headline Suggestion:', result.result.data.headlineSuggestion);
      console.log('Keywords:', JSON.stringify(result.result.data.keywords));
      console.log('Strengths:', JSON.stringify(result.result.data.strengths));
      console.log('Weaknesses:', JSON.stringify(result.result.data.weaknesses));
      console.log('Experience Suggestions:', JSON.stringify(result.result.data.experienceSuggestions));
      console.log('============================');
    } else if (result.error) {
      console.log('=== API ERROR ===');
      console.log(JSON.stringify(result.error, null, 2).substring(0, 2000));
    } else {
      console.log('=== RESPONSE ===');
      console.log(JSON.stringify(result, null, 2).substring(0, 3000));
    }
  } catch (e) {
    console.log('Raw response:', r3.body.substring(0, 3000));
  }
}

main();
