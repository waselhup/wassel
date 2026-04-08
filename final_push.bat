@echo off
cd /d "C:\Users\WIN11-24H2GPT\Desktop\wassel-v2"
if exist .git\index.lock del .git\index.lock
"C:\Program Files\Git\cmd\git.exe" commit --allow-empty -m "chore: trigger clean Vercel deploy for wassel-v2 CJS fix"
"C:\Program Files\Git\cmd\git.exe" push origin master
echo DONE=%errorlevel%
