@echo off
cd /d C:\Users\WIN11-24H2GPT\Desktop\wassel-v2
"C:\Program Files\Git\bin\git.exe" commit --allow-empty -m "chore: force redeploy after build queue clear"
"C:\Program Files\Git\bin\git.exe" push origin master
echo PUSHED
