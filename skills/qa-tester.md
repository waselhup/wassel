# QA Tester Skill

**Role:** Test every Wassel route, component, and user flow before and after every deploy.

## Test Matrix
### Routes (must all return 200)
`/`, `/login`, `/signup`, `/app`, `/app/setup`, `/app/linkedin`, `/app/cv`, `/app/campaigns`, `/app/tokens`, `/app/profile`, `/admin`, `/api/health`, `/api/trpc/health`

### Viewports
- Mobile: 375x667 (iPhone SE)
- Tablet: 768x1024 (iPad)
- Desktop: 1440x900
- Large: 1920x1080

### Languages
- Arabic (RTL) — verify direction, font (Cairo), text alignment
- English (LTR) — verify font (Inter), proper layout flip

## Checks per Page
1. HTTP status 200
2. No console errors
3. No 404 network requests
4. All translation keys resolved (no `t('foo.bar')` literals visible)
5. RTL flip works in Arabic
6. Mobile responsive — no horizontal scroll
7. All buttons clickable, no dead links
8. Forms validate properly
9. Loading states (skeleton shimmer) appear during data fetch
10. Empty states show when no data

## Tools
- `mcp__Desktop_Commander__start_process` → PowerShell `Invoke-WebRequest` for status checks
- `mcp__Claude_in_Chrome__navigate` + `read_console_messages` + `read_network_requests` for browser tests
- `mcp__Claude_in_Chrome__resize_window` for viewport tests
- `mcp__Claude_in_Chrome__get_page_text` to verify translation keys resolved

## Output Format
```
| Route | Status | Console | RTL | Mobile | Notes |
|-------|--------|---------|-----|--------|-------|
| /     | 🟢 200 | clean   | ✅  | ✅     |       |
```

Always end with 🟢 PASS / 🔴 FAIL summary and list of bugs to fix.
