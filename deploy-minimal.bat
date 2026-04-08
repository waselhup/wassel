@echo off
cd /d C:\Users\WIN11-24H2GPT\Desktop\wassel-v2
echo === Deploying minimal test === > deploy-log4.txt
"C:\Program Files\Git\cmd\git.exe" add -A >> deploy-log4.txt 2>&1
"C:\Program Files\Git\cmd\git.exe" commit -m "fix: minimal serverless handler to debug FUNCTION_INVOCATION_FAILED" >> deploy-log4.txt 2>&1
call vercel deploy --prod --yes >> deploy-log4.txt 2>&1
echo DEPLOY=%errorlevel% >> deploy-log4.txt
echo === Waiting 10s === >> deploy-log4.txt
ping -n 10 127.0.0.1 >nul
echo === Testing === >> deploy-log4.txt
curl -s https://wassel-alpha.vercel.app/api/health >> deploy-log4.txt 2>&1
echo. >> deploy-log4.txt
echo DONE at %date% %time% >> deploy-log4.txt
