@echo off
cd /d C:\Users\WIN11-24H2GPT\Desktop\wassel-v2
git add client/src/lib/analytics.ts
git add client/src/main.tsx
git add client/src/App.tsx
git add client/src/contexts/AuthContext.tsx
git add package.json
git add package-lock.json
git add api/index.js
git commit -m "feat: add PostHog analytics + Sentry error tracking (STEP 4)"
git push origin master
