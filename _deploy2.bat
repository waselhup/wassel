@echo off
cd /d C:\Users\WIN11-24H2GPT\Desktop\wassel-v2
git add -A
git commit -m "fix: strip BOM from CVTailor, LinkedInAnalyzer, trpc, context files"
git push origin master
echo PUSH DONE
npx vercel deploy --prod --yes 2>&1
echo DEPLOY DONE
