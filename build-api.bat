@echo off
cd /d "C:\Users\WIN11-24H2GPT\Desktop\wassel-v2"
"C:\Program Files\nodejs\node.exe" node_modules\esbuild\bin\esbuild server/_core/vercel.ts --platform=node --bundle --format=cjs --outfile=api/index.js "--footer:js=module.exports = module.exports.default || module.exports;"
echo EXITCODE=%ERRORLEVEL%
