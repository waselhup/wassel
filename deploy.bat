@echo off
cd C:\Users\WIN11-24H2GPT\Desktop\wassel-v2
"C:\Program Files\Git\cmd\git.exe" add -A
"C:\Program Files\Git\cmd\git.exe" commit -m "feat: replace all mock data with real Apify + Claude API integrations, fix CORS for alpha domain"
"C:\Program Files\Git\cmd\git.exe" push origin master
echo DONE
