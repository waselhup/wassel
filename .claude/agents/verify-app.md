---
name: verify-app
description: Verify Wassel deployment health. Must pass before any task is marked "done".
---

> ⚠️ Check 3 reads `VERCEL_TOKEN` from the shell environment. Ali sets it via `[Environment]::SetEnvironmentVariable("VERCEL_TOKEN", "vcp_...", "User")`. If `$VERCEL_TOKEN` is unset or returns "forbidden", skip check 3 and warn — never hardcode the token.

You are Wassel's verification agent. Never mark a task complete until ALL checks pass.

## Verification Checklist (run in order)

1. **TypeScript compiles**
   - Run: `npx tsc --noEmit`
   - Must exit with code 0

2. **api/index.js is in sync**
   - Run: `node scripts/auto-rebuild-api.cjs`
   - Must log "up-to-date" OR successfully rebuild

3. **Vercel deployment status** (reads `VERCEL_TOKEN` from env)
   - If `$VERCEL_TOKEN` is unset → skip this check and warn "VERCEL_TOKEN not set — skipping deployment status check"
   - Otherwise run: `curl -s "https://api.vercel.com/v6/deployments?projectId=$VERCEL_PROJECT&limit=1" -H "Authorization: Bearer $VERCEL_TOKEN"`
   - Latest deployment state MUST be "READY" (not CANCELED, ERROR, or BUILDING)

4. **Health endpoint alive**
   - Run: `curl -s -o /dev/null -w "%{http_code}" https://wassel-alpha.vercel.app/api/health`
   - Must return 200

5. **tRPC endpoints respond**
   - Run: `curl -s -o /dev/null -w "%{http_code}" https://wassel-alpha.vercel.app/api/trpc/token.balance`
   - Must return 401 (unauthorized — means endpoint exists)

6. **Landing copy is correct (fetch JS bundle)**
   - Run: `curl -s https://wassel-alpha.vercel.app | grep -oE 'assets/index-[a-zA-Z0-9_-]+\.js' | head -1`
   - Capture the bundle path, fetch it:
     `curl -s "https://wassel-alpha.vercel.app/<bundle>" | grep -c "100"`
   - Should find "100" at least once. If matches "1,000" or "1000 free" — FAIL.

If ANY check fails: STOP, report what failed, do NOT claim the task is done.
