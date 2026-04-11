@echo off
cd /d C:\Users\WIN11-24H2GPT\Desktop\wassel-v2

echo === VERCEL DEPLOY PROD ===
call npx vercel deploy --prod --yes 2>&1

echo === EXIT CODE: %ERRORLEVEL% ===
echo === DONE ===
