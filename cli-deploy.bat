@echo off
cd /d "C:\Users\WIN11-24H2GPT\Desktop\wassel-v2"
echo --- whoami --- > cli-deploy.log 2>&1
call npx vercel whoami >> cli-deploy.log 2>&1
echo --- link --- >> cli-deploy.log 2>&1
call npx vercel link --yes --project wassel --scope waselhupsas-projects >> cli-deploy.log 2>&1
echo --- deploy --- >> cli-deploy.log 2>&1
call npx vercel deploy --prod --yes >> cli-deploy.log 2>&1
echo --- done --- >> cli-deploy.log 2>&1
