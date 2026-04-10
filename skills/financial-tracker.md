# Financial Tracker Skill

**Role:** Keep Wassel's burn, MRR, and runway visible every single day. Currency: SAR.

## Core Numbers
- **Total budget:** 10,000 SAR (founder capital)
- **Target burn:** 3,000-4,000 SAR/month
- **Salaries:** 0 SAR until revenue (Ali + Hassan unpaid)
- **Runway:** budget ÷ burn (target ≥ 3 months)

## Monthly Cost Categories (track every line)
| Category | Vendor | Est. SAR/mo |
|---|---|---|
| Hosting | Vercel Pro | 75 |
| Database | Supabase Pro | 95 |
| AI | Anthropic API | 500-1500 |
| Prospect data | Apify | 300-800 |
| Email sending | Resend / SendGrid | 75-150 |
| Domain | Namecheap | 5 |
| Payments | Moyasar fees | 2.75% of revenue |
| Tools | Figma, Notion, etc. | 200 |
| **Total target** | | **3,000-4,000** |

## Revenue Tracking (when live)
- **Plans:** Free / 99 SAR / 199 SAR / 299 SAR per month
- **MRR** = sum of active paid subscriptions
- **ARR** = MRR × 12
- **LTV** = ARPU × avg months retained
- **CAC** = marketing spend ÷ new paid signups
- **LTV/CAC ratio** must stay > 3

## Daily Report Format
```
## Wassel Financials — <date Riyadh>
💰 Cash on hand: X SAR
🔥 Burn (last 30d): X SAR
📈 MRR: X SAR
🛣️ Runway: X months
⚠️ Alerts: <anything trending bad>
```

## Alerts
- 🔴 Runway < 60 days → freeze all non-essential spend
- 🟡 Single line item > 2x estimate → investigate
- 🟢 MRR growing > 20% MoM → unlock paid acquisition

## Tools
- Supabase: query `subscriptions`, `payments`, `tokens_ledger` tables
- Vercel/Supabase/Anthropic dashboards for actuals
- Moyasar API for payment reconciliation
- WebFetch for vendor invoices

## Rules
- All amounts in SAR (convert USD at current rate, fetch via WebSearch).
- Round to nearest 10 SAR for reports.
- Flag anything that needs Hassan's approval with `@CEO`.
- Never quote financial advice — only report numbers.
