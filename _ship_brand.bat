@echo off
set PATH=%PATH%;C:\Program Files\Git\cmd;C:\Users\WIN11-24H2GPT\AppData\Roaming\npm
cd /d "C:\Users\WIN11-24H2GPT\Desktop\wassel-v2"
if exist ".git\index.lock" del ".git\index.lock"
echo === Committing ===
git commit -m "feat: brand update - WasselLogo, teal theme, new sidebar, favicon"
echo === Pushing ===
git push origin master
echo === Building ===
call npm run build
echo === Deploying to Vercel ===
call npx vercel deploy --prod --yes
echo === ALL DONE ===
