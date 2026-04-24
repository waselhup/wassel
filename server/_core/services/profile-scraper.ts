// Hybrid LinkedIn profile scraper — LinkdAPI primary, Bright Data fallback.
//
// Strategy (decided 2026-04-24):
//   1. Try LinkdAPI /profile/full first.
//   2. If LinkdAPI returns success:false (profile doesn't exist / private),
//      throw NOT_FOUND immediately. Do NOT try Bright Data — BD would return
//      the same "dead_page" result for the same reason, just slower.
//   3. If LinkdAPI throws URL_MISMATCH (returned username !== requested slug),
//      throw immediately. This is a data-integrity issue, not a transport one.
//   4. If LinkdAPI throws a transport/HTTP error (5xx, network, timeout) after
//      its own 3 retries, fall back to Bright Data. Mark source as
//      'bright-data-fallback' so we can see in DB which profiles ran on BD.
//   5. If Bright Data also fails, surface whichever error is most actionable.
//
// Why this is NOT merge-with-BD: Bright Data's data is a strict subset of
// LinkdAPI's (fewer fields, less reliable skills/certs). Merging would double
// cost per analysis ($0.008 + BD credits) for no meaningful data gain.
// Fallback-only keeps us cheap AND preserves resilience if LinkdAPI ever
// has a bad day.
//
// Token-charge invariant: this file runs BEFORE token deduction in the
// linkedin.ts route. Any error thrown here → no tokens charged. Any
// success → route then deducts 25 tokens. Do not move deduction logic here.

import { scrapeLinkedInProfileLinkdAPI, LinkdApiProfileNotFoundError } from './linkdapi';
import { scrapeLinkedInProfileBrightData, BrightDataProfileNotFoundError } from './bright-data';
import type { ScrapeOutcome } from '../lib/linkedin-scraper';

export class ProfileNotFoundError extends Error {
  code: string;
  requestedSlug: string;
  source: 'linkdapi' | 'bright-data' | 'both';
  constructor(message: string, requestedSlug: string, source: 'linkdapi' | 'bright-data' | 'both') {
    super(message);
    this.name = 'ProfileNotFoundError';
    this.code = 'NOT_FOUND';
    this.requestedSlug = requestedSlug;
    this.source = source;
  }
}

export async function scrapeLinkedInProfileHybrid(url: string): Promise<ScrapeOutcome> {
  const t0 = Date.now();
  console.log('[PROFILE_SCRAPER] start', { url });

  // ─── Attempt 1: LinkdAPI ─────────────────────────────────────────
  try {
    const outcome = await scrapeLinkedInProfileLinkdAPI(url);
    console.log('[PROFILE_SCRAPER] linkdapi-primary ok', {
      slug: outcome.returnedSlug,
      completeness: outcome.completeness,
      durationMs: Date.now() - t0,
    });
    return outcome;
  } catch (err: any) {
    const kind = err?.kind;
    const isNotFound = err instanceof LinkdApiProfileNotFoundError;
    const isMismatch = kind === 'URL_MISMATCH';

    // Definitive negative answers → don't try BD, they'd return the same.
    if (isNotFound) {
      console.warn('[PROFILE_SCRAPER] linkdapi NOT_FOUND — skipping BD (same answer expected)', {
        requestedSlug: err.requestedSlug,
        apiMessage: err.apiMessage,
      });
      throw err;
    }
    if (isMismatch) {
      console.error('[PROFILE_SCRAPER] linkdapi URL_MISMATCH — rejecting', {
        requested: err.requestedSlug,
        returned: err.returnedSlug,
      });
      throw err;
    }

    // Transport / network / HTTP 5xx / timeout → try Bright Data as fallback.
    console.warn('[PROFILE_SCRAPER] linkdapi transport error — falling back to bright-data', {
      message: err?.message,
      name: err?.name,
    });
  }

  // ─── Attempt 2: Bright Data fallback ─────────────────────────────
  try {
    const outcome = await scrapeLinkedInProfileBrightData(url);
    console.log('[PROFILE_SCRAPER] bright-data fallback ok', {
      slug: outcome.returnedSlug,
      completeness: outcome.completeness,
      durationMs: Date.now() - t0,
    });
    // Mark so downstream persistence can see this ran on BD fallback.
    return { ...outcome, source: 'bright-data-fallback' as any };
  } catch (err: any) {
    const kind = err?.kind;
    const isNotFound = err instanceof BrightDataProfileNotFoundError;
    const isMismatch = kind === 'URL_MISMATCH';

    // Both failed. Prefer the more specific error type for the route to map.
    if (isNotFound) {
      console.error('[PROFILE_SCRAPER] both-failed NOT_FOUND', {
        durationMs: Date.now() - t0,
      });
      throw err;
    }
    if (isMismatch) {
      console.error('[PROFILE_SCRAPER] bright-data URL_MISMATCH after linkdapi fallback', {
        durationMs: Date.now() - t0,
      });
      throw err;
    }
    // Both transports failed — bubble the BD error, that's the last one tried.
    console.error('[PROFILE_SCRAPER] both-failed transport', {
      message: err?.message,
      durationMs: Date.now() - t0,
    });
    throw err;
  }
}

// Re-export NOT_FOUND error classes for the route to type-check against.
export { LinkdApiProfileNotFoundError, BrightDataProfileNotFoundError };
