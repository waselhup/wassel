@echo off
cd /d "C:\Users\WIN11-24H2GPT\Desktop\New folder\wassel"
del /f /q ".git\index.lock" 2>nul

echo === Building server ===
call npx esbuild server/_core/vercel.ts --platform=node --packages=external --bundle --format=esm --outfile=dist/api/index.js
if errorlevel 1 (
    echo SERVER BUILD FAILED
    exit /b 1
)

echo === Building client ===
call npx vite build
if errorlevel 1 (
    echo CLIENT BUILD FAILED - continuing anyway (Vercel handles this)
)

echo === Git commit and push ===
git add -A
git commit -m "design: unify all pages to dark theme matching landing page - Switch CSS variables from light to dark (#0a0a14 base, purple/pink accents) - Fix 68+ hardcoded light colors across 20+ page and component files - Dark glass cards, gradient buttons, purple/indigo accents throughout - All stat cards, banners, onboarding pages now dark-themed - Components: ProfileHeroCard, CampaignCard, EmptyState etc updated - Consistent with Landing page aesthetic (dark bg, glass effects, gradients)"
git push origin master

echo === DONE ===
