@echo off
cd /d C:\Users\WIN11-24H2GPT\Desktop\wassel-v2
call pnpm run build > build.log 2>&1
call npx vercel deploy --prod --yes > deploy.log 2>&1
echo DONE
