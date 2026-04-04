@echo off
cd /d "C:\Users\WIN11-24H2GPT\Desktop\New folder\wassel"
del /f /q ".git\index.lock" 2>nul

echo === Building server ===
call npx esbuild server/_core/vercel.ts --platform=node --packages=external --bundle --format=esm --outfile=dist/api/index.js
if errorlevel 1 (
    echo BUILD FAILED
    exit /b 1
)

echo === Git commit and push ===
git add -A
git commit -m "fix: auth middleware - recover user from expired JWT for extension polling"
git push origin master

echo === DONE ===
