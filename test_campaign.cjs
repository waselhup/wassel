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
  console.log('Got JWT, testing campaign create...');

  const res = await fetch('https://wassel-alpha.vercel.app/api/trpc/campaign.create', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + jwt,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      campaignName: 'Test Campaign - Saudi Oil Companies',
      jobTitle: 'Senior Drilling Engineer',
      targetCompanies: ['Saudi Aramco', 'SABIC'],      recipientCount: 2,
      language: 'en',
    }),
  });
  const json = await res.json();
  console.log('Campaign status:', res.status);
  if (json.error) {
    console.log('Campaign error:', JSON.stringify(json.error).substring(0, 500));
  } else {
    const data = json.result?.data;
    console.log('Campaign ID:', data?.id);
    console.log('Campaign name:', data?.campaign_name);
    console.log('Status:', data?.status);
  }

  // Check balance
  const balRes = await fetch('https://wassel-alpha.vercel.app/api/trpc/token.balance', {
    headers: { 'Authorization': 'Bearer ' + jwt },
  });
  const balJson = await balRes.json();
  console.log('Balance after campaign:', JSON.stringify(balJson.result?.data));
}

main().catch(e => console.error('Fatal:', e));
