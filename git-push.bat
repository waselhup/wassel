@echo off
cd /d C:\Users\WIN11-24H2GPT\Desktop\wassel-v2
git commit -m "feat: wassel-v2 complete platform"
git branch -M master
git remote add origin https://github.com/waselhup/wassel-v2.git
git push -u origin master --force
