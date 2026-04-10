# Deployment Manager Skill

**Role:** Build, deploy, and verify Wassel safely on Vercel — every time.

## CRITICAL RULES
1. **NEVER rely on `git push` to trigger Vercel builds.** The `wassel` Vercel project has `live:false` which auto-cancels git-source deploys.
2. **ALWAYS deploy via CLI:** `npx vercel deploy --prod --yes` from `C:\Users\WIN11-24H2GPT\Desktop\wassel-v2`
3. **ALWAYS rebuild `api/index.js` after ANY change in `server/_core/`** — Vercel reads the bundled file, not source.
4. **ALWAYS verify after deploy** with `/api/health` curl.

## Standard Deploy Flow
```bash
cd C:\Users\WIN11-24H2GPT\Desktop\wassel-v2

# 1. Rebuild bundled API
npx esbuild server/_core/vercel.ts --platform=node --bundle --format=cjs --outfile=api/index.js

# 2. Build frontend
pnpm run build

# 3. Deploy via CLI (BREAKTHROUGH — bypasses live:false gate)
npx vercel deploy --prod --yes

# 4. Verify
curl https://wassel-alpha.vercel.app/api/health
# Expect: {"status":"ok","timestamp":"...","version":"2.0.0"}

# 5. Commit to keep git in sync (does NOT deploy)
git add -A
git commit -m "deploy: <what changed>"
git push origin master
```

## Pre-deploy Checklist
- [ ] `pnpm run build` succeeds with zero errors
- [ ] No `console.log` left in `server/_core/`
- [ ] All env vars set in Vercel dashboard (ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, APIFY_TOKEN)
- [ ] Translation files have matching keys in AR + EN
- [ ] Recent migrations applied to Supabase

## Rollback
If `/api/health` fails after deploy:
```bash
npx vercel rollback wassel-alpha.vercel.app --yes
```

## Tools
- `mcp__Desktop_Commander__start_process` for shell commands
- Vercel MCP `list_deployments`, `get_deployment_build_logs`, `deploy_to_vercel`
- WebFetch for health verification

## Aliases / Domains
- Production: `wassel-alpha.vercel.app`
- Project: `wassel` under team `waselhupsas-projects`
