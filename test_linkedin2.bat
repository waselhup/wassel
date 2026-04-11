@echo off
echo === TEST LINKEDIN ANALYZE ===

REM Sign in with correct anon key
curl -s -X POST "https://hiqotmimlgsrsnovtopd.supabase.co/auth/v1/token?grant_type=password" -H "Content-Type: application/json" -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpcW90bWltbGdzcnNub3Z0b3BkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNDgwODcsImV4cCI6MjA4NzcyNDA4N30.jy0blU9Ph4BDmKRxVRP10yUdXKaqBbxI4kpr5SOA9yU" -d "{\"email\":\"alhashimali649@gmail.com\",\"password\":\"Ali@12345\"}" > C:\Users\WIN11-24H2GPT\Desktop\wassel-v2\auth2.json

"C:\Program Files\nodejs\node.exe" -e "const fs=require('fs');const https=require('https');try{const auth=JSON.parse(fs.readFileSync('auth2.json','utf8'));if(!auth.access_token){console.log('AUTH FAILED:',JSON.stringify(auth).substring(0,500));process.exit(1);}console.log('Got token. Calling LinkedIn analyze...');const data=JSON.stringify({profileUrl:'https://www.linkedin.com/in/ali-alhashim-b786b626a'});const req=https.request({hostname:'wassel-alpha.vercel.app',path:'/api/trpc/linkedin.analyze',method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+auth.access_token}},res=>{let body='';res.on('data',c=>body+=c);res.on('end',()=>{console.log('Status:',res.statusCode);try{const j=JSON.parse(body);console.log('Score:',j.result?.data?.score);console.log(JSON.stringify(j,null,2).substring(0,3000));}catch(e){console.log('Raw:',body.substring(0,3000));}});});req.on('error',e=>console.log('Error:',e.message));req.write(data);req.end();}catch(e){console.log('Script error:',e.message);}"

echo === DONE ===
