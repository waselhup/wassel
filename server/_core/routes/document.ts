import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc-init';
import { parseDocument, type ParseResult } from '../lib/document-parser';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export const documentRouter = router({
  parse: protectedProcedure
    .input(
      z.object({
        fileBase64: z.string().min(1),
        fileName: z.string().min(1),
        mimeType: z.string().min(1),
      })
    )
    .mutation(async ({ input }): Promise<ParseResult & { textLength: number }> => {
      const buffer = Buffer.from(input.fileBase64, 'base64');

      if (buffer.length > MAX_FILE_SIZE) {
        throw new TRPCError({
          code: 'PAYLOAD_TOO_LARGE',
          message: `File too large (${Math.round(buffer.length / 1024 / 1024)}MB). Max 10MB.`,
        });
      }

      try {
        const result = await parseDocument(buffer, input.mimeType, input.fileName);
        return {
          ...result,
          textLength: result.text.length,
        };
      } catch (err: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: err?.message || 'Failed to parse document',
        });
      }
    }),
});
