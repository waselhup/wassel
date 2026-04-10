@echo off
cd /d "C:\Users\WIN11-24H2GPT\Desktop\wassel-v2"
echo --- DEPLOY START --- > final-deploy.log 2>&1
call npx vercel deploy --prod --yes >> final-deploy.log 2>&1
echo --- DEPLOY DONE --- >> final-deploy.log 2>&1
