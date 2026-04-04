@echo off
cd /d "C:\Users\WIN11-24H2GPT\Desktop\New folder\wassel"
del /f /q ".git\HEAD.lock" 2>nul
del /f /q ".git\index.lock" 2>nul

echo Building server...
call npx esbuild server/_core/vercel.ts --platform=node --packages=external --bundle --format=esm --outfile=dist/api/index.js 2>&1

"C:\Program Files\Git\cmd\git.exe" add server/_core/context.ts server/_core/extensionRoutes.ts apps/extension/background.js
"C:\Program Files\Git\cmd\git.exe" commit -m "fix: add expired JWT recovery to tRPC context - fixes 401 on campaign create"
"C:\Program Files\Git\cmd\git.exe" push origin master
