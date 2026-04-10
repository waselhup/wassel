@echo off
cd /d "C:\Users\WIN11-24H2GPT\Desktop\wassel-v2"
echo START %DATE% %TIME% > redeploy.log
call pnpm run build >> redeploy.log 2>&1
echo BUILD DONE %DATE% %TIME% >> redeploy.log
call npx vercel deploy --prod --yes >> redeploy.log 2>&1
echo DEPLOY DONE %DATE% %TIME% >> redeploy.log
