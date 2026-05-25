# Follow-up Sweep — Batch 2+3 polish

Items intentionally deferred from the main Batch 2+3 push so the bulk of the work could land. None of these are blockers — the agents/portals/integrations function without them, but these will tighten the loop.

Order them in roughly the recommended sequence. Budget ~2-3 hours total.

---

## 1. Sentry client init
**File:** `client/src/main.tsx` (or wherever the React root mounts)
**Effort:** ~15 min
**Why:** Server is already initialized (`server/_core/vercel.ts` line 1-2 via `initSentryServer()`). Mirror it client-side so React errors flow to the same Sentry project.

**Acceptance:**
- Add `import * as Sentry from '@sentry/react';` at the top of `main.tsx`
- Initialize before `createRoot()`:
  ```ts
  if (import.meta.env.VITE_SENTRY_DSN) {
    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      environment: import.meta.env.MODE,
      tracesSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
    });
  }
  ```
- Add `VITE_SENTRY_DSN` to Vercel env (production + preview)
- Test by throwing in a component → check Sentry dashboard

---

## 2. PostHog client init + identify-on-login
**Files:**
- `client/src/main.tsx` — `posthog.init(...)`
- `client/src/contexts/AuthContext.tsx` — call `posthog.identify(user.id, { email, plan })` after login
- (optional) `client/src/lib/posthog-client.ts` — thin wrapper

**Effort:** ~30 min
**Why:** `posthog-js` is installed but unused. Server-side capture works via `trpc.fatima.captureEvent()` but client-side autocapture (pageviews, clicks) is not active.

**Acceptance:**
- Add init guarded on `import.meta.env.VITE_POSTHOG_KEY`
- Mirror `posthog.capture` calls to `trpc.fatima.captureEvent()` so events land in both PostHog AND `analytics_events` table (which Fatima reads)
- Add `VITE_POSTHOG_KEY` + `VITE_POSTHOG_HOST` to Vercel env

---

## 3. Hussein's "Auto-Resolutions" section on /v2/ops dashboard
**File:** `client/src/pages/ops/OpsDashboard.tsx` (likely path — check actual)
**Effort:** ~30 min
**Why:** Hussein's agent + tRPC router are live (`server/_core/agents/hussein.ts`, `server/_core/routes/hussein.ts`) but no UI surface exposes them. Ops portal is the natural home.

**Acceptance:**
- Add a card section "Hussein's Auto-Resolutions" (or AR: "حسين — الإصلاحات الذاتية")
- Two sub-cards:
  - Known patterns list (call `trpc.hussein.listKnownPatterns()`) — shows occurrences_count + last_seen
  - Recent auto-resolutions feed (call `trpc.hussein.recentResolutions({ limit: 20 })`)
- Action buttons: "Seed default patterns" (`trpc.hussein.seedDefaultPatterns()`), "Run auto-resolve now" (`trpc.hussein.autoResolveErrors()`), "Services health check" (`trpc.hussein.servicesHealthCheck()`)
- Use the same `CARD` / `SECTION_TITLE` style as other Ops sections

---

## 4. Mohammed's sections on /v2/finance dashboard
**File:** `client/src/pages/finance/FinanceDashboard.tsx` (likely path — check actual)
**Effort:** ~45 min
**Why:** Mohammed's tRPC router exposes daily snapshots, runway prediction, ZATCA invoices — none are surfaced yet.

**Acceptance:**
- Section A "Mohammed's Daily Snapshot" — current row from `trpc.mohammed.financeKpis({ days: 1 })` displaying MRR, ARR, runway days, daily burn, margin %
- Section B "Runway Forecast" — `trpc.mohammed.predictRunway()` action + chart of last 30 days from `financeKpis({ days: 30 })`
- Section C "ZATCA Invoices" — `trpc.mohammed.listInvoices({ limit: 50 })` table with invoice_number, total_sar, vat_amount_sar, status, issue_date
- Action button "Generate invoice for transaction" + "Run daily snapshot now"

---

## 5. Faris cockpit 7-agent filter chips + Fatima "Suggestions" lane
**File:** `client/src/pages/workforce/WorkforceDashboard.tsx`
**Effort:** ~45 min
**Why:** Today Faris's Approval Queue filters by Sayed only. With 7 agents queuing tasks, the queue is unfilterable.

**Acceptance:**
- Replace the 2-agent (Sayed-only) chip strip with 7 chips: `سيد · المخضرم · حسن · فاطمة · ضي · حسين · محمد` (use exact Arabic names from `agents.{id}.ar` translation keys)
- Filter chip toggles `agentId` parameter passed to the Approval Queue list query
- Add a visually distinct "Suggestions" lane below the main queue — pulls tasks where `agent_id = 'fatima'` since Fatima is `suggest_only` and shouldn't share screen real estate with approval-required tasks. Color it pink (`#EC4899`) per Fatima's brand
- Agent Roster card: confirm all 8 agents render with correct status/approval_mode badges

---

## 6. Dhai fraud-scan trigger on new signup
**Files:**
- `server/_core/lib/email.ts` (where `sendWelcomeEmail` is called) OR
- Supabase auth trigger on `auth.users` INSERT OR
- `server/_core/routes/auth.ts` if there's a signup endpoint

**Effort:** ~20 min
**Why:** `dhai.scanNewSignup({ userId })` exists and works (writes to `fraud_signals` table) but nothing calls it. Without this, the throwaway-email / duplicate-LinkedIn / same-IP-burst rules never fire.

**Acceptance:**
- Find the existing signup completion path (the place that already calls `sendWelcomeEmail` or fires the `signup_events` row)
- Add a fire-and-forget call:
  ```ts
  import { dhai } from '../agents/dhai';
  dhai.scanNewSignup({ userId: newUser.id }).catch(e =>
    console.warn('[dhai] signup scan failed:', e?.message)
  );
  ```
- Verify by signing up with a mailinator address → check `fraud_signals` for a `test_email_pattern` row

---

## 7. Sayed pre-publish moderation hook
**File:** `server/_core/agents/sayed.ts` — likely a `publishApprovedContent` method, OR `server/_core/routes/sayed.ts` `publishApprovedContent` mutation
**Effort:** ~20 min
**Why:** Sayed currently can publish anything approved by Ali. Dhai's `moderateContent` is a guardrail that should block content containing LinkedIn-ToS-forbidden terms ("scraping", "automate connection", etc.) or forbidden brand mentions (Apify/Waalaxy) before it leaves the building.

**Acceptance:**
- Locate the publish handler in `sayed.ts` / `routes/sayed.ts`
- Before the actual social-platform send:
  ```ts
  import { dhai } from './dhai';
  const mod = await dhai.moderateContent({
    contentId: post.id,
    contentType: 'social_post',
    scannedText: post.caption + ' ' + (post.hashtags || []).join(' '),
    language: post.language,
    sourceAgent: 'sayed',
  });
  if (mod.decision === 'blocked') {
    throw new Error(`Blocked by Dhai: ${mod.violations.join(', ')}`);
  }
  if (mod.decision === 'flagged') {
    // queue an admin alert task but allow publish
  }
  ```
- Verify by drafting a post containing the word "scrape" → confirm `dhai.moderateContent` returns `blocked` and publishing is refused

---

## Notes
- All env vars referenced (WHATSAPP_*, SNAP_*, LINKEDIN_*, SENTRY_DSN, POSTHOG_API_KEY, VITE_*) are already supported by the libs — they fail gracefully when missing. Configure them in Vercel project env when ready.
- The `farisRouter` agent registry has not been updated to surface the 6 new agents to Ali's approval queue (subtask #27 from Batch 1's TaskCreate). This is implicit because all agents queue to the same `agent_tasks` table — the queue already shows everything. But if Faris filters by `agent_id`, the chips need to know the 7 names. Item #5 above covers that.
- Pre-existing TypeScript `TS6133` (unused declaration) warnings in unrelated files should be cleaned up in a separate sweep — not blocking.

— Generated 2026-05-25 at the close of the Batch 2+3 main push.
