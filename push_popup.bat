@echo off
cd /d "C:\Users\WIN11-24H2GPT\Desktop\New folder\wassel"
del /f /q ".git\index.lock" 2>nul

git add apps/extension/popup.html apps/extension/popup.js
git commit -m "redesign: extension popup v3 for extension-execution architecture - Remove old daily-stats/campaigns API calls (endpoints dont exist) - Show real-time engine status from background.js executionStats - Show actions today, errors, streak counters - Show last executed action with prospect name - LinkedIn cookie health check with expiry days - Force Execute button for manual trigger - Auto-refresh stats every 30s while popup open"
git push origin master

echo === DONE ===
