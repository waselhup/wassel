@echo off
cd /d C:\Users\WIN11-24H2GPT\Desktop\wassel-v2
git add client/src/pages/LinkedInAnalyzer.tsx
git add client/src/components/DashboardLayout.tsx
git commit -m "fix: i18n hardcoded strings in LinkedInAnalyzer and DashboardLayout"
git push origin master
