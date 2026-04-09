@echo off
cd /d "C:\Users\WIN11-24H2GPT\Desktop\wassel-v2"
"C:\Program Files\Git\cmd\git.exe" add api/index.js api/package.json server/_core/trpc.ts server/_core/trpc-init.ts server/_core/routes/admin.ts server/_core/routes/campaign.ts server/_core/routes/cv.ts server/_core/routes/linkedin.ts server/_core/routes/tokens.ts
echo --- STATUS ---
"C:\Program Files\Git\cmd\git.exe" status --short
echo --- COMMIT ---
"C:\Program Files\Git\cmd\git.exe" commit -m "fix: break tRPC circular import + bundle api/index.js with esbuild" -m "Extract router/procedure init into trpc-init.ts to break circular import. Routes now import from trpc-init instead of trpc. Rebuild api/index.js as bundled CJS via esbuild with footer to expose Express app as module.exports."
echo COMMIT_EXIT=%ERRORLEVEL%
echo --- PUSH ---
"C:\Program Files\Git\cmd\git.exe" push origin master
echo PUSH_EXIT=%ERRORLEVEL%
echo --- LOG ---
"C:\Program Files\Git\cmd\git.exe" log --oneline -5
