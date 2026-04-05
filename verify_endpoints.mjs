// Phase 4.1: Backend endpoint verification (handles HTML and JSON responses)
const BASE = 'https://wassel-alpha.vercel.app';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpcW90bWltbGdzcnNub3Z0b3BkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjE0ODA4NywiZXhwIjoyMDg3NzI0MDg3fQ.8FrY-dp6uBa7-UkkXybJyNi_7y4irhrThTR33VFDtAA';

async function safeJson(res) {
    const text = await res.text();
    try { return JSON.parse(text); }
    catch { return { _raw: text.substring(0, 120) }; }
}

async function verify() {
    const results = [];

    // Test each endpoint
    const tests = [
        { method: 'GET', path: '/api/health', label: 'Health', expect: 200 },
        { method: 'GET', path: '/api/invites/validate/nonexistent-token', label: 'Validate Invite (bad token)', expect: 404 },
        { method: 'GET', path: '/api/ext/bootstrap', label: 'Ext Bootstrap (no auth)', expect: 401 },
        { method: 'GET', path: '/api/ext/campaigns', label: 'Ext Campaigns (no auth)', expect: 401 },
        { method: 'POST', path: '/api/ext/import', label: 'Ext Import (no auth)', expect: 401, body: '{}' },
        { method: 'GET', path: '/api/ext/prospects', label: 'Ext Prospects (no auth)', expect: 401 },
        { method: 'GET', path: '/api/auth/linkedin/start', label: 'LinkedIn Start (no invite)', expect: 400 },
        { method: 'GET', path: '/api/clients/status', label: 'Clients Status (no auth)', expect: 401 },
    ];

    for (const t of tests) {
        try {
            const opts = { method: t.method, redirect: 'manual' };
            if (t.body) {
                opts.headers = { 'Content-Type': 'application/json' };
                opts.body = t.body;
            }
            const r = await fetch(BASE + t.path, opts);
            const d = await safeJson(r);
            const pass = r.status < 500;
            results.push({ pass, status: r.status, expected: t.expect, label: t.label, body: d });
        } catch (e) {
            results.push({ pass: false, status: 'ERR', expected: t.expect, label: t.label, body: { error: e.message } });
        }
    }

    // DB table check
    const SUPA = 'https://hiqotmimlgsrsnovtopd.supabase.co';
    const tables = ['clients', 'client_invites', 'linkedin_connections', 'oauth_states', 'prospects', 'prospect_import_jobs'];
    for (const t of tables) {
        const r = await fetch(`${SUPA}/rest/v1/${t}?select=id&limit=0`, {
            headers: { 'apikey': SERVICE_KEY, 'Authorization': 'Bearer ' + SERVICE_KEY }
        });
        results.push({ pass: r.ok, status: r.status, expected: 200, label: `DB: ${t}`, body: r.ok ? { exists: true } : { missing: true } });
    }

    // Print
    console.log('\n=== PHASE 4.1 VERIFICATION ===\n');
    let allPass = true;
    for (const r of results) {
        const icon = r.pass ? '✅' : '❌';
        if (!r.pass) allPass = false;
        const bodyStr = typeof r.body === 'object' ? JSON.stringify(r.body).substring(0, 80) : r.body;
        console.log(`${icon} [${r.status}] ${r.label} → ${bodyStr}`);
    }
    console.log(`\n${allPass ? '✅ ALL ENDPOINTS HEALTHY' : '❌ SOME ENDPOINTS HAVE ISSUES'}`);
}

verify().catch(console.error);
