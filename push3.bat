@echo off
cd /d "C:\Users\WIN11-24H2GPT\Desktop\wassel-v2"
set GIT="C:\Program Files\Git\cmd\git.exe"
%GIT% rev-parse HEAD > push3-result.txt 2>&1
%GIT% commit --allow-empty -m "chore: redeploy bundled api fix" >> push3-result.txt 2>&1
echo --- PUSH --- >> push3-result.txt
%GIT% push origin master >> push3-result.txt 2>&1
echo --- NEW HEAD --- >> push3-result.txt
%GIT% rev-parse HEAD >> push3-result.txt 2>&1
