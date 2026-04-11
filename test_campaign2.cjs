const { createClient } = require('@supabase/supabase-js');
const s = createClient(
  'https://hiqotmimlgsrsnovtopd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpcW90bWltbGdzcnNub3Z0b3BkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjE0ODA4NywiZXhwIjoyMDg3NzI0MDg3fQ.8FrY-dp6uBa7-UkkXybJyNi_7y4irhrThTR33VFDtAA'
);

async function main() {
  // Test direct insert into email_campaigns
  console.log('Testing direct DB insert...');
  const { data, error } = await s
    .from('email_campaigns')
    .insert([{
      user_id: '1111c590-6c23-4e9c-ae2b-87575209e553',
      campaign_name: 'Direct Test',
      job_title: 'Engineer',
      target_companies: ['Aramco', 'SABIC'],
      status: 'draft',
      total_recipients: 2,
    }])
    .select()
    .single();

  if (error) {
    console.log('DB INSERT ERROR:', JSON.stringify(error));
  } else {
    console.log('DB INSERT OK:', data.id, data.campaign_name);
    // Clean up
    await s.from('email_campaigns').delete().eq('id', data.id);
    console.log('Cleaned up test record');
  }
}

main().catch(e => console.error('Fatal:', e));
