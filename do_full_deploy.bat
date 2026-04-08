@echo off
cd /d "C:\Users\WIN11-24H2GPT\Desktop\wassel-v2"

echo === Delete lock file if exists ===
if exist .git\index.lock del .git\index.lock

echo === Rebuild api/index.js as CJS ===
node node_modules\esbuild\bin\esbuild server/_core/vercel.ts --platform=node --bundle --format=cjs --outfile=api/index.js
if %errorlevel% neq 0 (
    echo BUILD FAILED!
    exit /b 1
)

echo === Verify CJS format ===
findstr /c:"use strict" api\index.js >nul 2>&1
if %errorlevel%==0 (echo OK: CJS format confirmed) else (echo WARNING: may not be CJS)

echo === Git add all ===
"C:\Program Files\Git\cmd\git.exe" add -A

echo === Git commit ===
"C:\Program Files\Git\cmd\git.exe" commit -m "feat: wassel v2 with CJS api fix"

echo === Force push to master ===
"C:\Program Files\Git\cmd\git.exe" push origin master --force
echo PUSH_RESULT=%errorlevel%
