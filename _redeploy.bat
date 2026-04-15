@echo off
cd /d C:\Users\WIN11-24H2GPT\Desktop\wassel-v2
"C:\Program Files\Git\bin\git.exe" commit --allow-empty -m "chore: trigger redeploy" > _redeploy_out.txt 2>&1
"C:\Program Files\Git\bin\git.exe" push origin master >> _redeploy_out.txt 2>&1
echo DONE >> _redeploy_out.txt
