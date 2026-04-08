@echo off
set PATH=%PATH%;C:\Program Files\Git\cmd
cd /d "C:\Users\WIN11-24H2GPT\Desktop\wassel-v2"
echo === Removing lock ===
if exist ".git\index.lock" del ".git\index.lock"
echo === Empty commit to trigger Vercel ===
git commit --allow-empty -m "chore: trigger vercel rebuild"
echo === Push ===
git push origin master
echo === DONE ===
pause
