@echo off
echo === HEALTH CHECK ===
curl -s https://wassel-alpha.vercel.app/api/health
echo.
echo === DONE ===
