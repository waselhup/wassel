@echo off
cd /d C:\Users\WIN11-24H2GPT\Desktop\wassel-v2

echo === DIFF linkedin.ts ===
"C:\Program Files\Git\bin\git.exe" diff server/_core/routes/linkedin.ts

echo === FORCE ADD ALL CHANGED FILES ===
"C:\Program Files\Git\bin\git.exe" add -A

echo === STATUS AFTER ADD ===
"C:\Program Files\Git\bin\git.exe" status --short

echo === COMMIT ===
"C:\Program Files\Git\bin\git.exe" commit -m "feat: wire LinkedIn analyzer to real Apify + Claude API (claude-sonnet-4-6)"

echo === PUSH ===
"C:\Program Files\Git\bin\git.exe" push origin master

echo === DONE ===
