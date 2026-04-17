import { z } from 'zod';
import { router, protectedProcedure } from '../trpc-init';
import { TRPCError } from '@trpc/server';

const HUNTER_API_KEY = process.env.HUNTER_API_KEY || '';
const ADMIN_EMAILS = ['waselhup@gmail.com', 'almodhih.1995@gmail.com', 'alhashimali649@gmail.com'];

async function requireAdmin(ctx: any) {
  const { data: profile } = await ctx.supabase
    .from('profiles')
    .select('is_admin, email')
    .eq('id', ctx.user.id)
    .single();
  if (!profile?.is_admin && !ADMIN_EMAILS.includes(profile?.email || '')) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin only' });
  }
}

async function hunterDomainSearch(domain: string): Promise<{ emails: string[]; error?: string }> {
  if (!HUNTER_API_KEY) return { emails: [], error: 'HUNTER_API_KEY not configured' };
  try {
    const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&limit=10&api_key=${HUNTER_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) {
      const txt = await res.text();
      return { emails: [], error: `Hunter ${res.status}: ${txt.slice(0, 200)}` };
    }
    const data = (await res.json()) as { data?: { emails?: Array<{ value: string; type?: string; confidence?: number }> } };
    const emails = (data?.data?.emails || [])
      .filter((e) => (e.confidence ?? 0) >= 50)
      .map((e) => e.value)
      .filter(Boolean);
    return { emails };
  } catch (e: any) {
    return { emails: [], error: e?.message || 'Hunter request failed' };
  }
}

export const companiesRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          industry: z.string().optional(),
          city: z.string().optional(),
          size: z.string().optional(),
          search: z.string().optional(),
          limit: z.number().int().positive().max(200).default(100),
        })
        .optional()
    )
    .query(async ({ input, ctx }) => {
      const f = input || { limit: 100 };
      let q = ctx.supabase
        .from('saudi_companies')
        .select('id, name, name_ar, website, industry, city, size, primary_email, contact_emails, verified, last_enriched_at')
        .order('name', { ascending: true })
        .limit(f.limit ?? 100);

      if (f.industry) q = q.eq('industry', f.industry);
      if (f.city) q = q.eq('city', f.city);
      if (f.size) q = q.eq('size', f.size);
      if (f.search) q = q.ilike('name', `%${f.search}%`);

      const { data, error } = await q;
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return data || [];
    }),

  industries: protectedProcedure.query(async ({ ctx }) => {
    const { data } = await ctx.supabase.from('saudi_companies').select('industry').not('industry', 'is', null);
    const set = new Set<string>();
    (data || []).forEach((r: any) => r.industry && set.add(r.industry));
    return Array.from(set).sort();
  }),

  get: protectedProcedure.input(z.object({ id: z.string().uuid() })).query(async ({ input, ctx }) => {
    const { data, error } = await ctx.supabase.from('saudi_companies').select('*').eq('id', input.id).single();
    if (error) throw new TRPCError({ code: 'NOT_FOUND', message: 'Company not found' });
    return data;
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        name_ar: z.string().optional(),
        website: z.string().optional(),
        industry: z.string().optional(),
        city: z.string().default('Riyadh'),
        size: z.enum(['startup', 'small', 'medium', 'large', 'enterprise']).optional(),
        primary_email: z.string().email().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireAdmin(ctx);
      const { data, error } = await ctx.supabase.from('saudi_companies').insert([input]).select().single();
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return data;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        patch: z
          .object({
            name: z.string().optional(),
            name_ar: z.string().optional(),
            website: z.string().optional(),
            industry: z.string().optional(),
            city: z.string().optional(),
            size: z.enum(['startup', 'small', 'medium', 'large', 'enterprise']).optional(),
            primary_email: z.string().email().optional().nullable(),
            verified: z.boolean().optional(),
          })
          .partial(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireAdmin(ctx);
      const { data, error } = await ctx.supabase
        .from('saudi_companies')
        .update({ ...input.patch, updated_at: new Date().toISOString() })
        .eq('id', input.id)
        .select()
        .single();
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return data;
    }),

  enrich: protectedProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ input, ctx }) => {
    await requireAdmin(ctx);

    const { data: company, error: findErr } = await ctx.supabase
      .from('saudi_companies')
      .select('*')
      .eq('id', input.id)
      .single();
    if (findErr || !company) throw new TRPCError({ code: 'NOT_FOUND', message: 'Company not found' });

    const domain = (company.website || '').replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    if (!domain) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Company has no website/domain to enrich' });
    }

    const { emails, error: hErr } = await hunterDomainSearch(domain);
    const notes = hErr ? `Hunter error: ${hErr}` : `Enriched via Hunter — found ${emails.length} emails`;

    const mergedEmails = Array.from(new Set([...(company.contact_emails || []), ...emails]));
    const primary = company.primary_email || emails[0] || null;

    const { data: updated, error: updErr } = await ctx.supabase
      .from('saudi_companies')
      .update({
        contact_emails: mergedEmails,
        primary_email: primary,
        last_enriched_at: new Date().toISOString(),
        enrichment_notes: notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.id)
      .select()
      .single();
    if (updErr) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: updErr.message });

    return { company: updated, emailsFound: emails.length, note: notes };
  }),

  delete: protectedProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ input, ctx }) => {
    await requireAdmin(ctx);
    const { error } = await ctx.supabase.from('saudi_companies').delete().eq('id', input.id);
    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
    return { ok: true };
  }),
});
