import { createClient } from '@supabase/supabase-js';
const SUPABASE_URL = 'https://hiqotmimlgsrsnovtopd.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpcW90bWltbGdzcnNub3Z0b3BkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjE0ODA4NywiZXhwIjoyMDg3NzI0MDg3fQ.8FrY-dp6uBa7-UkkXybJyNi_7y4irhrThTR33VFDtAA';
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function test() {
  const { data: logs } = await supabase
    .from('activity_logs')
    .select('prospect_name, executed_at, error_message')
    .eq('action_type', 'connect')
    .eq('status', 'failed')
    .order('executed_at', { ascending: false })
    .limit(5);

  console.log('Latest 5 failed connect errors:');
  logs?.forEach(log => {
      console.log(`- ${log.prospect_name} (${log.executed_at}):`);
      console.log(`  Error: ${log.error_message}`);
  });
}

test().catch(console.error);
