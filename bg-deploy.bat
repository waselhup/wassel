@echo off
cd /d C:\Users\WIN11-24H2GPT\Desktop\wassel-v2
echo STARTING DEPLOY at %date% %time% > deploy-log.txt
call vercel deploy --prod --yes >> deploy-log.txt 2>&1
echo EXIT_CODE=%errorlevel% >> deploy-log.txt
echo DONE at %date% %time% >> deploy-log.txt
