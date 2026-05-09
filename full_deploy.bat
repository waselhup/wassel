@echo off
cd /d C:\Users\WIN11-24H2GPT\Desktop\wassel-v2
echo === Rebuilding API ===
call npx esbuild server/_core/vercel.ts --platform=node --bundle --format=cjs --outfile=api/index.js --external:@napi-rs/canvas --external:sharp --external:tesseract.js --external:pdfjs-dist --external:puppeteer-core --external:@sparticuz/chromium
if errorlevel 1 (
  echo === API BUILD FAILED ===
  exit /b 1
)

echo === Building Frontend ===
call npm run build
if errorlevel 1 (
  echo === FRONTEND BUILD FAILED ===
  exit /b 1
)

echo === Deploying ===
call npx vercel deploy --prod --yes
if errorlevel 1 (
  echo === DEPLOY FAILED ===
  exit /b 1
)

echo === Smoke testing production ===
REM Wait 30 seconds for Vercel edge cache to settle, then run smoke test.
REM The smoke test verifies public routes + JS bundles + critical tRPC endpoints.
timeout /t 30 /nobreak
call node scripts/smoke-test-deploy.cjs
if errorlevel 1 (
  echo.
  echo === SMOKE TEST FAILED — production may be broken! ===
  echo Investigate before announcing the deploy.
  exit /b 1
)

echo === DONE ===
pause
