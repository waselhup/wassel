const https = require('https');

const SUPABASE_URL = 'qqytnnebtmbdtopxirgx.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxeXRubmVidG1iZHRvcHhpcmd4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTE3MjMyOSwiZXhwIjoyMDg2NzQ4MzI5fQ.xeZy9JeG5dEsZ7FhMLSMVwdWqz1JGjI7oFjWaYKHPpk';

const path = '/rest/v1/profiles?select=id,email,full_name,token_balance,plan';

const opts = {
  hostname: SUPABASE_URL,
  path: path,
  headers: {
    'apikey': SERVICE_KEY,
    'Authorization': 'Bearer ' + SERVICE_KEY
  }
};

https.get(opts, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    try {
      const profiles = JSON.parse(data);
      console.log('Found', profiles.length, 'profiles:');
      profiles.forEach(p => {
        console.log(`  ${p.email || 'no-email'} | tokens: ${p.token_balance} | plan: ${p.plan} | name: ${p.full_name}`);
      });
    } catch(e) {
      console.log('Raw response:', data);
    }
  });
}).on('error', (e) => console.error('Error:', e.message));
