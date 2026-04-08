@echo off
cd /d C:\Users\WIN11-24H2GPT\Desktop\wassel-v2
echo === Building project ===
call npm run build
echo BUILD_RESULT=%errorlevel%
echo === Deploying to Vercel (production) ===
call vercel --prod --yes
echo DEPLOY_RESULT=%errorlevel%
