import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Fetch the canonical token_cost for a product from the products table.
 *
 * Process-level cache with 5-minute TTL — products rarely change and we
 * want this to be cheap on the hot path (every Radar/CV/post call). On
 * first miss or stale cache we hit the DB; on every cache hit we serve
 * from memory.
 *
 * If the lookup fails for any reason (DB hiccup, missing row), we fall
 * back to the supplied default so the feature continues to work. Better
 * a stale price than a broken feature.
 */

interface CacheEntry {
  cost: number;
  fetchedAt: number;
}

const CACHE = new Map<string, CacheEntry>();
const TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function getProductTokenCost(
  supabase: SupabaseClient,
  productId: string,
  fallback: number
): Promise<number> {
  const now = Date.now();
  const cached = CACHE.get(productId);
  if (cached && now - cached.fetchedAt < TTL_MS) {
    return cached.cost;
  }

  try {
    const { data, error } = await supabase
      .from('products')
      .select('token_cost, is_active')
      .eq('id', productId)
      .maybeSingle();

    if (error || !data || !data.is_active || typeof data.token_cost !== 'number' || data.token_cost <= 0) {
      console.warn(`[product-costs] using fallback for ${productId}: ${fallback}`);
      // Cache the fallback briefly so we don't hammer the DB on every call
      CACHE.set(productId, { cost: fallback, fetchedAt: now });
      return fallback;
    }

    CACHE.set(productId, { cost: data.token_cost, fetchedAt: now });
    return data.token_cost;
  } catch (e: any) {
    console.error(`[product-costs] lookup failed for ${productId}:`, e?.message);
    return fallback;
  }
}

/**
 * Test-only helper to clear the cache between tests.
 */
export function _clearProductCostCache(): void {
  CACHE.clear();
}
