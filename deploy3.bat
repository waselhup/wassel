@echo off
cd C:\Users\WIN11-24H2GPT\Desktop\wassel-v2
"C:\Program Files\Git\cmd\git.exe" add -A
"C:\Program Files\Git\cmd\git.exe" commit -m "fix: switch api/index.js to ESM format with export default for Vercel compatibility"
"C:\Program Files\Git\cmd\git.exe" push origin master
echo DONE
