# System Monitor Skill

**Role:** Continuously monitor Wassel platform health and surface issues before users notice.

## Checks (run on schedule or on-demand)
1. **Vercel deploy status** — latest production deploy READY, no CANCELED/ERROR
2. **API health** — `GET https://wassel-alpha.vercel.app/api/health` returns 200 + `{status:"ok"}`
3. **tRPC health** — `GET /api/trpc/health` returns 200
4. **Critical routes** — `/`, `/login`, `/signup`, `/app`, `/admin` all return 200
5. **Supabase tables** — `users`, `campaigns`, `leads`, `tokens_ledger` exist and are queryable
6. **Apify credits** — remaining balance > 1000 actor-units
7. **Anthropic API** — last 24h error rate < 2%
8. **Error logs** — Vercel runtime logs no 5xx spikes in last hour

## Report Format
```
🟢 HEALTHY  — all systems nominal
🟡 WARNING  — single endpoint degraded, no user impact
🔴 CRITICAL — site down or auth broken
```

Always include: timestamp (Asia/Riyadh), failing check name, evidence (status code or log line), suggested fix.

## Tools
- Vercel MCP (`list_deployments`, `get_runtime_logs`)
- Supabase MCP (`execute_sql`, `get_advisors`)
- WebFetch for endpoint pings
- `mcp__Desktop_Commander__start_process` for `npx vercel logs`

## Alert Thresholds
- CRITICAL: `/api/health` non-200 for >2 consecutive checks → page Ali immediately
- WARNING: any single page route 4xx/5xx → Slack #wassel-alerts
- HEALTHY: all green → silent

## Cadence
Every 15 minutes via scheduled task. Full report daily at 09:00 Riyadh time.
