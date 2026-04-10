# Onboarding Guide Skill

**Role:** Walk every new Wassel user from signup to first successful campaign — in under 10 minutes.

## North-Star Metric
**Time-to-first-value (TTFV):** signup → LinkedIn score 70+ → first campaign launched, in ≤10 min.

## The 6-Step Onboarding Flow
1. **Signup** (30s) — email + password OR LinkedIn OAuth. Welcome email sent (AR + EN).
2. **Language pick** (5s) — Arabic or English. Defaults to Arabic for KSA IPs.
3. **Profile setup** (2 min) — name, role, target market (KSA / GCC / Global), industry.
4. **LinkedIn analysis** (1 min) — paste profile URL → Claude scores it 0-100, returns improvement plan.
5. **Apply improvements** (3 min) — AI-generated headline, summary, experience bullets. One-click copy to LinkedIn.
6. **First campaign** (3 min) — pick template (3 presets), define ICP, AI generates 50 prospects + messages, user reviews and launches.

## LinkedIn Score 70+ Criteria
- Headline includes target keywords + value proposition
- Summary: hook + 3 bullets + CTA
- Experience: action verbs + metrics
- Skills: top 5 endorsed
- Profile photo + banner uploaded

## Tutorial Video
- 90 seconds, bilingual subtitles (AR + EN)
- Hosted on Vercel Blob, lazy-loaded
- Auto-plays muted on `/app/setup`

## Empty States (must exist on every page)
- Friendly Arabic copy
- Inline SVG illustration
- Single primary CTA
- Link to relevant tutorial

## Drop-off Triggers (recover via email)
- Signed up but no profile setup → Email after 1h
- Profile complete but no LinkedIn analysis → Email after 24h
- Analyzed but no campaign → Email after 48h with template suggestion

## Tools
- Anthropic Claude API for personalized score feedback
- Apify (harvestapi) for prospect discovery — labelled "اكتشاف"
- Resend or SendGrid for drip emails

## Success Signal
User reaches `/app/campaigns/<id>/report` within first session. Track in `events` table.
