#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function verifyMigrations() {
  console.log('🔍 Verifying Supabase migrations...\n');

  try {
    // Check core tables
    const tables = [
      'profiles',
      'teams',
      'team_members',
      'campaigns',
      'campaign_steps',
      'leads',
      'action_queue',
      'message_templates',
      'events',
      'credit_transactions',
    ];

    console.log('📋 Checking tables:');
    for (const table of tables) {
      const { data, error } = await supabase.from(table).select('id').limit(1);
      if (error && error.code !== 'PGRST116') {
        console.log(`  ❌ ${table}: ${error.message}`);
      } else {
        console.log(`  ✅ ${table}`);
      }
    }

    // Check RLS policies
    console.log('\n🔐 Checking RLS policies:');
    const { data: policies, error: policiesError } = await supabase.rpc('get_rls_policies', {});
    if (policiesError) {
      console.log(`  ℹ️  RLS check (function not available): ${policiesError.message}`);
    } else {
      console.log(`  ✅ RLS policies found: ${policies?.length || 0} policies`);
    }

    // Check functions
    console.log('\n⚙️  Checking functions:');
    const functions = ['get_current_user_profile', 'get_user_teams'];
    for (const fn of functions) {
      try {
        const { data, error } = await supabase.rpc(fn, {});
        if (error) {
          console.log(`  ⚠️  ${fn}: ${error.message}`);
        } else {
          console.log(`  ✅ ${fn}`);
        }
      } catch (e) {
        console.log(`  ⚠️  ${fn}: Not callable`);
      }
    }

    console.log('\n✅ Migration verification complete!');
  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  }
}

verifyMigrations();
