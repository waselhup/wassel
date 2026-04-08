@echo off
cd /d C:\Users\WIN11-24H2GPT\Desktop\wassel-v2
if exist .git\index.lock del .git\index.lock
echo %date% %time% > .deploy-trigger
"C:\Program Files\Git\cmd\git.exe" add -A
"C:\Program Files\Git\cmd\git.exe" commit -m "chore: trigger deploy with file change"
"C:\Program Files\Git\cmd\git.exe" push origin master
echo PUSH_RESULT=%errorlevel%
