const express = require('express');
const cors = require('cors');
const { initTRPC, TRPCError } = require('@trpc/server');
const { createExpressMiddleware } = require('@trpc/server/adapters/express');
const { createClient } = require('@supabase/supabase-js');
const { z } = require('zod');

// === Supabase Setup ===
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://hiqotmimlgsrsnovtopd.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
let supabase = null;
try {
  if (supabaseServiceKey) {
    supabase = createClient(supabaseUrl, supabaseServiceKey);
  }
} catch (err) {
  console.error('Supabase init error:', err.message);
}

// === tRPC Setup ===
const t = initTRPC.context().create();
const router = t.router;
const publicProcedure = t.procedure;
const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

async function createContext({ req }) {
  let user = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ') && supabase) {
    try {
      const token = authHeader.slice(7);
      const { data: { user: authUser } } = await supabase.auth.getUser(token);
      user = authUser;
    } catch (err) {
      console.error('Auth error:', err.message);
    }
  }
  return { user, supabase };
}

// === LinkedIn Router ===
const linkedinRouter = router({
  analyze: protectedProcedure
    .input(z.object({ profileUrl: z.string().url() }))
    .mutation(async ({ input, ctx }) => {
      const { data: profile } = await ctx.supabase
        .from('profiles').select('token_balance').eq('id', ctx.user.id).single();
      if (!profile || profile.token_balance < 5) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Insufficient tokens' });
      }
      const analysis = {
        score: 72,
        headlineSuggestion: 'Senior Software Engineer | React & Node.js Expert',
        summarySuggestion: 'Experienced software engineer specializing in full-stack development.',
        keywords: ['React', 'Node.js', 'TypeScript', 'SaaS', 'Cloud', 'AI'],
      };
      await ctx.supabase.from('profiles').update({ token_balance: profile.token_balance - 5 }).eq('id', ctx.user.id);
      await ctx.supabase.from('linkedin_analyses').insert([{
        user_id: ctx.user.id, profile_url: input.profileUrl, score: analysis.score, analysis_data: analysis,
      }]);
      return analysis;
    }),
  history: protectedProcedure.query(async ({ ctx }) => {
    const { data } = await ctx.supabase.from('linkedin_analyses')
      .select('*').eq('user_id', ctx.user.id).order('created_at', { ascending: false });
    return data || [];
  }),
});

// === CV Router ===
const cvRouter = router({
  tailor: protectedProcedure
    .input(z.object({ fields: z.array(z.string()).min(1).max(3) }))
    .mutation(async ({ input, ctx }) => {
      const { data: profile } = await ctx.supabase
        .from('profiles').select('token_balance').eq('id', ctx.user.id).single();
      if (!profile || profile.token_balance < 10) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Insufficient tokens (need 10)' });
      }
      const results = input.fields.map(field => ({
        field, filename: `CV_${field.replace(/\s+/g, '_')}.pdf`, url: '#',
      }));
      await ctx.supabase.from('profiles').update({ token_balance: profile.token_balance - 10 }).eq('id', ctx.user.id);
      return results;
    }),
});

// === Campaign Router ===
const campaignRouter = router({
  create: protectedProcedure
    .input(z.object({ name: z.string(), targetTitle: z.string(), location: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const { data } = await ctx.supabase.from('campaigns').insert([{
        user_id: ctx.user.id, name: input.name, target_title: input.targetTitle,
        location: input.location || 'Saudi Arabia', status: 'draft',
      }]).select().single();
      return data;
    }),
  list: protectedProcedure.query(async ({ ctx }) => {
    const { data } = await ctx.supabase.from('campaigns')
      .select('*').eq('user_id', ctx.user.id).order('created_at', { ascending: false });
    return data || [];
  }),
});

// === Token Router ===
const tokenRouter = router({
  balance: protectedProcedure.query(async ({ ctx }) => {
    const { data } = await ctx.supabase.from('profiles').select('token_balance').eq('id', ctx.user.id).single();
    return { balance: data?.token_balance || 0 };
  }),
  history: protectedProcedure.query(async ({ ctx }) => {
    const { data } = await ctx.supabase.from('token_transactions')
      .select('*').eq('user_id', ctx.user.id).order('created_at', { ascending: false }).limit(50);
    return data || [];
  }),
});

// === Admin Router ===
const adminRouter = router({
  users: protectedProcedure.query(async ({ ctx }) => {
    const { data: admin } = await ctx.supabase.from('profiles').select('is_admin').eq('id', ctx.user.id).single();
    if (!admin?.is_admin) throw new TRPCError({ code: 'FORBIDDEN', message: 'Not admin' });
    const { data } = await ctx.supabase.from('profiles').select('*').order('created_at', { ascending: false });
    return data || [];
  }),
  addTokens: protectedProcedure
    .input(z.object({ userId: z.string(), amount: z.number().positive() }))
    .mutation(async ({ input, ctx }) => {
      const { data: admin } = await ctx.supabase.from('profiles').select('is_admin').eq('id', ctx.user.id).single();
      if (!admin?.is_admin) throw new TRPCError({ code: 'FORBIDDEN', message: 'Not admin' });
      const { data: profile } = await ctx.supabase.from('profiles').select('token_balance').eq('id', input.userId).single();
      await ctx.supabase.from('profiles').update({ token_balance: (profile?.token_balance || 0) + input.amount }).eq('id', input.userId);
      return { success: true };
    }),
  stats: protectedProcedure.query(async ({ ctx }) => {
    const { data: admin } = await ctx.supabase.from('profiles').select('is_admin').eq('id', ctx.user.id).single();
    if (!admin?.is_admin) throw new TRPCError({ code: 'FORBIDDEN', message: 'Not admin' });
    const { count: userCount } = await ctx.supabase.from('profiles').select('*', { count: 'exact', head: true });
    const { count: campaignCount } = await ctx.supabase.from('campaigns').select('*', { count: 'exact', head: true });
    return { users: userCount || 0, campaigns: campaignCount || 0 };
  }),
});

// === App Router ===
const appRouter = router({
  health: publicProcedure.query(async () => ({
    status: 'ok', timestamp: new Date().toISOString(),
  })),
  auth: router({
    profile: protectedProcedure.query(async ({ ctx }) => {
      const { data, error } = await ctx.supabase.from('profiles').select('*').eq('id', ctx.user.id).single();
      if (error) throw new TRPCError({ code: 'NOT_FOUND' });
      return data;
    }),
  }),
  linkedin: linkedinRouter,
  cv: cvRouter,
  campaign: campaignRouter,
  token: tokenRouter,
  admin: adminRouter,
});

// === Express App ===
const app = express();

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://wassel.vercel.app', 'https://wassel-alpha.vercel.app',
       'https://wassel-waselhupsas-projects.vercel.app',
       'https://wassel-git-master-waselhupsas-projects.vercel.app',
       'https://wassel.sa']
    : 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '2.0.0' });
});

app.use('/api/trpc', createExpressMiddleware({ router: appRouter, createContext }));

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Vercel serverless handler
module.exports = (req, res) => app(req, res);
