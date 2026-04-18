---
type: decision
updated: 2026-04-18
sources: [CLAUDE.md, .claude/hooks.json, .claude/agents/verify-app.md, .claude/commands/ship.md]
---
# 2026-04-18 — Install Boris Cherny-style Workflow

**TL;DR:** Installed a self-enforcing workflow — PostToolUse hook (BOM stripper + api auto-rebuild), `verify-app` subagent, `/ship` slash command, and a "Lessons Learned" section in root CLAUDE.md. Goal: stop re-hitting the same bugs.

## Context
Recurring pain from prior sessions:
- Desktop Commander `write_file` was injecting UTF-8 BOMs that broke TypeScript/esbuild
- Changes to `server/_core/*` needed a manual `npx esbuild` step; easy to forget
- Parallel Claude Code sessions pushing to `master` caused Vercel to cancel all but one deploy
- "Ready" status in Vercel UI sometimes referred to a stale redeploy, not the current commit

## Commit
`d9d5f05` — chore: install Boris-style workflow (hooks, verify-app, /ship, lessons)

## Why
Reduce prompt length by ~40%+ by letting hooks and the verify-app subagent do enforcement instead of re-stating rules in every prompt.

## Outcome
- **Hooks** — PostToolUse runs `strip-boms.cjs` + `auto-rebuild-api.cjs` after every Write/Edit
- **verify-app** — 6-check deployment health agent (see [[recurring-issues]])
- **/ship** — deterministic ship sequence (strip → rebuild → tsc → commit → push → verify)
- **CLAUDE.md** — "Lessons Learned" (8 items) + "Three Core Principles" appended

## Follow-ups
- Rotate stale VERCEL_TOKEN (Ali)
- Self-improving wiki system (this file lives in it) — feeds insights back into [[ali-founder]]'s future Claude sessions

## Related
- [[recurring-issues]]
- [[stack]], [[deployment]]
- [[ali-founder]]
