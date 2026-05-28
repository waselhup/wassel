import { initTRPC, TRPCError } from '@trpc/server';
import { Context } from './context';
import { formatError, logErrorEvent } from './lib/error-formatter';

const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error, ctx, path }) {
    const userId = (ctx as { user?: { id?: string } } | undefined)?.user?.id;
    const language: 'ar' | 'en' = 'ar';
    const cause = error.cause ?? error;
    const formatted = formatError(cause, path || 'unknown', language);

    const supa = (ctx as { supabase?: unknown } | undefined)?.supabase;
    if (supa) {
      logErrorEvent(supa as Parameters<typeof logErrorEvent>[0], {
        userId,
        errorCode: formatted.code,
        errorCategory: formatted.category,
        operation: path || 'unknown',
        rawMessage: error.message,
        formattedKey: formatted.messageKey,
        formattedParams: formatted.params,
        refundedTokens: formatted.refundedTokens,
        resolution: formatted.recovery,
      }).catch(() => {});
    }

    return {
      ...shape,
      data: {
        ...shape.data,
        messageKey: formatted.messageKey,
        params: formatted.params,
        recovery: formatted.recovery,
        refundedTokens: formatted.refundedTokens ?? 0,
        category: formatted.category,
        errorCode: formatted.code,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Not authenticated',
    });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});
