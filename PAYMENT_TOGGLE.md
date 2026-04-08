# Wassel v2 — Payment Integration Guide

## Current Status: DISABLED

Payments are disabled by default. The platform works with free tokens (100 on signup).

---

## How to Enable Payments

### Step 1: Set Environment Variable

In your `.env.local` (local dev) or Vercel Environment Variables (production):

```
VITE_ENABLE_PAYMENTS=true
```

### Step 2: Get Moyasar API Keys

1. Go to https://moyasar.com and create an account
2. Complete Saudi commercial registration verification
3. Get your API keys from Dashboard → Settings → API Keys:
   - `MOYASAR_PUBLISHABLE_KEY` (starts with `pk_`)
   - `MOYASAR_SECRET_KEY` (starts with `sk_`)

### Step 3: Add Keys to Environment

```env
MOYASAR_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxx
MOYASAR_SECRET_KEY=sk_live_xxxxxxxxxxxxx
```

### Step 4: Verify in Vercel

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add both keys
3. Redeploy

---

## Payment Methods

### Apple Pay
Moyasar supports Apple Pay natively.
1. In Moyasar Dashboard → Settings → Payment Methods → Enable Apple Pay
2. Verify your domain with Apple (Moyasar provides instructions)
3. Add to `.well-known/apple-developer-merchantid-domain-association` on your domain
4. Apple Pay button will appear automatically in checkout

### Visa / Mastercard
Enabled by default in Moyasar. No additional setup needed.

### Mada (Saudi Debit)
1. In Moyasar Dashboard → Settings → Payment Methods → Enable Mada
2. Requires Saudi commercial registration
3. Mada cards are auto-detected and routed correctly

### Tamara (Buy Now, Pay Later)
1. Create account at https://tamara.co/business
2. Get Tamara API keys
3. Add to environment:
   ```env
   TAMARA_API_KEY=xxxxxxxxxxxxx
   TAMARA_NOTIFICATION_TOKEN=xxxxxxxxxxxxx
   ```
4. Integrate via Tamara JS SDK in `client/src/pages/Payment.tsx`
5. Add webhook endpoint in `server/_core/routes/` for payment confirmation

### Tabby (Buy Now, Pay Later)
1. Create account at https://tabby.ai/business
2. Get Tabby API keys
3. Add to environment:
   ```env
   TABBY_PUBLIC_KEY=pk_xxxxxxxxxxxxx
   TABBY_SECRET_KEY=sk_xxxxxxxxxxxxx
   ```
4. Integrate via Tabby Checkout SDK
5. Add webhook endpoint for payment confirmation

---

## Code Locations

| File | Purpose |
|------|---------|
| `client/src/pages/Payment.tsx` | Payment UI (token packages + subscriptions) |
| `client/src/pages/Tokens.tsx` | Token balance + purchase CTA |
| `server/_core/routes/tokens.ts` | Token purchase API |
| `.env.local` | API keys (local) |
| `vercel.json` | Vercel config |

### Key Code Block in Payment.tsx

The payment enablement check:
```typescript
const paymentsEnabled = import.meta.env.VITE_ENABLE_PAYMENTS === 'true';
```

When `paymentsEnabled` is false, the page shows a "Coming Soon" card.
When true, it shows the full checkout flow.

---

## Moyasar Integration Code

When ready to integrate, add to `Payment.tsx`:

```typescript
// Install: npm install @moyasar/moyasar-js
import Moyasar from '@moyasar/moyasar-js';

const moyasar = new Moyasar(import.meta.env.VITE_MOYASAR_PUBLISHABLE_KEY);

// Create payment
const payment = await moyasar.createPayment({
  amount: amount * 100, // In halalas (1 SAR = 100 halalas)
  currency: 'SAR',
  description: `Wassel - ${packageName}`,
  callback_url: `${window.location.origin}/app/tokens?payment=success`,
  source: {
    type: 'creditcard', // or 'applepay', 'mada'
    // ... card details from Moyasar form
  },
  metadata: {
    user_id: user.id,
    package: packageName,
    tokens: tokenAmount,
  },
});
```

### Webhook for Payment Confirmation

Add to `server/_core/routes/tokens.ts`:

```typescript
// POST /api/webhooks/moyasar
app.post('/api/webhooks/moyasar', async (req, res) => {
  const { id, status, metadata } = req.body;
  if (status === 'paid') {
    // Add tokens to user
    await supabase.from('profiles')
      .update({ token_balance: supabase.raw(`token_balance + ${metadata.tokens}`) })
      .eq('id', metadata.user_id);
    // Log transaction
    await supabase.from('token_transactions').insert({
      user_id: metadata.user_id,
      amount: metadata.tokens,
      type: 'purchase',
      description: `Purchased ${metadata.tokens} tokens via Moyasar`,
    });
  }
  res.json({ received: true });
});
```

---

## Pricing Configuration

Prices are stored in `system_settings` table:

| Key | Value |
|-----|-------|
| `v2_plans` | `{"free": 0, "starter": 99, "pro": 199, "elite": 299}` |
| `token_prices` | `{"100": 50, "500": 200, "1000": 350}` |

To update prices:
1. Admin Dashboard → Settings → Edit prices
2. Or directly in Supabase: `UPDATE system_settings SET value = '...' WHERE key = 'v2_plans'`

---

## Testing Payments

1. Use Moyasar test keys (`pk_test_` / `sk_test_`)
2. Test card: `4111 1111 1111 1111`, any future expiry, any CVV
3. Verify tokens are added after successful payment
4. Switch to live keys for production