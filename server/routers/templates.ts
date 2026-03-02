import { z } from 'zod';
import { protectedProcedure, router } from '../_core/trpc';
import { supabase } from '../supabase';
import { getUserTeamId } from '../db';

export const templatesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user?.id) return [];
    const teamId = await getUserTeamId(ctx.user.id);
    if (!teamId) return [];

    const { data } = await supabase
      .from('message_templates')
      .select('*')
      .eq('team_id', teamId as string)
      .order('created_at', { ascending: false });

    return data || [];
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, 'اسم القالب مطلوب'),
        category: z.string().optional(),
        subject: z.string().optional(),
        content: z.string().min(1, 'محتوى القالب مطلوب'),
        variables: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.id) {
        throw new Error('غير مصرح');
      }

      const teamId = await getUserTeamId(ctx.user.id);
      if (!teamId) {
        throw new Error('فريق غير موجود');
      }

      // Extract variables from content ({{variable}})
      const variableRegex = /\{\{(\w+)\}\}/g;
      const variables: string[] = [];
      let match;
      while ((match = variableRegex.exec(input.content)) !== null) {
        if (!variables.includes(match[1])) {
          variables.push(match[1]);
        }
      }

      const { data, error } = await supabase
        .from('message_templates')
        .insert({
          team_id: teamId,
          name: input.name,
          category: input.category || 'عام',
          subject: input.subject || '',
          content: input.content,
          variables: [...(input.variables || []), ...variables],
          created_by: ctx.user.id,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        throw new Error(`خطأ في إنشاء القالب: ${error.message}`);
      }

      return data;
    }),

  update: protectedProcedure
    .input(
      z.object({
        templateId: z.string(),
        name: z.string().optional(),
        category: z.string().optional(),
        subject: z.string().optional(),
        content: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.id) {
        throw new Error('غير مصرح');
      }

      const teamId = await getUserTeamId(ctx.user.id);
      if (!teamId) {
        throw new Error('فريق غير موجود');
      }

      // Verify template belongs to team
      const { data: template } = await supabase
        .from('message_templates')
        .select('id')
        .eq('id', input.templateId)
        .eq('team_id', teamId as string)
        .single();

      if (!template) {
        throw new Error('القالب غير موجود');
      }

      // Extract variables from content if provided
      let variables: string[] = [];
      if (input.content) {
        const variableRegex = /\{\{(\w+)\}\}/g;
        let match;
        while ((match = variableRegex.exec(input.content)) !== null) {
          if (!variables.includes(match[1])) {
            variables.push(match[1]);
          }
        }
      }

      const updateData: any = {};
      if (input.name) updateData.name = input.name;
      if (input.category) updateData.category = input.category;
      if (input.subject) updateData.subject = input.subject;
      if (input.content) updateData.content = input.content;
      if (variables.length > 0) updateData.variables = variables;

      const { data, error } = await supabase
        .from('message_templates')
        .update(updateData)
        .eq('id', input.templateId)
        .eq('team_id', teamId as string)
        .select()
        .single();

      if (error) {
        throw new Error(`خطأ في تحديث القالب: ${error.message}`);
      }

      return data;
    }),

  delete: protectedProcedure
    .input(z.object({ templateId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.id) {
        throw new Error('غير مصرح');
      }

      const teamId = await getUserTeamId(ctx.user.id);
      if (!teamId) {
        throw new Error('فريق غير موجود');
      }

      const { data, error } = await supabase
        .from('message_templates')
        .delete()
        .eq('id', input.templateId)
        .eq('team_id', teamId as string)
        .select()
        .single();

      if (error) {
        throw new Error(`خطأ في حذف القالب: ${error.message}`);
      }

      return data;
    }),

  preview: protectedProcedure
    .input(
      z.object({
        content: z.string(),
        variables: z.record(z.string(), z.any()).optional(),
      })
    )
    .query(async ({ input }) => {
      let preview = input.content;

      // Replace variables
      if (input.variables) {
        Object.entries(input.variables).forEach(([key, value]) => {
          preview = preview.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value));
        });
      }

      // Replace remaining variables with placeholder
      preview = preview.replace(/\{\{(\w+)\}\}/g, '[[$1]]');

      return { preview };
    }),

  linkToCampaign: protectedProcedure
    .input(
      z.object({
        templateId: z.string(),
        campaignId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.id) {
        throw new Error('غير مصرح');
      }

      const teamId = await getUserTeamId(ctx.user.id);
      if (!teamId) {
        throw new Error('فريق غير موجود');
      }

      // Verify template belongs to team
      const { data: template } = await supabase
        .from('message_templates')
        .select('id')
        .eq('id', input.templateId)
        .eq('team_id', teamId as string)
        .single();

      if (!template) {
        throw new Error('القالب غير موجود');
      }

      // Verify campaign belongs to team
      const { data: campaign } = await supabase
        .from('campaigns')
        .select('id, configuration')
        .eq('id', input.campaignId)
        .eq('team_id', teamId as string)
        .single();

      if (!campaign) {
        throw new Error('الحملة غير موجودة');
      }

      // Update campaign configuration
      const config = campaign.configuration || {};
      config.template_id = input.templateId;

      const { data, error } = await supabase
        .from('campaigns')
        .update({
          configuration: config,
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.campaignId)
        .select()
        .single();

      if (error) {
        throw new Error(`خطأ في ربط القالب: ${error.message}`);
      }

      return data;
    }),
});
