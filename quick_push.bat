@echo off
set PATH=%PATH%;C:\Program Files\Git\cmd
cd /d "C:\Users\WIN11-24H2GPT\Desktop\wassel-v2"
echo === Removing git lock if exists ===
if exist ".git\index.lock" del ".git\index.lock"
echo === Git add ===
git add -A
echo === Git commit ===
git commit -m "fix: add api/package.json with commonjs to fix require error"
echo === Git push ===
git push origin master
echo === DONE ===
pause
