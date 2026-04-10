@echo off
cd /d "C:\Users\WIN11-24H2GPT\Desktop\wassel-v2"
echo START %DATE% %TIME% > redeploy4.log
"C:\Program Files\nodejs\npx.cmd" --yes vercel@latest deploy --prod --yes >> redeploy4.log 2>&1
echo DONE %DATE% %TIME% errorlevel=%ERRORLEVEL% >> redeploy4.log
