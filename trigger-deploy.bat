@echo off
cd /d "C:\Users\WIN11-24H2GPT\Desktop\wassel-v2"
"C:\Program Files\Git\cmd\git.exe" add .deploy-trigger > deploy-out.txt 2>&1
"C:\Program Files\Git\cmd\git.exe" commit -m "chore: force fresh deploy" >> deploy-out.txt 2>&1
"C:\Program Files\Git\cmd\git.exe" push origin master >> deploy-out.txt 2>&1
"C:\Program Files\Git\cmd\git.exe" log --oneline -5 >> deploy-out.txt 2>&1
