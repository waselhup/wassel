/**
 * Full Wassel Cleanup Script
 * Wipes all user accounts, profiles, teams, clients, invites, connections, and auth state.
 * Keeps application code and schema intact.
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://hiqotmimlgsrsnovtopd.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpcW90bWltbGdzcnNub3Z0b3BkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjE0ODA4NywiZXhwIjoyMDg3NzI0MDg3fQ.8FrY-dp6uBa7-UkkXybJyNi_7y4irhrThTR33VFDtAA';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function cleanup() {
    console.log('=== WASSEL FULL CLEANUP ===\n');

    // 1. Delete all data tables (order matters for foreign keys)
    const tables = [
        'prospect_import_jobs',
        'prospects',
        'linkedin_connections',
        'oauth_states',
        'client_invites',
        'clients',
        'team_members',
        'profiles',
        'teams',
    ];

    for (const table of tables) {
        try {
            const { data, error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
            if (error) {
                // Try with different column name
                const { error: err2 } = await supabase.from(table).delete().gte('created_at', '1970-01-01');
                if (err2) {
                    console.log(`  ⚠ ${table}: ${err2.message}`);
                } else {
                    console.log(`  ✓ ${table}: cleared`);
                }
            } else {
                console.log(`  ✓ ${table}: cleared`);
            }
        } catch (e) {
            console.log(`  ⚠ ${table}: ${e.message}`);
        }
    }

    // 2. Delete all Supabase Auth users
    console.log('\n--- Auth Users ---');
    const { data: authUsers, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
        console.log(`  ⚠ Error listing users: ${listError.message}`);
    } else {
        console.log(`  Found ${authUsers.users.length} auth users`);
        for (const user of authUsers.users) {
            const { error: delError } = await supabase.auth.admin.deleteUser(user.id);
            if (delError) {
                console.log(`  ⚠ Failed to delete ${user.email}: ${delError.message}`);
            } else {
                console.log(`  ✓ Deleted auth user: ${user.email}`);
            }
        }
    }

    // 3. Verify cleanup
    console.log('\n--- Verification ---');
    for (const table of tables) {
        try {
            const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
            if (error) {
                console.log(`  ? ${table}: ${error.message}`);
            } else {
                console.log(`  ${count === 0 ? '✓' : '✗'} ${table}: ${count} records`);
            }
        } catch (e) {
            console.log(`  ? ${table}: ${e.message}`);
        }
    }

    const { data: remainingUsers } = await supabase.auth.admin.listUsers();
    console.log(`  ${remainingUsers?.users?.length === 0 ? '✓' : '✗'} auth users: ${remainingUsers?.users?.length || 0} remaining`);

    console.log('\n=== CLEANUP COMPLETE ===');
}

cleanup().catch(console.error);
