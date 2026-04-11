@echo off
cd /d C:\Users\WIN11-24H2GPT\Desktop\wassel-v2
git add api/index.js server/_core/routes/linkedin.ts supabase/migrations/20260411_add_ai_cache_table.sql
git commit -m "perf: ai cost reduction - haiku for linkedin, 24h cache"
git push origin master
echo DONE
