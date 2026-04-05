const https = require('https');

const API_KEY = 'vcp_8ZTzHzopcb3sJQ5oGf3B2CMBfZlaLXd3iHgwIDWtE1l8Hm2orJ0E662p';
const PROJECT_ID = 'wassel';

const envVars = [
    { key: 'VITE_SUPABASE_URL', value: 'https://hiqotmimlgsrsnovtopd.supabase.co', target: ['production', 'preview', 'development'], type: 'encrypted' },
    { key: 'VITE_SUPABASE_ANON_KEY', value: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpcW90bWltbGdzcnNub3Z0b3BkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNDgwODcsImV4cCI6MjA4NzcyNDA4N30.jy0blU9Ph4BDmKRxVRP10yUdXKaqBbxI4kpr5SOA9yU', target: ['production', 'preview', 'development'], type: 'encrypted' },
    { key: 'SUPABASE_URL', value: 'https://hiqotmimlgsrsnovtopd.supabase.co', target: ['production', 'preview', 'development'], type: 'encrypted' },
    { key: 'SUPABASE_SERVICE_ROLE_KEY', value: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpcW90bWltbGdzcnNub3Z0b3BkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjE0ODA4NywiZXhwIjoyMDg3NzI0MDg3fQ.8FrY-dp6uBa7-UkkXybJyNi_7y4irhrThTR33VFDtAA', target: ['production', 'preview', 'development'], type: 'encrypted' },
    { key: 'VITE_FRONTEND_URL', value: 'https://wassel-alpha.vercel.app', target: ['production', 'preview', 'development'], type: 'encrypted' }
];

async function addEnvVar(env) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(env);
        const options = {
            hostname: 'api.vercel.com',
            port: 443,
            path: `/v10/projects/${PROJECT_ID}/env`,
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        };

        const req = https.request(options, (res) => {
            let responseBody = '';
            res.on('data', (chunk) => responseBody += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    console.log(`Added ${env.key} successfully.`);
                    resolve();
                } else {
                    console.log(`Failed to add ${env.key}. Continuing. Status: ${res.statusCode} Body: ${responseBody}`);
                    resolve(); // Resolve to avoid failing all
                }
            });
        });

        req.on('error', (error) => {
            console.error(error);
            reject(error);
        });

        req.write(data);
        req.end();
    });
}

async function main() {
    for (const env of envVars) {
        await addEnvVar(env);
    }
}

main();
