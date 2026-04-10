@echo off
cd /d "C:\Users\WIN11-24H2GPT\Desktop\wassel-v2" > redeploy2.log 2>&1
echo === START === >> redeploy2.log
where pnpm >> redeploy2.log 2>&1
where npx >> redeploy2.log 2>&1
where node >> redeploy2.log 2>&1
echo === ERRORLEVEL %ERRORLEVEL% === >> redeploy2.log
call pnpm run build >> redeploy2.log 2>&1
echo === BUILD ERRORLEVEL %ERRORLEVEL% === >> redeploy2.log
call npx vercel deploy --prod --yes >> redeploy2.log 2>&1
echo === DEPLOY ERRORLEVEL %ERRORLEVEL% === >> redeploy2.log
echo === END === >> redeploy2.log
