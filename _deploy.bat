@echo off
set PATH=%PATH%;C:\Program Files\Git\cmd
cd /d "C:\Users\WIN11-24H2GPT\Desktop\wassel-v2"
git commit --allow-empty -m "chore: trigger Vercel redeploy after reconnect"
git push origin master
