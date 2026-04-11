@echo off
cd /d C:\Users\WIN11-24H2GPT\Desktop\wassel-v2
git commit --allow-empty -m "chore: trigger clean Vercel deploy for OAuth routes"
git push origin master
echo DONE
