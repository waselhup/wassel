@echo off
set PATH=%PATH%;C:\Program Files\Git\cmd
cd /d "C:\Users\WIN11-24H2GPT\Desktop\wassel-v2"
git add api/index.js client/public/locales/ar/translation.json client/public/locales/en/translation.json client/src/components/DashboardLayout.tsx client/src/pages/CVTailor.tsx client/src/pages/LinkedInAnalyzer.tsx
git commit -m "fix: translations and component fixes for steps 1-4"
git push origin master
