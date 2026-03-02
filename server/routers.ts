import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { supabase } from "./supabase";
import { getUserTeamId } from "./db";
import { authRouter } from "./routers/auth";
import { demoRouter } from "./routers/demo";
import { campaignsRouter } from "./routers/campaigns";
import { leadsRouter } from "./routers/leads";
import { templatesRouter } from "./routers/templates";
import { extensionRouter } from "./routers/extension";
import { billingRouter } from "./routers/billing";
import { z } from "zod";


export const appRouter = router({
  system: systemRouter,
  auth: authRouter,
  demo: demoRouter,
  campaigns: campaignsRouter,
  leads: leadsRouter,
  templates: templatesRouter,
  extension: extensionRouter,
  billing: billingRouter,

  queue: router({
    list: protectedProcedure
      .input(z.object({ status: z.enum(['all', 'new', 'approved']).optional() }).optional())
      .query(async ({ ctx, input }) => {
        if (!ctx.user?.id) return [];
        const teamId = await getUserTeamId(ctx.user.id);
        if (!teamId) return [];
        
        let query = supabase
          .from('action_queue')
          .select(`
            id,
            lead_id,
            campaign_id,
            status,
            created_at,
            updated_at,
            campaigns:campaign_id(name)
          `)
          .eq('team_id', teamId as string);
        
        // Filter by status
        if (input?.status === 'new') {
          query = query.eq('status', 'pending');
        } else if (input?.status === 'approved') {
          query = query.eq('status', 'ready');
        } else {
          // 'all' - show pending and ready
          query = query.in('status', ['pending', 'ready', 'skipped']);
        }
        
        const { data } = await query.order('created_at', { ascending: false });
        return data || [];
      }),

    approve: protectedProcedure
      .input(z.object({ itemId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user?.id) return null;
        const teamId = await getUserTeamId(ctx.user.id);
        if (!teamId) return null;

        const { data } = await supabase
          .from('action_queue')
          .update({
            status: 'ready',
            approved_by: ctx.user.id as string,
            approved_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', input.itemId)
          .eq('team_id', teamId as string)
          .select()
          .single();

        return data || null;
      }),

    reject: protectedProcedure
      .input(z.object({ itemId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user?.id) return null;
        const teamId = await getUserTeamId(ctx.user.id);
        if (!teamId) return null;
        const { data } = await supabase
          .from('action_queue')
          .update({
            status: 'skipped',
            updated_at: new Date().toISOString(),
          })
          .eq('id', input.itemId)
          .eq('team_id', teamId as string)
          .select()
          .single();
        return data || null;
      }),

    // Bulk operations
    bulkApprove: protectedProcedure
      .input(z.object({ itemIds: z.array(z.string()) }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user?.id || input.itemIds.length === 0) return null;
        const teamId = await getUserTeamId(ctx.user.id);
        if (!teamId) return null;
        
        const { data } = await supabase
          .from('action_queue')
          .update({
            status: 'ready',
            approved_by: ctx.user.id as string,
            approved_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .in('id', input.itemIds)
          .eq('team_id', teamId as string)
          .select();
        
        return { count: data?.length || 0, items: data || [] };
      }),

    bulkReject: protectedProcedure
      .input(z.object({ itemIds: z.array(z.string()) }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user?.id || input.itemIds.length === 0) return null;
        const teamId = await getUserTeamId(ctx.user.id);
        if (!teamId) return null;
        
        const { data } = await supabase
          .from('action_queue')
          .update({
            status: 'skipped',
            updated_at: new Date().toISOString(),
          })
          .in('id', input.itemIds)
          .eq('team_id', teamId as string)
          .select();
        
        return { count: data?.length || 0, items: data || [] };
      }),
  }),


});

export type AppRouter = typeof appRouter;
