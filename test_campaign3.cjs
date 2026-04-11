const { createClient } = require('@supabase/supabase-js');
const s = createClient(
  'https://hiqotmimlgsrsnovtopd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpcW90bWltbGdzcnNub3Z0b3BkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjE0ODA4NywiZXhwIjoyMDg3NzI0MDg3fQ.8FrY-dp6uBa7-UkkXybJyNi_7y4irhrThTR33VFDtAA'
);

async function getJWT() {
  const { data: { users } } = await s.auth.admin.listUsers();
  const ali = users.find(u => u.email === 'waselhup@gmail.com');
  const { data: linkData } = await s.auth.admin.generateLink({ type: 'magiclink', email: ali.email });
  const url = new URL(linkData.properties.action_link);
  const token_hash = url.searchParams.get('token_hash') || url.searchParams.get('token');
  const { data: verifyData } = await s.auth.verifyOtp({ token_hash, type: 'magiclink' });
  return verifyData.session.access_token;
}

async function main() {
  const jwt = await getJWT();

  // Test 1: Raw body (how the custom client sends it)
  console.log('Test 1: raw JSON body...');
  const r1 = await fetch('https://wassel-alpha.vercel.app/api/trpc/campaign.create', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + jwt, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      campaignName: 'Test', jobTitle: 'Engineer',
      targetCompanies: ['Aramco'], recipientCount: 1, language: 'en',
    }),
  });
  const j1 = await r1.json();
  console.log('Status:', r1.status, JSON.stringify(j1).substring(0, 300));
  // Test 2: tRPC v10 wire format
  console.log('\nTest 2: tRPC wire format (json wrapper)...');
  const r2 = await fetch('https://wassel-alpha.vercel.app/api/trpc/campaign.create', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + jwt, 'Content-Type': 'application/json' },
    body: JSON.stringify({ json: {
      campaignName: 'Test2', jobTitle: 'Engineer',
      targetCompanies: ['Aramco'], recipientCount: 1, language: 'en',
    }}),
  });
  const j2 = await r2.json();
  console.log('Status:', r2.status, JSON.stringify(j2).substring(0, 300));
}

main().catch(e => console.error('Fatal:', e));
