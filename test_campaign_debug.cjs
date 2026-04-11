const { createClient } = require('@supabase/supabase-js');
const s = createClient(
  'https://hiqotmimlgsrsnovtopd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpcW90bWltbGdzcnNub3Z0b3BkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjE0ODA4NywiZXhwIjoyMDg3NzI0MDg3fQ.8FrY-dp6uBa7-UkkXybJyNi_7y4irhrThTR33VFDtAA'
);

async function main() {
  const { data: { users } } = await s.auth.admin.listUsers();
  const ali = users.find(u => u.email === 'waselhup@gmail.com');
  if (!ali) { console.log('User not found'); return; }
  console.log('User:', ali.id);

  const { data: linkData, error: linkErr } = await s.auth.admin.generateLink({
    type: 'magiclink',
    email: ali.email,
  });
  if (linkErr) { console.error('Link error:', linkErr); return; }
  
  const actionLink = linkData?.properties?.action_link || '';
  console.log('Action link:', actionLink.substring(0, 120));
  
  // Parse the URL - might be a hash fragment
  const url = new URL(actionLink);
  console.log('Search params:', url.search);
  console.log('Hash:', url.hash?.substring(0, 80));
  
  // Try both token_hash and token from search params
  let token_hash = url.searchParams.get('token_hash')
    || url.searchParams.get('token');
  
  // Also try from hash fragment  
  if (!token_hash && url.hash) {
    const hashParams = new URLSearchParams(url.hash.slice(1));
    token_hash = hashParams.get('token_hash') || hashParams.get('token');
  }
  
  console.log('token_hash:', token_hash ? token_hash.substring(0, 20) + '...' : 'NONE');
  
  if (!token_hash) {
    console.error('No token_hash found!');
    return;
  }

  const { data: verifyData, error: verifyErr } = await s.auth.verifyOtp({
    token_hash,
    type: 'magiclink',
  });
  if (verifyErr) { console.error('Verify error:', verifyErr); return; }
  const jwt = verifyData?.session?.access_token;
  if (!jwt) { console.error('No JWT'); return; }
  console.log('JWT: YES');

  // Test campaign.create
  console.log('\n--- Testing campaign.create ---');
  const startTime = Date.now();
  const res = await fetch(
    'https://wassel-alpha.vercel.app/api/trpc/campaign.create',
    {      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwt}`,
      },
      body: JSON.stringify({
        campaignName: 'Debug Test',
        jobTitle: 'Marketing Manager',
        targetCompanies: ['Aramco', 'STC'],
        recipientCount: 2,
        language: 'en',
      }),
    }
  );
  const elapsed = Date.now() - startTime;
  const text = await res.text();
  console.log('Status:', res.status);
  console.log('Time:', elapsed, 'ms');
  console.log('Response:', text.substring(0, 1000));
}

main().catch(e => console.error('Fatal:', e));
