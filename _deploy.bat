@echo off
cd /d C:\Users\WIN11-24H2GPT\Desktop\wassel-v2
"C:\Program Files\Git\bin\git.exe" add -A
"C:\Program Files\Git\bin\git.exe" status
"C:\Program Files\Git\bin\git.exe" commit -m "fix: resolve all TypeScript errors, fix AuthContext return type, rebuild api/index.js"
"C:\Program Files\Git\bin\git.exe" push origin master
echo DONE
