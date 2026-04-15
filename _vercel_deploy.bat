@echo off
set "PATH=C:\Program Files\nodejs;C:\Users\WIN11-24H2GPT\AppData\Roaming\npm;C:\Program Files\Git\bin;%SystemRoot%\system32;%SystemRoot%"
cd /d "C:\Users\WIN11-24H2GPT\Desktop\wassel-v2"
"C:\Program Files\nodejs\node.exe" "C:\Users\WIN11-24H2GPT\AppData\Roaming\npm\node_modules\vercel\dist\index.js" deploy --prod --yes > "_deploy_out.txt" 2>&1
echo EXIT=%ERRORLEVEL% >> "_deploy_out.txt"
