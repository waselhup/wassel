@echo off
echo === TEST LINKEDIN ANALYZE ===
echo Step 1: Get auth token...

REM Sign in to get JWT token
curl -s -X POST "https://hiqotmimlgsrsnovtopd.supabase.co/auth/v1/token?grant_type=password" -H "Content-Type: application/json" -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpcW90bWltbGdzcnNub3Z0b3BkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNDgwODcsImV4cCI6MjA4NzcyNDA4N30.JOHhM5JiVfmryUaWJwqKPazMCPfGq7ycqPVzqUW5JMM" -d "{\"email\":\"alhashimali649@gmail.com\",\"password\":\"Ali@12345\"}" > C:\Users\WIN11-24H2GPT\Desktop\wassel-v2\auth_result.json

echo Step 2: Extract token and call LinkedIn analyze...

REM Use node to parse token and make the API call
"C:\Program Files\nodejs\node.exe" -e "const fs=require('fs'); const auth=JSON.parse(fs.readFileSync('C:\\Users\\WIN11-24H2GPT\\Desktop\\wassel-v2\\auth_result.json','utf8')); if(!auth.access_token){console.log('AUTH FAILED:',JSON.stringify(auth));process.exit(1);} console.log('Token obtained, calling LinkedIn analyze...'); const https=require('https'); const data=JSON.stringify({profileUrl:'https://www.linkedin.com/in/ali-alhashim-b786b626a'}); const req=https.request({hostname:'wassel-alpha.vercel.app',path:'/api/trpc/linkedin.analyze',method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+auth.access_token}},res=>{let body='';res.on('data',c=>body+=c);res.on('end',()=>{console.log('Status:',res.statusCode);console.log('Response:',body.substring(0,2000));});}); req.on('error',e=>console.log('Error:',e.message)); req.write(data); req.end();"

echo === DONE ===
