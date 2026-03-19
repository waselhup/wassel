# CLAUDE.md — Wassel Project Instructions

## Project Overview
Wassel (وصل) is a LinkedIn automation SaaS platform deployed at https://wassel-alpha.vercel.app
Repo: https://github.com/waselhup/wassel (private, `master` branch)

## CRITICAL: Build & Deploy Process

### The ONLY correct build commands (run from project root):
```bash
# Step 1: Build server (esbuild bundles to dist/api/index.js)
npx esbuild server/_core/vercel.ts --platform=node --packages=external --bundle --format=esm --outfile=dist/api/index.js

# Step 2: Build client (vite builds to dist/public/)
npx vite build

# Step 3: Commit and push (Vercel auto-deploys on push to master)
git add -A && git commit -m "description" && git push origin master
```

### IMPORTANT Build Notes:
- **Windows machine** — always wrap commands: `cmd /c "command here"`
- **npm, NOT pnpm** for installs: `npm install --legacy-peer-deps`
- The server entry point is `server/_core/vercel.ts` → bundled to `dist/api/index.js`
- The client entry point is Vite → output to `dist/public/`
- vercel.json routes `/api/*` to the serverless function at `api/index.js`
- `package.json` has `"type": "module"` — the `api/package.json` with `{"type": "commonjs"}` is REQUIRED to prevent ESM/CJS mismatch crashes
- Build takes ~7s for client, ~20ms for server
- **DO NOT modify the build pipeline or vercel.json unless absolutely necessary**

## Architecture

### Routing (wouter, NOT React Router):
```
import { Route, Switch, useLocation, Link } from 'wouter';
```

### Route Guards in App.tsx:
- `ProtectedRoute` — requires authenticated user
- `AdminRoute` — requires super_admin role
- `ClientRoute` — requires auth + linkedinConnected + extensionInstalled

### Server Routes (Express, mounted in server/_core/vercel.ts):
| Path | File | Auth |
|------|------|------|
| `/api/user/profile` | userRoutes.ts | JWT in Authorization header |
| `/api/linkedin/connect` | linkedinOAuthRoutes.ts | Public (starts OAuth) |
| `/api/linkedin/callback` | linkedinOAuthRoutes.ts | Public (OAuth callback) |
| `/api/ext/*` | extensionRoutes.ts | expressAuthMiddleware |
| `/api/sequence/*` | sequenceRoutes.ts | expressAuthMiddleware |
| `/api/admin/*` | adminRoutes.ts | super_admin role |
| `/api/auth/*` | authRoutes.ts | Various |
| `/api/stripe/*` | stripeRoutes.ts | Webhook: none, others: auth |
| `/api/health` | inline in vercel.ts | None |

### Database (Supabase PostgreSQL):
Key columns on `profiles` table:
- `extension_installed BOOLEAN DEFAULT false`
- `linkedin_connected BOOLEAN DEFAULT false`
- `role` — 'super_admin' or 'client_user'

### Frontend State:
- Auth state managed in `client/src/contexts/AuthContext.tsx`
- `AuthUser` type has: `extensionInstalled`, `linkedinConnected`, `role`, `accessToken`
- CSS uses custom properties from `client/src/index.css` (not Tailwind utility colors)
- i18n: Arabic is default language, translations at `client/public/locales/{ar,en}/translation.json`
- Arabic font: Cairo (from Google Fonts)

### Chrome Extension:
- Located at `apps/extension/`
- `manifest.json` — Manifest V3, matches LinkedIn + wassel-alpha.vercel.app
- `content.js` — LinkedIn content script (prospect scraping sidebar)
- `wassel_detect.js` — Detection script for Wassel domain (sets data-wassel-extension="true")
- `background.js` — Service worker
- `popup.html` + `popup.js` — Extension popup

## Environment Variables (set in Vercel):
- `VITE_SUPABASE_URL` / `SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Supabase anon key (frontend)
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (server only)
- `LINKEDIN_CLIENT_ID` — LinkedIn app client ID
- `LINKEDIN_CLIENT_SECRET` — LinkedIn app client secret
- `LINKEDIN_REDIRECT_URI` — `https://wassel-alpha.vercel.app/api/linkedin/callback`
- `DASHBOARD_ORIGIN` — `https://wassel-alpha.vercel.app`

## User Onboarding Flow:
```
Landing (/) → Login (/login) → LinkedIn Connect (/onboarding/linkedin) 
→ Extension Install (/onboarding/extension) → Dashboard (/app)
```

## Testing After Deploy:
```bash
# Wait 40-60s after push for Vercel to deploy, then:
curl -s https://wassel-alpha.vercel.app/api/health
# Should return: {"ok":true}
```

## Common Pitfalls:
1. Never use `pnpm` for install — use `npm install --legacy-peer-deps`
2. Never use React Router imports — this project uses `wouter`
3. Never mention "Waalaxy" in customer-facing code
4. Always use `cmd /c "..."` on Windows for npm/git commands
5. The `api/package.json` with `{"type":"commonjs"}` MUST exist — without it, all API routes return 500
6. Arabic is the primary language — all UI must be RTL-compatible
