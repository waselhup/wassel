@echo off
cd /d C:\Users\WIN11-24H2GPT\Desktop\wassel-v2
echo === Building unbundled API === > deploy-log6.txt
call npm run build >> deploy-log6.txt 2>&1
echo BUILD=%errorlevel% >> deploy-log6.txt
"C:\Program Files\Git\cmd\git.exe" add -A >> deploy-log6.txt 2>&1
"C:\Program Files\Git\cmd\git.exe" commit -m "fix: unbundled Express API - no esbuild, plain CJS require" >> deploy-log6.txt 2>&1
echo === Deploying === >> deploy-log6.txt
call vercel deploy --prod --yes >> deploy-log6.txt 2>&1
echo DEPLOY=%errorlevel% >> deploy-log6.txt
echo === Testing === >> deploy-log6.txt
ping -n 5 127.0.0.1 >nul
curl -s https://wassel-alpha.vercel.app/api/health >> deploy-log6.txt 2>&1
echo. >> deploy-log6.txt
echo DONE at %date% %time% >> deploy-log6.txt
