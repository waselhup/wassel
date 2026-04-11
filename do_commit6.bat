@echo off
cd /d C:\Users\WIN11-24H2GPT\Desktop\wassel-v2
git add vercel.json
git commit -m "fix: remove outputDirectory to let Vercel detect api/ functions"
git push origin master
