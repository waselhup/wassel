const https = require('https');

// Test 1: Check which Supabase the server connects to by hitting auth.profile
// We need a valid token first - let's sign in

const SUPABASE_URL = 'hiqotmimlgsrsnovtopd.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpcW90bWltbGdzcnNub3Z0b3BkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNDgwODcsImV4cCI6MjA4NzcyNDA4N30.GgGQ4fC27MFjzXE_gVx9R5S0LblrOWFJ8tZcjMJJmFE';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpcW90bWltbGdzcnNub3Z0b3BkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjE0ODA4NywiZXhwIjoyMDg3NzI0MDg3fQ.8FrY-dp6uBa7-UkkXybJyNi_7y4irhrThTR33VFDtAA';

// Check profiles in hiqotmimlgsrsnovtopd
const opts = {
  hostname: SUPABASE_URL,
  path: '/rest/v1/profiles?select=id,email,full_name,token_balance,plan',
  headers: {
    'apikey': SERVICE_KEY,
    'Authorization': 'Bearer ' + SERVICE_KEY
  }
};

console.log('Checking hiqotmimlgsrsnovtopd...');
https.get(opts, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    try {
      const profiles = JSON.parse(data);
      if (Array.isArray(profiles)) {
        console.log('Found', profiles.length, 'profiles:');
        profiles.forEach(p => {
          console.log('  ' + (p.email||'no-email') + ' | tokens:' + p.token_balance + ' | plan:' + p.plan);
        });
      } else {
        console.log('Response:', data.substring(0, 200));
      }
    } catch(e) {
      console.log('Raw:', data.substring(0, 200));
    }
  });
}).on('error', (e) => console.error('Error:', e.message));
