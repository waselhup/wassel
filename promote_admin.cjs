/**
 * Auto-promote alhashimali649@gmail.com to super_admin
 * Polls every 3 seconds until the account is found, then promotes it.
 */
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://hiqotmimlgsrsnovtopd.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpcW90bWltbGdzcnNub3Z0b3BkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjE0ODA4NywiZXhwIjoyMDg3NzI0MDg3fQ.8FrY-dp6uBa7-UkkXybJyNi_7y4irhrThTR33VFDtAA';
const TARGET_EMAIL = 'alhashimali649@gmail.com';

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
});

async function checkAndPromote() {
    // Check if profile exists
    const { data: profile, error } = await sb
        .from('profiles')
        .select('id, email, role')
        .eq('email', TARGET_EMAIL)
        .single();

    if (error || !profile) {
        return false; // Not found yet
    }

    console.log(`✅ Found account: ${profile.email} (id: ${profile.id}, current role: ${profile.role})`);

    if (profile.role === 'super_admin') {
        console.log('✅ Already super_admin! Nothing to do.');
        return true;
    }

    // Promote to super_admin
    const { error: updateErr } = await sb
        .from('profiles')
        .update({ role: 'super_admin' })
        .eq('id', profile.id);

    if (updateErr) {
        console.error('❌ Failed to promote:', updateErr.message);
        return false;
    }

    console.log('🎉 PROMOTED to super_admin successfully!');

    // Verify
    const { data: verify } = await sb
        .from('profiles')
        .select('id, email, role')
        .eq('id', profile.id)
        .single();

    console.log('Verified:', JSON.stringify(verify));
    return true;
}

async function main() {
    console.log(`Waiting for ${TARGET_EMAIL} to sign up...`);
    console.log('Polling every 3 seconds...\n');

    let attempts = 0;
    const maxAttempts = 100; // 5 minutes

    while (attempts < maxAttempts) {
        attempts++;
        const done = await checkAndPromote();
        if (done) {
            console.log('\n✅ Done! You can now log in as super_admin at /login');
            process.exit(0);
        }
        process.stdout.write(`  Poll #${attempts}... not found yet\r`);
        await new Promise(r => setTimeout(r, 3000));
    }

    console.log('\n⏰ Timed out after 5 minutes.');
    process.exit(1);
}

main();
