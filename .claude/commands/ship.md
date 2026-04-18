---
description: Full ship cycle — strip BOMs, rebuild api, commit, push, verify
---

Execute this sequence with NO shortcuts:

1. `node scripts/strip-boms.cjs`
2. `node scripts/auto-rebuild-api.cjs`
3. `npx tsc --noEmit` — must pass
4. `git add -A`
5. `git status --short` — show me what will be committed
6. ASK USER: what commit message? (format: "type: short description")
7. After approval: `git commit -m "<msg>"` && `git push origin master`
8. Wait 90 seconds for Vercel deploy
9. Invoke the verify-app subagent
10. Report: commit hash + deploy URL + verification status

If any step fails → STOP and report. Do NOT proceed.
