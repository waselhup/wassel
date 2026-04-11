@echo off
cd /d C:\Users\WIN11-24H2GPT\Desktop\wassel-v2
echo === Rebuilding API ===
call npx esbuild server/_core/vercel.ts --platform=node --bundle --format=cjs --outfile=api/index.js
echo === Building Frontend ===
call npm run build
echo === Deploying ===
call npx vercel deploy --prod --yes
echo === DONE ===
pause
