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
  console.log('Got JWT, testing CV generate...');

  // Test CV generate (costs 10 tokens)
  const cvRes = await fetch('https://wassel-alpha.vercel.app/api/trpc/cv.generate', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + jwt,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields: ['Oil & Gas Engineering'] }),
  });
  const cvJson = await cvRes.json();
  console.log('CV status:', cvRes.status);  if (cvJson.error) {
    console.log('CV error:', JSON.stringify(cvJson.error).substring(0, 300));
  } else {
    const data = cvJson.result?.data;
    console.log('CV versions:', data?.versions?.length);
    console.log('Tokens remaining:', data?.tokensRemaining);
    if (data?.versions?.[0]) {
      console.log('First version headline:', data.versions[0].headline);
      console.log('First version skills:', data.versions[0].skills?.join(', '));
    }
  }

  // Check token balance after CV
  const balRes = await fetch('https://wassel-alpha.vercel.app/api/trpc/token.balance', {
    headers: { 'Authorization': 'Bearer ' + jwt },
  });
  const balJson = await balRes.json();
  console.log('Balance after CV:', JSON.stringify(balJson.result?.data));
}

main().catch(e => console.error('Fatal:', e));
