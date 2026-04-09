@echo off
cd /d C:\Users\WIN11-24H2GPT\Desktop\wassel-v2
echo === Building full Express API === > deploy-log5.txt
call npm run build >> deploy-log5.txt 2>&1
echo BUILD=%errorlevel% >> deploy-log5.txt
echo === Verifying api/index.js size === >> deploy-log5.txt
for %%I in (api\index.js) do echo SIZE=%%~zI bytes >> deploy-log5.txt
"C:\Program Files\Git\cmd\git.exe" add -A >> deploy-log5.txt 2>&1
"C:\Program Files\Git\cmd\git.exe" commit -m "fix: restore Express API with proper handler wrapper for Vercel" >> deploy-log5.txt 2>&1
echo === Deploying === >> deploy-log5.txt
call vercel deploy --prod --yes >> deploy-log5.txt 2>&1
echo DEPLOY=%errorlevel% >> deploy-log5.txt
echo === Testing health === >> deploy-log5.txt
ping -n 5 127.0.0.1 >nul
curl -s https://wassel-alpha.vercel.app/api/health >> deploy-log5.txt 2>&1
echo. >> deploy-log5.txt
echo DONE at %date% %time% >> deploy-log5.txt
