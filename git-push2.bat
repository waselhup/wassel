@echo off
cd /d C:\Users\WIN11-24H2GPT\Desktop\wassel-v2
git remote remove origin 2>nul
git remote add origin https://github.com/waselhup/wassel.git
git push -u origin master --force
