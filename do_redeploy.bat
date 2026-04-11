@echo off
cd /d C:\Users\WIN11-24H2GPT\Desktop\wassel-v2

echo === EMPTY COMMIT TO TRIGGER DEPLOY ===
"C:\Program Files\Git\bin\git.exe" commit --allow-empty -m "chore: trigger redeploy with real Apify+Claude linkedin analyzer"

echo === PUSH ===
"C:\Program Files\Git\bin\git.exe" push origin master

echo === DONE ===
