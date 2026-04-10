@echo off
cd /d "C:\Users\WIN11-24H2GPT\Desktop\wassel-v2"
set GIT="C:\Program Files\Git\cmd\git.exe"
%GIT% log --oneline -3 > push-result.txt 2>&1
echo --- PUSH --- >> push-result.txt
%GIT% push origin master --force >> push-result.txt 2>&1
echo --- HEAD --- >> push-result.txt
%GIT% rev-parse HEAD >> push-result.txt 2>&1
