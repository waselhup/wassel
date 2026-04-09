@echo off
cd /d "C:\Users\WIN11-24H2GPT\Desktop\wassel-v2"
set VITE_SUPABASE_URL=https://hiqotmimlgsrsnovtopd.supabase.co
set SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpcW90bWltbGdzcnNub3Z0b3BkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjE0ODA4NywiZXhwIjoyMDg3NzI0MDg3fQ.8FrY-dp6uBa7-UkkXybJyNi_7y4irhrThTR33VFDtAA
"C:\Program Files\nodejs\node.exe" -e "const app = require('./api/index.js'); const http = require('http'); const server = http.createServer(app); server.listen(0, () => { const port = server.address().port; http.get('http://localhost:'+port+'/api/health', r => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>{console.log('STATUS:'+r.statusCode);console.log('BODY:'+d);server.close();}); }); });"
echo EXITCODE=%ERRORLEVEL%
