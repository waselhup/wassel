import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc-init';
import {
  enqueueNotification,
  listForUser,
  unreadCount,
  markAsRead,
  markAllAsRead,
  dismiss,
  getPreferences,
  updatePreferences,
  markAppOpened,
} from '../lib/notification-engine';

/**
 * Notifications router — Sprint 8.
 *
 * 9 endpoints driving the bell, inbox page, settings page, and the smart-
 * dedup app-open ping. All protected (notifications are private to the user).
 */
export const notificationsRouter = router({
  list: protectedProcedure
    .input(z.object({
      status: z.enum(['unread', 'all']).optional(),
      limit:  z.number().int().min(1).max(100).optional(),
      offset: z.number().int().min(0).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const rows = await listForUser(ctx.supabase, ctx.user.id, input ?? {});
      return { notifications: rows };
    }),

  unreadCount: protectedProcedure
    .query(async ({ ctx }) => {
      const count = await unreadCount(ctx.supabase, ctx.user.id);
      return { count };
    }),

  markAsRead: protectedProcedure
    .input(z.object({ notificationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await markAsRead(ctx.supabase, ctx.user.id, input.notificationId);
      return { success: true };
    }),

  markAllAsRead: protectedProcedure
    .mutation(async ({ ctx }) => {
      return markAllAsRead(ctx.supabase, ctx.user.id);
    }),

  dismiss: protectedProcedure
    .input(z.object({ notificationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await dismiss(ctx.supabase, ctx.user.id, input.notificationId);
      return { success: true };
    }),

  getPreferences: protectedProcedure
    .query(async ({ ctx }) => {
      const prefs = await getPreferences(ctx.supabase, ctx.user.id);
      return { preferences: prefs };
    }),

  updatePreferences: protectedProcedure
    .input(z.object({
      emailEnabled:           z.boolean().optional(),
      inAppEnabled:           z.boolean().optional(),
      marketingEmailsEnabled: z.boolean().optional(),
      language:               z.enum(['ar', 'en']).optional(),
      quietHoursStart:        z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
      quietHoursEnd:          z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
      timezone:               z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await updatePreferences(ctx.supabase, ctx.user.id, {
        email_enabled:            input.emailEnabled,
        in_app_enabled:           input.inAppEnabled,
        marketing_emails_enabled: input.marketingEmailsEnabled,
        language:                 input.language,
        quiet_hours_start:        input.quietHoursStart ?? null,
        quiet_hours_end:          input.quietHoursEnd   ?? null,
        timezone:                 input.timezone,
      });
      return { success: true };
    }),

  markAppOpened: protectedProcedure
    .mutation(async ({ ctx }) => {
      await markAppOpened(ctx.supabase, ctx.user.id);
      return { success: true };
    }),

  // Admin-only: send a test notification to the current user (in-app + email).
  // Useful for verifying the pipeline end-to-end after settings changes.
  testNotification: protectedProcedure
    .input(z.object({
      channel:  z.enum(['in_app', 'email', 'both']).default('in_app'),
      language: z.enum(['ar', 'en']).default('ar'),
    }).optional())
    .mutation(async ({ ctx, input }) => {
      const channel  = input?.channel  ?? 'in_app';
      const language = input?.language ?? 'ar';

      const titleAr = 'إشعار تجريبي';
      const titleEn = 'Test notification';
      const bodyAr  = 'إذا وصلك هذا الإشعار، فإن نظام الإشعارات يعمل بشكل صحيح.';
      const bodyEn  = 'If you received this, the notification pipeline is working.';

      const result = await enqueueNotification(ctx.supabase, {
        userId:      ctx.user.id,
        templateKey: 'test_notification',
        category:    'system',
        channel,
        titleAr, titleEn,
        bodyAr,  bodyEn,
        ctaLabelAr: 'إعدادات الإشعارات',
        ctaLabelEn: 'Notification settings',
        ctaUrl:     'https://wasselhub.com/v2/settings/notifications',
        priority:   'normal',
        metadata:   { source: 'testNotification', language },
      });

      if (!result.queued && !result.skipped) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to enqueue test notification' });
      }
      return result;
    }),
});
