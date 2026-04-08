@echo off
cd /d C:\Users\WIN11-24H2GPT\Desktop\wassel-v2
echo === Building === > deploy-log2.txt
call npm run build >> deploy-log2.txt 2>&1
echo BUILD=%errorlevel% >> deploy-log2.txt
echo === Deploying to WASSEL project (prod) === >> deploy-log2.txt
call vercel deploy --prod --yes >> deploy-log2.txt 2>&1
echo DEPLOY=%errorlevel% >> deploy-log2.txt
echo DONE at %date% %time% >> deploy-log2.txt
