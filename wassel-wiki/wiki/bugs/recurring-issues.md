---
type: bug
updated: 2026-04-18
sources: [CLAUDE.md]
---
# Recurring Issues — Lessons Learned

**TL;DR:** The 8 recurring issues Ali has seen enough times that they're now enforced by hooks, the verify-app subagent, or root CLAUDE.md rules. Every Claude session should read this before touching code.

## The 8 lessons (from root CLAUDE.md)

1. **BOM breaks builds** — Desktop Commander `write_file` injects UTF-8 BOMs; always use Node `fs.writeFileSync 'utf8'` or PowerShell `WriteAllText`. PostToolUse hook now auto-strips BOMs. See [[2026-04-18-boris-workflow]].

2. **api/index.js must rebuild after ANY `server/_core/*` change** — stale bundles cause "why isn't my fix live?" confusion. PostToolUse hook now auto-rebuilds via `scripts/auto-rebuild-api.cjs`.

3. **Vercel cancels parallel deploys** — running multiple Claude Code sessions pushing to master simultaneously = all but one get CANCELED. Use separate git checkouts, coordinate pushes.

4. **"Ready" in Vercel UI can be a stale Redeploy** — always verify by commit hash, not by status color. verify-app check 3 asserts this.

5. **DB schema can drift from code silently** — tRPC errors look like API bugs but the root cause may be missing tables/columns. Verify schema with Supabase MCP before any DB-dependent feature work.

6. **Mock data in admin pages is deceptive** — `AdminUsers.tsx` uses a hardcoded users array; wire to real `admin.listUsers` tRPC before claiming the admin panel "works".

7. **Don't mention Apify, Waalaxy, or LinkedIn automation in UI** — Wassel is a legal/compliant Saudi career platform aligned with Vision 2030. The word is "اكتشاف" (discovery), never "scraping". Applies to [[smart-outreach]] especially.

8. **Plan Mode first for non-trivial tasks** — no writing code before plan is approved.

## Related
- [[2026-04-18-boris-workflow]] — installed the workflow that enforces lessons 1–4
- [[smart-outreach]] — lesson 7 applies here most
- [[ali-founder]] — source of the lessons
- [[stack]], [[deployment]] — lessons 2, 3, 4 live here
