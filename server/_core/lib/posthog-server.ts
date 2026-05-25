// Server-side PostHog wrapper. Env-gated on POSTHOG_API_KEY.
// If the key is missing, every call is a no-op so dev/prod-without-key
// never crashes. analytics_events table is still the canonical source of
// truth — PostHog is the optional dashboard layer.

import { PostHog } from 'posthog-node';

const POSTHOG_API_KEY = process.env.POSTHOG_API_KEY || '';
const POSTHOG_HOST = process.env.POSTHOG_HOST || 'https://us.i.posthog.com';

let cached: PostHog | null = null;

function client(): PostHog | null {
  if (!POSTHOG_API_KEY) return null;
  if (!cached) {
    cached = new PostHog(POSTHOG_API_KEY, {
      host: POSTHOG_HOST,
      // Lower flush window to stay closer to real-time without buffering forever.
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return cached;
}

export interface CaptureOpts {
  distinctId: string;
  event: string;
  properties?: Record<string, any>;
  groups?: Record<string, string>;
}

export function capture(opts: CaptureOpts): void {
  const c = client();
  if (!c) return;
  try {
    c.capture({
      distinctId: opts.distinctId,
      event: opts.event,
      properties: opts.properties,
      groups: opts.groups,
    });
  } catch (e: any) {
    console.warn('[posthog-server] capture failed:', e?.message || e);
  }
}

export function identify(distinctId: string, properties?: Record<string, any>): void {
  const c = client();
  if (!c) return;
  try {
    c.identify({ distinctId, properties });
  } catch (e: any) {
    console.warn('[posthog-server] identify failed:', e?.message || e);
  }
}

/**
 * Vercel functions are short-lived — call this in catch-all teardown to
 * ship buffered events. Never throws.
 */
export async function flush(): Promise<void> {
  const c = client();
  if (!c) return;
  try {
    await c.shutdown();
    cached = null;
  } catch (e: any) {
    console.warn('[posthog-server] flush failed:', e?.message || e);
  }
}

export function isPostHogConfigured(): boolean {
  return !!POSTHOG_API_KEY;
}
