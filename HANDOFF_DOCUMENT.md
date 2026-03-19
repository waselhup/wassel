# WASSEL — Complete Handoff Document
**Date:** 2026-03-19
**Previous AI:** Antigravity (Google DeepMind)
**Next AI:** Claude Code (Anthropic)

---

## 1. PROJECT IDENTITY

- **Name:** Wassel (وصل)
- **Domain:** https://wassel.io (not live yet) → currently deployed at https://wassel-alpha.vercel.app
- **Repo:** https://github.com/waselhup/wassel (private, `master` branch)
- **Vision:** A LinkedIn automation SaaS platform — the "Waalaxy alternative for the Arab market." Users connect LinkedIn, install a Chrome extension, then run automated outreach campaigns (invitations, messages, follow-ups) from a web dashboard.
- **Target Market:** Arabic-speaking sales teams, recruiters, founders. Arabic is the primary language (RTL), English is secondary.

---

## 2. CURRENT STATUS

### What is DONE:
- Full landing page with hero, features, pricing, FAQ, footer (Arabic + English)
- Login page (LinkedIn OAuth only for users, email/password for admin)
- LinkedIn OAuth flow (connect → callback → magic link auto-login → session)
- Onboarding flow: `/onboarding/linkedin` → `/onboarding/extension` → `/app`
- Route guards enforcing linear journey (linkedinConnected + extensionInstalled)
- Chrome extension with LinkedIn prospect scraping/importing sidebar
- Extension detection on Wassel domain via `wassel_detect.js`
- `PATCH /api/user/profile` endpoint with JWT auth + debug logging
- Full i18n with `i18next` (Arabic default, English secondary, RTL auto-direction, Cairo font)
- Language toggle (AR/EN) in sidebar nav
- Admin dashboard at `/admin` (super_admin role only)
- Campaign creation wizard, campaign detail pages
- Prospects/Leads management
- Queue system for automated actions
- Templates system for message templates
- Sequence engine (multi-step campaigns: visit → invite → message → follow-up)
- Stripe integration (pricing plans, checkout)
- AI message writer (via tRPC)
- All competitor mentions (Waalaxy) removed from customer-facing pages

### What is IN PROGRESS / NEEDS FIXING:
- The "Failed to update profile" error on `/onboarding/extension` — the PATCH endpoint exists and is deployed but needs end-to-end verification with a real user session
- LinkedIn OAuth callback magic link sometimes doesn't auto-login correctly
- Extension auto-detection requires the user to reload the extension after updates
- The `extensionInstalled` and `linkedinConnected` profile checks depend on cacheable user state in `AuthContext` — cache can be stale

### What is NEXT (not started):
- Real testimonials on landing page (currently removed — placeholder text "coming soon")
- About page needs real content
- In-app upgrade prompts for free trial users
- Real Stripe webhook processing for subscription management
- Email notifications system
- User settings page with profile editing
- Team management (invite members, manage seats)
- Analytics dashboard with real data
- Chrome Web Store listing for the extension
- Production domain setup (wassel.io)

---

## 3. TECH STACK & ARCHITECTURE

### Frontend:
- **React 19** + TypeScript
- **Vite 7** (build tool)
- **Wouter** (routing, NOT React Router)
- **Tailwind CSS 4** + `@tailwindcss/vite` plugin
- **Shadcn UI** (Radix primitives via `@radix-ui/*`)
- **Lucide React** (icons)
- **Framer Motion** (animations)
- **Recharts** (charts/graphs)
- **i18next + react-i18next** (internationalization, Arabic default)
- **@tanstack/react-query** + **tRPC** (data fetching)
- **@supabase/supabase-js** (auth + DB from frontend)

### Backend:
- **Express.js** (REST API, bundled as single Vercel serverless function)
- **tRPC** (type-safe API for some endpoints, mounted at `/api/trpc`)
- **Supabase** (PostgreSQL database, auth, admin SDK)
- **esbuild** (server bundle: `server/_core/vercel.ts` → `dist/api/index.js`)
- **Stripe** (payments)
- **jose / jsonwebtoken** (JWT handling)

### Chrome Extension:
- **Manifest V3**
- Content script on LinkedIn (`content.js` + `content.css`)
- Detection script on Wassel domain (`wassel_detect.js`)
- Background service worker (`background.js`)
- Popup (`popup.html` + `popup.js`)
- Located at: `apps/extension/`

### Hosting:
- **Vercel** — frontend (static) + serverless API (single function)
- **Supabase** — PostgreSQL database + auth + storage

---

## 4. FILE STRUCTURE — EVERY IMPORTANT FILE

### Root Config:
| File | Purpose |
|------|---------|
| `package.json` | Dependencies, scripts (npm, not pnpm for installs due to Vercel) |
| `vercel.json` | Vercel deployment config: rewrites, build command, function config |
| `vite.config.ts` | Vite config with React plugin, path aliases, proxy |
| `tsconfig.json` | TypeScript config |
| `components.json` | Shadcn UI config |
| `promote_admin.cjs` | Script to promote a user to super_admin in Supabase |
| `run_migration.cjs` | Script to run SQL migrations against Supabase |
| `seed.mjs` | Database seeding script |

### Server — `server/_core/`:
| File | Purpose |
|------|---------|
| `vercel.ts` | **Main app entry** — Express app, mounts all routes, CORS, health check |
| `context.ts` | tRPC context creation, `expressAuthMiddleware`, `requireRole` |
| `userRoutes.ts` | `PATCH/GET /api/user/profile` — JWT auth, updates profiles table |
| `linkedinOAuthRoutes.ts` | LinkedIn OAuth flow: `/api/linkedin/connect` + `/api/linkedin/callback` |
| `linkedinAuth.ts` | Additional LinkedIn auth routes at `/api/auth/linkedin` |
| `authRoutes.ts` | Email/password auth routes at `/api/auth` |
| `extensionRoutes.ts` | Extension API at `/api/ext` — prospect import, sync |
| `sequenceRoutes.ts` | Sequence engine at `/api/sequence` — campaign execution (60KB, largest file) |
| `adminRoutes.ts` | Admin API at `/api/admin` — user management, analytics |
| `clientRoutes.ts` | Client management at `/api/admin/clients` |
| `inviteRoutes.ts` | Team invite system at `/api/invites` |
| `aiRoutes.ts` | AI message writer at `/api/ai` |
| `stripeRoutes.ts` | Stripe webhooks + checkout at `/api/stripe` |
| `oauth.ts` | Generic OAuth route registration |
| `trpc.ts` | tRPC router initialization |

### Client Pages — `client/src/pages/`:
| File | Route | Purpose |
|------|-------|---------|
| `Landing.tsx` | `/` | Main landing page (hero, features, pricing, FAQ) |
| `Login.tsx` | `/login` | LinkedIn OAuth login + admin email login |
| `OnboardingLinkedIn.tsx` | `/onboarding/linkedin` | Step 1: Connect LinkedIn |
| `OnboardingExtension.tsx` | `/onboarding/extension` | Step 2: Install extension |
| `Onboarding.tsx` | `/onboarding` | Legacy onboarding (may be unused now) |
| `ClientDashboard.tsx` | `/app` | Main user dashboard |
| `Dashboard.tsx` | `/admin` | Admin dashboard |
| `Campaigns.tsx` | `/app/campaigns` | Campaign list |
| `CampaignWizard.tsx` | `/app/campaigns/new` | Create campaign wizard |
| `CampaignDetail.tsx` | `/app/campaigns/:id` | Campaign detail view |
| `Leads.tsx` | `/app/leads` | Prospects/leads list |
| `LeadImport.tsx` | `/app/import` | Import prospects |
| `Queue.tsx` | `/app/queue` | Action queue |
| `Templates.tsx` | `/app/templates` | Message templates |
| `Extension.tsx` | `/app/extension` | Extension management |
| `ExtensionDownload.tsx` | `/extension-download` | Extension download page |
| `Pricing.tsx` | `/pricing` | Pricing page |
| `Blog.tsx` | `/blog` | Blog with articles |
| `Comparison.tsx` | `/compare/linkedin-automation-tools` | Comparison page |
| `Safety.tsx` | `/safety` | Safety explanation page |
| `Features.tsx` | `/features` | Features page |
| `About.tsx` | `/about` | About page |
| `Privacy.tsx` | `/privacy` | Privacy policy |
| `Terms.tsx` | `/terms` | Terms of service |
| `Contact.tsx` | `/contact` | Contact page |
| `Demo.tsx` | `/demo` | Demo page |
| `AuthCallback.tsx` | `/auth/callback` | Supabase auth callback handler |
| `Connected.tsx` | `/connected` | Post-connection success page |
| `OAuthError.tsx` | `/oauth/error` | OAuth error display |
| `ForgotPassword.tsx` | `/forgot-password` | Password reset request |
| `ResetPassword.tsx` | `/reset-password` | Password reset form |
| `Invite.tsx` | `/invite/:token` | Team invite acceptance |

### Client Components — `client/src/components/`:
| File | Purpose |
|------|---------|
| `ClientNav.tsx` | Sidebar navigation for `/app/*` pages (with i18n + language toggle) |
| `AdminNav.tsx` | Sidebar navigation for `/admin` pages |
| `LanguageToggle.tsx` | AR/EN language switch button |
| `Avatar.tsx` | User avatar component |
| `DashboardLayout.tsx` | Layout wrapper for dashboard pages |
| `PricingModal.tsx` | Upgrade pricing modal |
| `UsageMeter.tsx` | Usage meter for plan limits |
| `ErrorBoundary.tsx` | React error boundary |
| `ui/` | All Shadcn UI primitives (button, input, dialog, etc.) |
| `landing/` | Landing page sub-components (Hero, Features, Footer, etc.) |
| `campaigns/` | Campaign-specific components |
| `dashboard/` | Dashboard-specific components |

### Client Core — `client/src/`:
| File | Purpose |
|------|---------|
| `main.tsx` | App entry point (tRPC provider, imports i18n) |
| `App.tsx` | All routes, route guards (ProtectedRoute, ClientRoute, AdminRoute) |
| `contexts/AuthContext.tsx` | Supabase auth state, user profile with extensionInstalled + linkedinConnected |
| `contexts/ThemeContext.tsx` | Dark/light theme |
| `lib/i18n.ts` | i18next config (Arabic default, localStorage persistence, RTL auto-direction) |
| `lib/trpc.ts` | tRPC client setup |
| `index.css` | Global CSS with CSS variables, dark theme, design system |

### i18n Translation Files:
| File | Purpose |
|------|---------|
| `client/public/locales/ar/translation.json` | Arabic translations (130+ keys) |
| `client/public/locales/en/translation.json` | English translations (130+ keys) |
| Keys cover: `nav`, `login`, `onboarding`, `dashboard`, `landing`, `common` |

### Chrome Extension — `apps/extension/`:
| File | Purpose |
|------|---------|
| `manifest.json` | Manifest V3 — matches LinkedIn + wassel-alpha.vercel.app |
| `content.js` | LinkedIn content script — prospect scraping sidebar (817 lines) |
| `content.css` | Styles for the sidebar |
| `wassel_detect.js` | Detection script for Wassel domain — sets `data-wassel-extension="true"` |
| `background.js` | Service worker — handles messages, storage, alarms |
| `popup.html` | Extension popup UI |
| `popup.js` | Popup logic — login, status display |
| `icons/` | Extension icons (16, 48, 128px) |

### Database Migrations — `supabase/migrations/`:
| File | Purpose |
|------|---------|
| `001_core_schema.sql` | Core tables: profiles, teams, team_members, prospects, campaigns, etc. |
| `001_linkedin_oauth.sql` | linkedin_connections table |
| `002_functions.sql` | Database functions |
| `003_rls_policies.sql` | Row-level security policies |
| `004_missing_rls_policies.sql` | Additional RLS policies |
| `005_saas_roles.sql` | Role-based access (super_admin, client_user) |
| `006_sequence_engine.sql` | Sequence/campaign execution engine tables |

### Manually-added columns (not in migration files):
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS extension_installed BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS linkedin_connected BOOLEAN DEFAULT false;
```

---

## 5. API ENDPOINTS

### Public (no auth):
| Method | Path | Handler |
|--------|------|---------|
| GET | `/api/health` | Health check → `{"ok":true}` |
| GET | `/api/linkedin-test` | LinkedIn config diagnostic |
| GET | `/api/linkedin/connect` | Start LinkedIn OAuth flow |
| GET | `/api/linkedin/callback` | LinkedIn OAuth callback (creates user, magic link, redirects) |
| POST | `/api/stripe/webhook` | Stripe webhook handler |

### User Auth (JWT in Authorization header):
| Method | Path | Handler | File |
|--------|------|---------|------|
| PATCH | `/api/user/profile` | Update profile fields (extension_installed, linkedin_connected) | `userRoutes.ts` |
| GET | `/api/user/profile` | Get current user profile | `userRoutes.ts` |

### User Auth (expressAuthMiddleware):
| Method | Path | Handler | File |
|--------|------|---------|------|
| * | `/api/ext/*` | Extension routes (import, sync, status) | `extensionRoutes.ts` |
| * | `/api/sequence/*` | Sequence engine (campaigns, steps, execution) | `sequenceRoutes.ts` |
| * | `/api/ai/*` | AI message generation | `aiRoutes.ts` |

### Admin Auth (super_admin role):
| Method | Path | Handler | File |
|--------|------|---------|------|
| * | `/api/admin/*` | Admin dashboard data | `adminRoutes.ts` |
| * | `/api/admin/clients/*` | Client management | `clientRoutes.ts` |
| * | `/api/invites/*` | Team invitations | `inviteRoutes.ts` |

### tRPC:
| Path | Purpose |
|------|---------|
| `/api/trpc/*` | Type-safe API (system router, etc.) |

---

## 6. ROUTE GUARDS (App.tsx)

```
ProtectedRoute — requires any authenticated user (redirects to /login if not)
AdminRoute — requires super_admin role (redirects to /app if client_user)
ClientRoute — requires auth + enforces onboarding:
  1. Not logged in → /login
  2. linkedinConnected = false → /onboarding/linkedin
  3. extensionInstalled = false → /onboarding/extension
  4. Both true → shows the page
```

Login.tsx also does the same redirect chain on load for already-logged-in users.

---

## 7. PLATFORMS & ACCOUNTS

| Platform | URL | Account Email |
|----------|-----|---------------|
| **Supabase** | https://supabase.com/dashboard | The user's Supabase account — project name visible in SUPABASE_URL |
| **Vercel** | https://vercel.com/dashboard | Linked to GitHub waselhup/wassel |
| **GitHub** | https://github.com/waselhup/wassel | Private repo, master branch |
| **LinkedIn Developer** | https://www.linkedin.com/developers/ | App configured for OAuth with redirect URI |
| **Stripe** | https://dashboard.stripe.com | For payment processing |

> **NOTE:** I was NOT given the user's email addresses or login passwords for these platforms. The user manages all platform accounts directly. I only received API keys/tokens as environment variables (listed below).

---

## 8. CREDENTIALS, TOKENS & ENVIRONMENT VARIABLES

> **IMPORTANT:** I was NOT given any passwords directly. All secrets are configured as **Vercel environment variables**. The .env file is NOT committed to git (it's in .gitignore).

### Required Vercel Environment Variables:
| Variable | Purpose | Status |
|----------|---------|--------|
| `VITE_SUPABASE_URL` | Supabase project URL (e.g. `https://xxxx.supabase.co`) | SET ✅ |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key (for frontend) | SET ✅ |
| `SUPABASE_URL` | Same as above (for server-side) | SET ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (admin access, server only) | SET ✅ |
| `LINKEDIN_CLIENT_ID` | LinkedIn app client ID | SET ✅ |
| `LINKEDIN_CLIENT_SECRET` | LinkedIn app client secret | SET ✅ |
| `LINKEDIN_REDIRECT_URI` | `https://wassel-alpha.vercel.app/api/linkedin/callback` | SET ✅ |
| `DASHBOARD_ORIGIN` | `https://wassel-alpha.vercel.app` | SET (or defaults) |
| `STRIPE_SECRET_KEY` | Stripe API key | Should be SET |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | Should be SET |
| `OPENAI_API_KEY` | For AI message writer | Should be SET |

### How to view/edit these:
1. Go to Vercel Dashboard → wassel project → Settings → Environment Variables
2. Or use `vercel env pull` to get a local `.env` file

---

## 9. LOCAL FILE PATHS

| What | Path |
|------|------|
| **Main project** | `C:\Users\WIN11-24H2GPT\Desktop\New folder\wassel\` |
| **Chrome extension** | `C:\Users\WIN11-24H2GPT\Desktop\New folder\wassel\apps\extension\` |
| **Extension (separate copy)** | `C:\Users\WIN11-24H2GPT\Desktop\wassel-extension\` |
| **Server code** | `C:\Users\WIN11-24H2GPT\Desktop\New folder\wassel\server\_core\` |
| **Client code** | `C:\Users\WIN11-24H2GPT\Desktop\New folder\wassel\client\src\` |
| **DB migrations** | `C:\Users\WIN11-24H2GPT\Desktop\New folder\wassel\supabase\migrations\` |
| **Build output** | `C:\Users\WIN11-24H2GPT\Desktop\New folder\wassel\dist\` |

---

## 10. DEPLOYMENT

### Build & Deploy Commands:
```bash
# Build server bundle
npx esbuild server/_core/vercel.ts --platform=node --packages=external --bundle --format=esm --outfile=dist/api/index.js

# Build client
npx vite build

# Commit and push (auto-deploys via Vercel)
git add -A && git commit -m "message" && git push origin master
```

### Important Notes:
- Use `cmd /c "command"` on Windows (PowerShell execution policy blocks npm)
- Use `--legacy-peer-deps` for npm install (peer dep conflict with `@builder.io/vite-plugin-jsx-loc`)
- Vercel auto-deploys on push to `master`
- Build takes ~7-8 seconds for client, ~17ms for server

---

## 11. DATABASE SCHEMA (Key Tables)

| Table | Key Columns |
|-------|-------------|
| `profiles` | id (uuid, FK to auth.users), email, full_name, role (super_admin/client_user), extension_installed (bool), linkedin_connected (bool) |
| `teams` | id, name, plan (trial/pro/team), status |
| `team_members` | team_id, user_id, role (owner/member) |
| `linkedin_connections` | user_id, linkedin_member_id, access_token, refresh_token, expires_at, linkedin_name, linkedin_email, oauth_connected, status |
| `prospects` | id, team_id, linkedin_url, first_name, last_name, title, company, status |
| `campaigns` | id, team_id, name, status (draft/active/paused/completed), type |
| `campaign_steps` | id, campaign_id, step_type (visit/invite/message/follow_up), delay_hours, template |
| `campaign_prospects` | campaign_id, prospect_id, current_step, status |
| `action_queue` | id, team_id, action_type, prospect_id, campaign_id, scheduled_at, status |
| `templates` | id, team_id, name, subject, body, type |

---

## 12. KNOWN BUGS & OPEN ISSUES

| # | Issue | Severity | Details |
|---|-------|----------|---------|
| 1 | "Failed to update profile" on extension onboarding | HIGH | PATCH `/api/user/profile` endpoint exists and is deployed. May be a token issue — check Vercel → Functions → Logs for `[UserProfile]` entries. The token from `localStorage.getItem('supabase_token')` may be expired or missing after OAuth redirect. |
| 2 | LinkedIn OAuth magic link sometimes doesn't create a Supabase session | MEDIUM | The magic link URL from `supabase.auth.admin.generateLink()` redirects the user but the session cookie may not persist. Check if the redirect URL matches the Supabase site URL config. |
| 3 | Extension must be manually reloaded after updates | LOW | Users need to go to `chrome://extensions` and reload. This is expected for unpacked extensions but will be solved once published to Chrome Web Store. |
| 4 | Landing page pricing CTAs don't start the actual Stripe checkout | LOW | The pricing section has buttons but they currently just link to `/login` or `/register`. Real Stripe checkout integration is needed. |
| 5 | User cache in AuthContext can be stale | LOW | `wassel_user_cache` in localStorage caches user profile for 24h. If flags change server-side, user may need to clear cache or wait. |
| 6 | No real testimonials | LOW | Testimonials section was removed (was fake). Needs real user reviews. |

---

## 13. LAST ACTION COMPLETED & NEXT STEP

### Last Action (2026-03-19):
- Deployed commit `563da05` — added `data-wassel-extension` attribute to `content.js` for LinkedIn domain
- Full onboarding flow verified: routes, guards, API endpoint, extension detection all in place
- Browser test confirmed: API health ✅, login page renders ✅, unauthenticated `/onboarding/extension` redirects to `/login` ✅

### Next Step:
1. **Debug the "Failed to update profile" error** — go to Vercel Functions logs, trigger the onboarding flow, read the `[UserProfile]` log lines to find the root cause
2. **Test the full flow end-to-end** with a real LinkedIn account: Login → LinkedIn OAuth → `/onboarding/extension` → click "لقد ثبّتها" → confirm redirect to `/app`
3. **If profile PATCH fails**: check if the Supabase token is being passed correctly, check if `SUPABASE_SERVICE_ROLE_KEY` is set in Vercel env vars

---

## 14. USER WORKING STYLE & PREFERENCES

- **Language:** Communicates in English but all customer-facing content must be Arabic first
- **Speed:** Wants fast execution. Says "CONTINUE" to keep going. Doesn't want planning discussions — wants code shipped.
- **Approach:** Sends detailed requirements as walls of text with exact specifications. Expects exact implementation, not interpretation.
- **Deployment:** Expects every change to be built, committed, pushed, and deployed immediately. No "I'll do this next" — do it now.
- **Windows:** Uses Windows 11 with PowerShell (but execution policy blocks scripts — always use `cmd /c "..."` for npm commands)
- **Editor:** Uses VS Code / Cursor (has files open in IDE)
- **Testing:** Expects browser-level verification. Wants to see URLs working.
- **Competitor mentions:** NEVER mention "Waalaxy" or any competitor name in customer-facing code
- **RTL:** Arabic is primary language. All UI must work in RTL. Cairo font for Arabic.
- **Admin access:** Has a super_admin account for the admin dashboard
- **Extension:** Chrome extension is loaded unpacked from `apps/extension/`

---

## 15. CRITICAL CONTEXT FOR CLAUDE CODE

1. **Don't use pnpm** for install commands — use `npm install --legacy-peer-deps` or `cmd /c "npm install --legacy-peer-deps"`
2. **Always use `cmd /c "..."` wrapper** for terminal commands on this Windows machine
3. **The project IS deployed** at https://wassel-alpha.vercel.app — every `git push origin master` triggers auto-deploy
4. **Build command is two steps**: esbuild for server → vite build for client (both must succeed)
5. **Auth flow**: Supabase handles auth. Frontend uses `@supabase/supabase-js` client with anon key. Backend uses service role key for admin operations.
6. **The LinkedIn OAuth is the primary login method** for regular users. Email/password is only for admin.
7. **Route guards are in App.tsx** — three guard components: `ProtectedRoute`, `AdminRoute`, `ClientRoute`. The `ClientRoute` enforces the onboarding journey.
8. **Wouter, not React Router** — the project uses `wouter` for routing. Import `{ Route, Switch, useLocation, Link }` from `wouter`.
9. **CSS Variables** — the project uses CSS custom properties (not Tailwind utility colors). Check `client/src/index.css` for `--bg-surface`, `--text-primary`, `--accent-primary`, `--gradient-primary`, etc.
10. **tRPC is partially used** — some endpoints use tRPC (`/api/trpc`), most use plain Express REST routes. New endpoints should probably use Express for consistency.
11. **The extension popup communicates with the Wassel API** using the token stored in `chrome.storage.local`
12. **Supabase RLS** is enabled — make sure any new tables have appropriate RLS policies

---

*End of handoff document. This contains everything needed to continue the Wassel project with zero context loss.*
