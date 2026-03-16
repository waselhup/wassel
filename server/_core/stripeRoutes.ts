import { Router, Request, Response } from 'express';
import Stripe from 'stripe';

const router = Router();

// Initialize Stripe (will fail gracefully if key not set)
const stripeKey = process.env.STRIPE_SECRET_KEY || '';
const stripe = stripeKey ? new Stripe(stripeKey) : null;

const PRICE_IDS: Record<string, string> = {
  starter: process.env.STRIPE_STARTER_PRICE_ID || '',
  growth: process.env.STRIPE_GROWTH_PRICE_ID || '',
  agency: process.env.STRIPE_AGENCY_PRICE_ID || '',
};

/**
 * POST /api/stripe/create-checkout
 * Creates a Stripe checkout session for plan upgrade.
 */
router.post('/create-checkout', async (req: Request, res: Response) => {
  try {
    if (!stripe) return res.status(500).json({ error: 'Stripe not configured' });

    const { plan } = req.body;
    const priceId = PRICE_IDS[plan];
    if (!priceId) return res.status(400).json({ error: 'Invalid plan' });

    const teamId = (req as any).teamId || (req as any).user?.team_id || '';

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_URL || 'https://wassel-alpha.vercel.app'}/app?upgraded=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_URL || 'https://wassel-alpha.vercel.app'}/pricing`,
      metadata: { teamId, plan },
    });

    res.json({ checkoutUrl: session.url });
  } catch (e: any) {
    console.error('[Stripe] Checkout error:', e);
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /api/stripe/webhook
 * Stripe webhook handler — updates team plan after payment.
 * NOTE: This route should NOT have auth middleware applied.
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    if (!stripe) return res.status(500).json({ error: 'Stripe not configured' });

    const sig = req.headers['stripe-signature'] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err: any) {
      console.error('[Stripe] Webhook signature verification failed:', err.message);
      return res.status(400).json({ error: 'Webhook signature verification failed' });
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as any;
      const { teamId, plan } = session.metadata || {};

      if (teamId && plan) {
        // Import supabase here to avoid circular deps
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          process.env.SUPABASE_URL || '',
          process.env.SUPABASE_SERVICE_KEY || ''
        );

        await supabase
          .from('teams')
          .update({
            plan,
            stripe_customer_id: session.customer,
            stripe_subscription_id: session.subscription,
          })
          .eq('id', teamId);

        console.log(`[Stripe] ✓ Team ${teamId} upgraded to ${plan}`);
      }
    }

    res.json({ received: true });
  } catch (e: any) {
    console.error('[Stripe] Webhook error:', e);
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /api/stripe/portal
 * Creates a Stripe customer portal session for subscription management.
 */
router.get('/portal', async (req: Request, res: Response) => {
  try {
    if (!stripe) return res.status(500).json({ error: 'Stripe not configured' });

    const customerId = (req as any).stripeCustomerId;
    if (!customerId) return res.status(400).json({ error: 'No Stripe customer found' });

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.NEXT_PUBLIC_URL || 'https://wassel-alpha.vercel.app'}/app`,
    });

    res.json({ portalUrl: session.url });
  } catch (e: any) {
    console.error('[Stripe] Portal error:', e);
    res.status(500).json({ error: e.message });
  }
});

export default router;
