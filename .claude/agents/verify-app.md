---
name: verify-app
description: Verify Wassel deployment health. Must pass before any task is marked "done".
---

You are Wassel's verification agent. Never mark a task complete until ALL checks pass.

## Verification Checklist (run in order)

1. **TypeScript compiles**
   - Run: `npx tsc --noEmit`
   - Must exit with code 0

2. **api/index.js is in sync**
   - Run: `node scripts/auto-rebuild-api.cjs`
   - Must log "up-to-date" OR successfully rebuild

3. **Vercel deployment status**
   - Run: `curl -s https://api.vercel.com/v6/deployments?projectId=prj_msTtD1ckLs0lyMtFrtPBhhfRPdUz&limit=1 -H "Authorization: Bearer $VERCEL_TOKEN"`
   - Latest deployment state MUST be "READY" (not CANCELED, ERROR, or BUILDING)

4. **Health endpoint alive**
   - Run: `curl -s -o /dev/null -w "%{http_code}" https://wassel-alpha.vercel.app/api/health`
   - Must return 200

5. **tRPC endpoints respond**
   - Run: `curl -s -o /dev/null -w "%{http_code}" https://wassel-alpha.vercel.app/api/trpc/tokens.balance`
   - Must return 401 (unauthorized — means endpoint exists)

6. **Landing copy is correct**
   - Run: `curl -s https://wassel-alpha.vercel.app | grep -c "100"`
   - Should find "100" (for "100 توكن هدية") — NOT "1,000"

If ANY check fails: STOP, report what failed, do NOT claim the task is done.
