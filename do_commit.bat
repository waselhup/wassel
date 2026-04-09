@echo off
set PATH=%PATH%;C:\Program Files\Git\cmd
cd /d "C:\Users\WIN11-24H2GPT\Desktop\wassel-v2"
if exist ".git\index.lock" del ".git\index.lock"
git add -A
git commit -m "fix: add api runtime dependencies for Vercel"
git push origin master --force
echo === DONE ===
