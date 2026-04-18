---
type: decision
updated: 2026-04-18
sources: [CLAUDE.md, .claude/agents/verify-app.md, .claude/commands/ship.md]
---
# Deployment

**TL;DR:** Push to `origin/master` → Vercel auto-deploys. Always rebuild `api/index.js` from `server/_core/vercel.ts` first. Use `/ship` for the full deterministic sequence; use `verify-app` subagent to prove the deploy is actually live.

## Build + deploy sequence (mandatory order)
1. `node scripts/strip-boms.cjs` — clean any BOMs (PostToolUse hook also does this)
2. `node scripts/auto-rebuild-api.cjs` — rebuild only if `server/_core/*` changed
3. `npx tsc --noEmit` — must pass
4. `git add -A && git commit -m "<type>: <description>"`
5. `git push origin master`
6. Wait ~90s for Vercel
7. Invoke `verify-app` subagent

Or run `/ship` to do all of the above.

## Non-negotiables
- **Never** edit `api/index.js` manually — always regenerate via esbuild (see [[recurring-issues]] lesson 2)
- **Never** change `SUPABASE_URL` to a different project
- **Never** push multiple Claude sessions to master in parallel — Vercel cancels all but one ([[recurring-issues]] lesson 3)

## Production URLs
- App: https://wassel-alpha.vercel.app
- API health: https://wassel-alpha.vercel.app/api/health
- tRPC sample: https://wassel-alpha.vercel.app/api/trpc/token.balance (returns 401 for unauth — correct signal)

## Vercel
- Project: `prj_msTtD1ckLs0lyMtFrtPBhhfRPdUz`
- Team: `team_2tP8mn672ZnaOchbse2uKBT7`
- `VERCEL_TOKEN` in root CLAUDE.md — stale as of 2026-04-18; Ali needs to rotate at vercel.com/account/tokens

## Related
- [[stack]]
- [[2026-04-18-boris-workflow]]
- [[recurring-issues]]
