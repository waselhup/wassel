#!/usr/bin/env tsx
/**
 * One-shot backfill: generate Next Task suggestions + Career Pulse snapshots
 * for every active user, so users see a populated dashboard immediately after
 * deploy without waiting for the first nightly cron run.
 *
 * Run with:  npx tsx scripts/backfill-suggestions.ts
 *
 * Requires env vars in .env at project root:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY
 *
 * Idempotent — running twice on the same day just upserts the same snapshot
 * and inserts another suggestion row for each user (which is fine; the most
 * recent active row with the highest priority_score wins).
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { generateSuggestions, snapshotPulse } from '../server/_core/lib/dashboard-engine';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.warn('[warn] ANTHROPIC_API_KEY missing — Claude calls will fail.');
}

async function main() {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: recent } = await supabase
    .from('activity_log')
    .select('user_id')
    .gte('created_at', thirtyDaysAgo)
    .limit(5000);

  const { data: profiles } = await supabase
    .from('career_profile')
    .select('user_id, primary_language');

  const activeIds = Array.from(
    new Set(
      [
        ...(recent ?? []).map((r) => (r as { user_id: string }).user_id),
        ...(profiles ?? []).map((p) => (p as { user_id: string }).user_id),
      ].filter(Boolean),
    ),
  );

  const langByUser = new Map<string, 'ar' | 'en'>();
  for (const p of (profiles ?? []) as Array<{ user_id: string; primary_language: 'ar' | 'en' }>) {
    langByUser.set(p.user_id, (p.primary_language as 'ar' | 'en') || 'ar');
  }

  console.log(`Backfilling ${activeIds.length} users…`);

  let generated = 0;
  let snapshotted = 0;
  const errors: Array<{ userId: string; error: string }> = [];

  for (const userId of activeIds) {
    try {
      const lang = langByUser.get(userId) ?? 'ar';
      const r = await generateSuggestions(supabase as never, userId, lang);
      generated += r.generated;
      await snapshotPulse(supabase as never, userId);
      snapshotted++;
      console.log(`  ✓ ${userId.slice(0, 8)} → generated=${r.generated}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push({ userId, error: msg });
      console.warn(`  ✗ ${userId.slice(0, 8)} → ${msg}`);
    }
  }

  console.log(
    `\nDone. active=${activeIds.length} generated=${generated} snapshotted=${snapshotted} errors=${errors.length}`,
  );
  if (errors.length) {
    console.log('First 5 errors:', errors.slice(0, 5));
  }
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
