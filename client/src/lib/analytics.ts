import posthog from 'posthog-js';
import * as Sentry from '@sentry/react';

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY || '';
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN || '';

let initialized = false;

export function initAnalytics() {
  if (initialized) return;
  initialized = true;

  // PostHog
  if (POSTHOG_KEY) {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      autocapture: false,
      capture_pageview: true,
      capture_pageleave: true,
      persistence: 'memory',
    });
    console.log('[Analytics] PostHog initialized');
  }

  // Sentry
  if (SENTRY_DSN) {
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: import.meta.env.MODE,
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0.5,
    });
    console.log('[Analytics] Sentry initialized');
  }
}
// Identify user (call after login)
export function identifyUser(userId: string, traits?: Record<string, any>) {
  if (POSTHOG_KEY) {
    posthog.identify(userId, traits);
  }
  if (SENTRY_DSN) {
    Sentry.setUser({ id: userId, ...traits });
  }
}

// Track key events only
export function track(event: string, properties?: Record<string, any>) {
  if (POSTHOG_KEY) {
    posthog.capture(event, properties);
  }
}

// Key events to track
export const Events = {
  SIGNUP: 'user_signup',
  LOGIN: 'user_login',
  LINKEDIN_ANALYZE: 'linkedin_analyze',
  LINKEDIN_CACHE_HIT: 'linkedin_cache_hit',
  CV_GENERATE: 'cv_generate',
  CAMPAIGN_CREATE: 'campaign_create',
  CAMPAIGN_LAUNCH: 'campaign_launch',
  TOKEN_PURCHASE: 'token_purchase',
  PAGE_VIEW: '$pageview',
} as const;

// Reset on logout
export function resetAnalytics() {
  if (POSTHOG_KEY) posthog.reset();
  if (SENTRY_DSN) Sentry.setUser(null);
}