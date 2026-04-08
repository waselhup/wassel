@echo off
cd /d C:\Users\WIN11-24H2GPT\Desktop\wassel-v2
echo === Building ESM === > deploy-log3.txt
call npm run build >> deploy-log3.txt 2>&1
echo BUILD=%errorlevel% >> deploy-log3.txt
echo === Committing === >> deploy-log3.txt
"C:\Program Files\Git\cmd\git.exe" add -A >> deploy-log3.txt 2>&1
"C:\Program Files\Git\cmd\git.exe" commit -m "fix: switch to ESM format for Vercel serverless compatibility" >> deploy-log3.txt 2>&1
echo === Deploying === >> deploy-log3.txt
call vercel deploy --prod --yes >> deploy-log3.txt 2>&1
echo DEPLOY=%errorlevel% >> deploy-log3.txt
echo === Testing health === >> deploy-log3.txt
curl -s https://wassel-alpha.vercel.app/api/health >> deploy-log3.txt 2>&1
echo. >> deploy-log3.txt
echo DONE at %date% %time% >> deploy-log3.txt
