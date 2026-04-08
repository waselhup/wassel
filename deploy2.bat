@echo off
cd C:\Users\WIN11-24H2GPT\Desktop\wassel-v2
"C:\Program Files\Git\cmd\git.exe" add -A
"C:\Program Files\Git\cmd\git.exe" commit -m "fix: bundle supabase into api/index.js to fix FUNCTION_INVOCATION_FAILED"
"C:\Program Files\Git\cmd\git.exe" push origin master
echo DONE
