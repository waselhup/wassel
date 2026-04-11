const { createClient } = require('@supabase/supabase-js');
const s = createClient(
  'https://hiqotmimlgsrsnovtopd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpcW90bWltbGdzcnNub3Z0b3BkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjE0ODA4NywiZXhwIjoyMDg3NzI0MDg3fQ.8FrY-dp6uBa7-UkkXybJyNi_7y4irhrThTR33VFDtAA'
);

async function main() {
  // Get user
  const { data: { users } } = await s.auth.admin.listUsers();
  const ali = users.find(u => u.email === 'waselhup@gmail.com');
  if (!ali) { console.log('User not found'); return; }
  console.log('User:', ali.id, ali.email);

  // Generate link to get token
  const { data: linkData, error: linkErr } = await s.auth.admin.generateLink({
    type: 'magiclink',
    email: ali.email,
  });
  if (linkErr) { console.error('Link error:', linkErr); return; }

  const actionLink = linkData?.properties?.action_link;
  if (!actionLink) { console.error('No action link'); return; }

  // Extract token_hash from the link
  const url = new URL(actionLink);
  const token_hash = url.searchParams.get('token_hash') || url.searchParams.get('token');
  console.log('Token hash:', token_hash ? token_hash.substring(0, 20) + '...' : 'none');
  // Verify the OTP to get a session
  const { data: verifyData, error: verifyErr } = await s.auth.verifyOtp({
    token_hash,
    type: 'magiclink',
  });
  if (verifyErr) { console.error('Verify error:', verifyErr); return; }

  const jwt = verifyData?.session?.access_token;
  if (!jwt) { console.error('No JWT'); return; }
  console.log('JWT:', jwt.substring(0, 40) + '...');

  // Test LinkedIn history
  const histRes = await fetch('https://wassel-alpha.vercel.app/api/trpc/linkedin.history', {
    headers: { 'Authorization': 'Bearer ' + jwt },
  });
  const histJson = await histRes.json();
  console.log('History status:', histRes.status);
  console.log('History data:', JSON.stringify(histJson).substring(0, 200));

  // Test token balance
  const tokenRes = await fetch('https://wassel-alpha.vercel.app/api/trpc/token.balance', {
    headers: { 'Authorization': 'Bearer ' + jwt },
  });
  const tokenJson = await tokenRes.json();
  console.log('Token balance:', JSON.stringify(tokenJson).substring(0, 200));
}

main().catch(e => console.error('Fatal:', e));
