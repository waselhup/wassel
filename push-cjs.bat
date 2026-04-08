@echo off
cd /d C:\Users\WIN11-24H2GPT\Desktop\wassel-v2
if exist .git\index.lock del .git\index.lock
C:\PROGRA~1\Git\cmd\git.exe add api/index.js server/_core/vercel.ts build-server.js
C:\PROGRA~1\Git\cmd\git.exe commit -m "fix: rebuild api/index.js as CJS with module.exports"
C:\PROGRA~1\Git\cmd\git.exe push origin master
echo DONE
