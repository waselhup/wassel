import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://hiqotmimlgsrsnovtopd.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpcW90bWltbGdzcnNub3Z0b3BkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNDgwODcsImV4cCI6MjA4NzcyNDA4N30.jy0blU9Ph4BDmKRxVRP10yUdXKaqBbxI4kpr5SOA9yU';

console.log('[Supabase] Client initialized with URL:', supabaseUrl, 'Key present:', !!supabaseAnonKey);

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

