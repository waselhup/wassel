// Server-side Sentry wrapper. Env-gated on SENTRY_DSN.
// All calls are no-ops if DSN is missing so dev/prod-without-Sentry never crashes.

import * as Sentry from '@sentry/node';

let initialized = false;

export function initSentryServer(): void {
  if (initialized) return;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    console.log('[sentry-server] SENTRY_DSN not set — skipping init');
    initialized = true;
    return;
  }
  try {
    Sentry.init({
      dsn,
      environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
      tracesSampleRate: 0.1,
      beforeSend(event) {
        if (!process.env.SENTRY_DSN) return null;
        return event;
      },
    });
    initialized = true;
    console.log('[sentry-server] initialized');
  } catch (e: any) {
    console.warn('[sentry-server] init failed:', e?.message || e);
    initialized = true; // don't retry forever
  }
}

export function captureException(err: any, ctx?: Record<string, any>): void {
  if (!process.env.SENTRY_DSN) return;
  try {
    Sentry.captureException(err, ctx ? { extra: ctx } : undefined);
  } catch {}
}

export function captureMessage(msg: string, ctx?: Record<string, any>): void {
  if (!process.env.SENTRY_DSN) return;
  try {
    Sentry.captureMessage(msg, ctx ? { extra: ctx } as any : undefined);
  } catch {}
}

export function isSentryConfigured(): boolean {
  return !!process.env.SENTRY_DSN;
}
