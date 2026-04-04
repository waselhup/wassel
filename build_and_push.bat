@echo off
cd /d "C:\Users\WIN11-24H2GPT\Desktop\New folder\wassel"
del /f /q ".git\index.lock" 2>nul

echo === Building server ===
call npx esbuild server/_core/vercel.ts --platform=node --packages=external --bundle --format=esm --outfile=dist/api/index.js
if errorlevel 1 (
    echo BUILD FAILED
    pause
    exit /b 1
)

echo === Building client ===
call npx vite build
if errorlevel 1 (
    echo CLIENT BUILD FAILED
    pause
    exit /b 1
)

echo === Git commit and push ===
git add -A
git commit -m "feat: extension-based LinkedIn execution (Waalaxy approach) - Add GET /api/ext/pending-actions and POST /api/ext/report-action endpoints - Rewrite background.js v6.0 with Voyager API execution from browser - Extension polls server, executes LinkedIn actions using native cookies/IP - campaignCron.ts now scheduler-only (no direct LinkedIn API calls) - No LinkedIn tab needed - service worker makes direct fetch() calls Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
git push origin master

echo === DONE ===
pause
