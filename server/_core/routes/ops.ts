import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc-init';

const ADMIN_EMAILS = ['waselhup@gmail.com', 'almodhih.1995@gmail.com', 'alhashimali649@gmail.com'];

export const opsRouter = router({
  /**
   * Admin-only: probe Anthropic with a tiny ping to check key health + billing.
   * Returns enough info for an admin dashboard widget to show green/amber/red.
   */
  anthropicHealth: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user?.email || !ADMIN_EMAILS.includes(ctx.user.email)) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin only' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return {
        status: 'unreachable' as const,
        httpCode: 0,
        message: 'ANTHROPIC_API_KEY not configured',
        creditExhausted: false,
        latencyMs: 0,
        timestamp: new Date().toISOString(),
      };
    }

    const t0 = Date.now();
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 5,
          messages: [{ role: 'user', content: 'ping' }],
        }),
      });
      const latencyMs = Date.now() - t0;
      const bodyText = await res.text();
      let parsed: any = null;
      try {
        parsed = JSON.parse(bodyText);
      } catch {
        /* non-JSON response — keep bodyText */
      }

      const creditExhausted = /credit balance is too low|insufficient credit/i.test(bodyText);
      const errMsg = parsed?.error?.message || bodyText.slice(0, 300);

      return {
        status: res.ok ? ('healthy' as const) : ('error' as const),
        httpCode: res.status,
        message: res.ok ? 'Claude API reachable' : errMsg,
        creditExhausted,
        latencyMs,
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      return {
        status: 'unreachable' as const,
        httpCode: 0,
        message: err?.message || 'Network error',
        creditExhausted: false,
        latencyMs: Date.now() - t0,
        timestamp: new Date().toISOString(),
      };
    }
  }),
});
