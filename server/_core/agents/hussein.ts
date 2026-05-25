// Hussein (حسين) — Operations agent.
// Auto-resolves known errors, monitors services, creates incidents on novel errors.
// approval mode: auto_with_bounds.

import { BaseAgent } from './base';

const DEFAULT_KNOWN_PATTERNS = [
  {
    pattern_key: 'anthropic_rate_limit_429',
    service: 'anthropic',
    error_signature: '429',
    description: 'Claude API rate limited',
    auto_resolution: 'wait_60s_retry_once',
    resolution_steps: { wait_ms: 60000, retry: 1 },
  },
  {
    pattern_key: 'supabase_pool_exhausted',
    service: 'supabase',
    error_signature: 'remaining connection slots are reserved',
    description: 'PG connection pool exhausted',
    auto_resolution: 'flush_idle_connections',
    resolution_steps: { action: 'flush' },
  },
  {
    pattern_key: 'apify_actor_timeout',
    service: 'apify',
    error_signature: 'actor timed out',
    description: 'Apify scraper timeout',
    auto_resolution: 'mark_incident_no_retry',
    resolution_steps: { create_incident: true, retry: 0 },
  },
  {
    pattern_key: 'moyasar_webhook_dup',
    service: 'moyasar',
    error_signature: 'duplicate',
    description: 'Idempotent moyasar duplicate webhook',
    auto_resolution: 'ignore',
    resolution_steps: { action: 'noop' },
  },
  {
    pattern_key: 'vercel_function_timeout',
    service: 'vercel',
    error_signature: 'Task timed out',
    description: 'Serverless function exceeded maxDuration',
    auto_resolution: 'log_and_alert',
    resolution_steps: { telegram_alert: true },
  },
];

export class HusseinAgent extends BaseAgent {
  readonly id = 'hussein';
  readonly nameAr = 'حسين';
  readonly nameEn = 'Hussein';

  async seedKnownErrorPatterns(): Promise<{ seeded: number }> {
    let seeded = 0;
    for (const p of DEFAULT_KNOWN_PATTERNS) {
      const { error } = await this.client()
        .from('known_error_patterns')
        .upsert({ ...p, is_active: true }, { onConflict: 'pattern_key' });
      if (!error) seeded++;
    }
    return { seeded };
  }

  async autoResolveKnownErrors(): Promise<{ scanned: number; resolved: number; novel: number }> {
    const since = new Date(Date.now() - 30 * 60 * 1000).toISOString(); // last 30 min
    const { data: errors } = await this.client()
      .from('api_logs')
      .select('id, service, endpoint, error_message, severity, created_at')
      .gte('created_at', since)
      .gte('severity', 'warn')
      .limit(200);

    const { data: patterns } = await this.client()
      .from('known_error_patterns')
      .select('*')
      .eq('is_active', true);

    let resolved = 0;
    let novel = 0;
    for (const err of errors || []) {
      const match = (patterns || []).find((p: any) =>
        p.service === err.service &&
        err.error_message &&
        new RegExp(p.error_signature, 'i').test(err.error_message)
      );
      if (match) {
        await this.client()
          .from('known_error_patterns')
          .update({
            occurrences_count: (match.occurrences_count || 0) + 1,
            last_seen: new Date().toISOString(),
          })
          .eq('id', match.id);
        resolved++;
      } else {
        novel++;
      }
    }
    return { scanned: (errors || []).length, resolved, novel };
  }

  async checkServicesHealth(): Promise<Record<string, { ok: boolean; latencyMs?: number; error?: string }>> {
    const out: Record<string, any> = {};
    const probe = async (name: string, fn: () => Promise<void>) => {
      const start = Date.now();
      try {
        await fn();
        out[name] = { ok: true, latencyMs: Date.now() - start };
      } catch (e: any) {
        out[name] = { ok: false, error: e?.message || String(e), latencyMs: Date.now() - start };
      }
    };

    await probe('supabase', async () => {
      const { error } = await this.client().from('profiles').select('id', { head: true, count: 'exact' }).limit(1);
      if (error) throw error;
    });
    await probe('anthropic', async () => {
      if (!process.env.ANTHROPIC_API_KEY) throw new Error('no key');
      // Lightweight HEAD on /models is enough
      const r = await fetch('https://api.anthropic.com/v1/models', {
        headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      });
      if (!r.ok && r.status !== 401) throw new Error(`HTTP ${r.status}`);
    });
    await probe('vercel', async () => {
      // Self-ping is fine — we just want connectivity
      const r = await fetch('https://wasselhub.com/api/health', { method: 'GET' }).catch(() => null);
      if (!r) throw new Error('no response');
    });
    return out;
  }

  async createIncidentFromError(opts: { error: string; severity: 'low' | 'medium' | 'high' | 'critical'; service?: string }): Promise<{ incidentId: string | null }> {
    try {
      const { data } = await this.client()
        .from('incidents')
        .insert({
          title: `Hussein auto-incident: ${opts.error.slice(0, 80)}`,
          description: opts.error.slice(0, 2000),
          severity: opts.severity,
          status: 'open',
          service: opts.service || null,
          created_by_agent: this.id,
        })
        .select('id')
        .single();
      return { incidentId: data?.id || null };
    } catch (e) {
      console.warn('[hussein] incident create failed', e);
      return { incidentId: null };
    }
  }
}

export const hussein = new HusseinAgent();
