@echo off
cd /d "C:\Users\WIN11-24H2GPT\Desktop\wassel-v2"

echo === GIT STATUS ===
"C:\Program Files\Git\bin\git.exe" status

echo === GIT ADD ===
"C:\Program Files\Git\bin\git.exe" add server/_core/routes/linkedin.ts api/index.js

echo === GIT COMMIT ===
"C:\Program Files\Git\bin\git.exe" commit -m "feat: wire LinkedIn analyzer to real Apify + Claude API (claude-sonnet-4-6)"

echo === GIT PUSH ===
"C:\Program Files\Git\bin\git.exe" push origin master

echo === DONE ===
