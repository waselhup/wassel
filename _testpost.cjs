const SUPA='https://hiqotmimlgsrsnovtopd.supabase.co';
const SR='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpcW90bWltbGdzcnNub3Z0b3BkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjE0ODA4NywiZXhwIjoyMDg3NzI0MDg3fQ.8FrY-dp6uBa7-UkkXybJyNi_7y4irhrThTR33VFDtAA';
const API='https://wassel-alpha.vercel.app';
const EMAIL='alhashimali649@gmail.com';
(async () => {
  const r1 = await fetch(`${SUPA}/auth/v1/admin/generate_link`, {
    method:'POST', headers:{'apikey':SR,'Authorization':`Bearer ${SR}`,'Content-Type':'application/json'},
    body: JSON.stringify({type:'magiclink', email:EMAIL})
  });
  const j1 = await r1.json();
  const hashed = j1.hashed_token;
  const r2 = await fetch(`${SUPA}/auth/v1/verify`, {
    method:'POST', headers:{'apikey':SR,'Content-Type':'application/json'},
    body: JSON.stringify({type:'magiclink', token_hash:hashed})
  });
  const j2 = await r2.json();
  const jwt = j2.access_token;
  console.log('JWT_OK');

  // Try 3 body formats for mutation
  const bodies = [
    { tag:'raw', body:{ profileUrl:'https://www.linkedin.com/in/ali-alhashim-b786b626a' } },
    { tag:'json-wrap', body:{ json:{ profileUrl:'https://www.linkedin.com/in/ali-alhashim-b786b626a' } } },
    { tag:'zero-wrap', body:{ '0':{ json:{ profileUrl:'https://www.linkedin.com/in/ali-alhashim-b786b626a' } } } },
  ];
  for (const b of bodies) {
    const r = await fetch(`${API}/api/trpc/linkedin.analyze`, {
      method:'POST',
      headers:{'Authorization':`Bearer ${jwt}`,'Content-Type':'application/json'},
      body: JSON.stringify(b.body)
    });
    const t = await r.text();
    console.log(`[${b.tag}] ${r.status}: ${t.slice(0,300)}`);
  }
})();
