import { supabase } from './server/supabase';
import { sendInvite } from './server/_core/linkedinApi';
import { decrypt } from './server/_core/encryption';

async function test() {
  console.log('Fetching active session...');
  const { data: sessionData } = await supabase
    .from('linkedin_sessions')
    .select('*')
    .eq('status', 'active')
    .limit(1)
    .single();

  if (!sessionData) {
    console.log('No active session found.');
    process.exit(1);
  }

  const session = {
    liAt: decrypt(sessionData.li_at),
    jsessionId: sessionData.jsessionid ? decrypt(sessionData.jsessionid) : '',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
  };

  console.log('Session retrieved, trying to send invite to a test profile (Will-Smith)...');
  
  // We'll use a random famous profile or something safe just to see the HTTP response
  // or a fake ID just to see if we get a 301 or a 400.
  const testUrn = 'ACoAAAAAABBB'; // FAKE URN, should return 400 or 404, not 301.

  const result = await sendInvite(session, testUrn, 'Testing Wassel API');
  console.log('Result:', result);
}

test().catch(console.error);
