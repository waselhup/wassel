import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc-init';
import { callClaude, extractText, extractJson } from '../lib/claude-client';
import { classifyClaudeError, sendClaudeOpsAlert } from '../lib/apiLogger';
import { deductTokens, refundTokens, throwInsufficientTokensError } from '../lib/tokens';

// ===== Enums =====
const TONE = z.enum([
  'professional',
  'friendly',
  'humorous',
  'humble',
  'bold',
  'analytical',
  'storytelling',
  'motivational',
  'sarcastic',
  'provocative',
]);

const DIALECT = z.enum([
  'msa',
  'saudi-general',
  'saudi-najdi',
  'saudi-hijazi',
  'saudi-southern',
  'english',
  'mixed',
]);

const AUDIENCE = z.enum([
  'entrepreneurs',
  'employees',
  'hr-recruiters',
  'developers',
  'executives',
  'investors',
  'general',
]);

const GOAL = z.enum([
  'thought-leadership',
  'lead-generation',
  'product-launch',
  'followers-growth',
  'share-experience',
  'announcement',
]);

const LENGTH = z.enum(['short', 'medium', 'long']);

// ===== System Prompt =====
const POST_BUILDER_SYSTEM = `You are an elite LinkedIn content strategist specializing in Saudi/GCC market.

Your task: Generate 3 variations of a LinkedIn post based on user's preferences:
- SAFE: professional, broadly appealing, low-risk
- BALANCED: engaging but thoughtful (the recommended default)
- BOLD: provocative, scroll-stopping, higher risk/reward

DIALECT RULES (SACRED — must be authentic):
- msa (فصحى): Formal Modern Standard Arabic, no colloquialisms
- saudi-general: Neutral Saudi Arabic, widely understood
- saudi-najdi (نجدي): Riyadh style
  * Phrases: "كيف الحال", "وش رايك", "ابد"
  * Tone: sharp, decisive, business-like
- saudi-hijazi (حجازي): Jeddah/Makkah style
  * Phrases: "ازيك", "عاوز"
  * Tone: softer melodic flow, cosmopolitan, diverse
- saudi-southern (جنوبي): Abha/Jazan/Asir style
  * Phrases: "كيف حالك", "وشلونك", "يا طيب"
  * Tone: warm, measured, community-oriented
- english: Native English, LinkedIn-optimized
- mixed: Arabic primary, English technical terms welcomed

TONE BLENDING:
User picks 1-3 tones. Blend them naturally into ONE coherent voice.
Examples:
- [professional + humble] = "I've been thinking about..." not "As an expert, I confirm..."
- [storytelling + bold] = Opens with visceral scene, lands with strong claim
- [analytical + friendly] = Data-backed but conversational

LENGTH TARGETS (char count):
- short: 400-700 chars (2-3 paragraphs)
- medium: 700-1500 chars (4-6 paragraphs, LinkedIn sweet spot)
- long: 1500-2500 chars (deep dive, must earn every char)

STYLE MATCHING (when userStyle is provided):
MIRROR these traits — don't copy content, copy VOICE:
- Sentence rhythm (short punchy vs flowing)
- Signature phrases (reuse 1-2 naturally, not forced)
- Emoji frequency (zero if user doesn't use them)
- Paragraph structure
- How they start hooks

INSPIRATION HANDLING (when inspiration is provided):
- Extract 2-3 key ideas from the source
- Build the post from USER'S PERSPECTIVE, not a summary
- Never reveal the source URL in the post itself
- Never say "I watched a video" or "I read an article" unless it's part of the story
- The source is fuel for the user's own insight, not content to regurgitate

HOOK RULES (CRITICAL):
- First 2 lines MUST make reader stop scrolling
- LinkedIn truncates after ~200 chars
- Avoid: "In today's fast-paced world", "Have you ever wondered", "I'm excited to announce"
- Favor: specific numbers, contrarian claims, personal confessions, sharp questions

OUTPUT FORMAT (JSON only, no markdown fences):
{
  "dna": {
    "topic": string,
    "tones": string[],
    "dialect": string,
    "language": string,
    "audience": string,
    "goal": string,
    "length": string,
    "dnaScore": number
  },
  "variations": [
    {
      "id": "safe",
      "label": "آمن" or "Safe",
      "content": string,
      "charCount": number,
      "hook": string,
      "hashtags": string[]
    },
    {
      "id": "balanced",
      "label": "متوازن" or "Balanced",
      "content": string,
      "charCount": number,
      "hook": string,
      "hashtags": string[]
    },
    {
      "id": "bold",
      "label": "جريء" or "Bold",
      "content": string,
      "charCount": number,
      "hook": string,
      "hashtags": string[]
    }
  ],
  "tips": string[]
}

GOLDEN RULES:
1. NEVER sound like generic AI
2. NEVER use clichés listed above
3. Dialect authenticity is non-negotiable — wrong dialect = total failure
4. If extras.hashtags is false, return [] for hashtags
5. If extras.emojis is false, use ZERO emojis
6. DNA score: reflect how cohesive the user's choices are (80+ if aligned)`;

export const postsRouter = router({
  // === GENERATE (main endpoint) ===
  generate: protectedProcedure
    .input(
      z.object({
        topic: z.string().min(10).max(2000),
        tones: z.array(TONE).min(1).max(3),
        dialect: DIALECT,
        audience: AUDIENCE.optional(),
        goal: GOAL.optional(),
        length: LENGTH.default('medium'),
        extras: z
          .object({
            hashtags: z.boolean().default(true),
            callToAction: z.boolean().default(false),
            emojis: z.boolean().default(false),
            endingQuestion: z.boolean().default(false),
            personalStory: z.boolean().default(false),
          })
          .default({}),
        useStyleSamples: z.boolean().default(false),
        inspirationUrl: z.string().url().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const TOKEN_COST = 30;
      const FEATURE = 'posts.generate';
      let deducted = false;

      // Atomic deduct BEFORE downstream work — row-locked, race-safe.
      const deduct = await deductTokens(ctx.supabase, ctx.user.id, TOKEN_COST, FEATURE);
      if (!deduct.success) throwInsufficientTokensError(deduct, 'ar');
      deducted = true;
      console.log('[posts.generate] tokens deducted', deduct.balance_before, '→', deduct.balance_after);

      let userStyle: any = null;
      if (input.useStyleSamples) {
        const { data: samples } = await ctx.supabase
          .from('user_writing_samples')
          .select('content, style_analysis')
          .eq('user_id', ctx.user.id)
          .order('created_at', { ascending: false })
          .limit(3);

        if (samples && samples.length > 0) {
          userStyle = {
            analyses: samples.map((s: any) => s.style_analysis).filter(Boolean),
            rawSamples: samples.map((s: any) => s.content).slice(0, 3),
          };
        }
      }

      let inspiration: any = null;
      if (input.inspirationUrl) {
        try {
          const { extractFromURL } = await import('../lib/inspiration-extractor');
          inspiration = await extractFromURL(input.inspirationUrl);
        } catch (err: any) {
          if (deducted) { await refundTokens(ctx.supabase, ctx.user.id, TOKEN_COST, FEATURE); deducted = false; }
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `فشل استخراج المحتوى: ${err.message}`,
          });
        }
      }

      const userPromptObj = {
        topic: input.topic,
        tones: input.tones,
        dialect: input.dialect,
        audience: input.audience,
        goal: input.goal,
        length: input.length,
        extras: input.extras,
        userStyle,
        inspiration: inspiration
          ? {
              source: inspiration.source,
              title: inspiration.title,
              summary: inspiration.summary,
            }
          : null,
      };

      let result: any;
      try {
        const response = await callClaude({
          task: 'post_generate',
          system: POST_BUILDER_SYSTEM,
          userContent: JSON.stringify(userPromptObj),
          maxTokens: 4000,
          modelOverride: 'claude-sonnet-4-6',
        });
        const text = extractText(response);
        result = extractJson<any>(text);
        if (!result || !result.variations || !Array.isArray(result.variations)) {
          throw new Error('Invalid JSON shape from Claude');
        }
      } catch (err: any) {
        // Claude failed → refund so user can retry without being double-charged.
        if (deducted) { await refundTokens(ctx.supabase, ctx.user.id, TOKEN_COST, FEATURE); deducted = false; }
        const status = err?.status ?? 0;
        const body = err?.responseBody ?? err?.body ?? err?.message ?? '';
        const info = classifyClaudeError(status, body);
        if (info.alertOps)
          void sendClaudeOpsAlert(info, '/api/trpc/posts.generate');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: info.userMessage || 'فشل التوليد — حاول مرة أخرى',
        });
      }

      // Save to DB
      const lang =
        input.dialect === 'english'
          ? 'en'
          : input.dialect === 'mixed'
          ? 'ar'
          : 'ar';

      const { data: saved, error: saveErr } = await ctx.supabase
        .from('posts')
        .insert({
          user_id: ctx.user.id,
          topic: input.topic,
          tones: input.tones,
          dialect: input.dialect,
          audience: input.audience || null,
          goal: input.goal || null,
          length_preference: input.length,
          extras: input.extras,
          inspiration_url: input.inspirationUrl || null,
          inspiration_source: inspiration?.source || null,
          style_samples_used: input.useStyleSamples,
          variations: result.variations,
          content: result.variations[1]?.content || result.variations[0]?.content || '',
          selected_variation: 'balanced',
          status: 'draft',
          tokens_used: TOKEN_COST,
          language: lang,
          ai_generated: true,
          ai_prompt: input.topic,
          hashtags: Array.isArray(result.variations[1]?.hashtags)
            ? result.variations[1].hashtags
            : [],
        })
        .select()
        .single();

      if (saveErr) {
        console.error('[posts.generate] save error:', saveErr);
        if (deducted) { await refundTokens(ctx.supabase, ctx.user.id, TOKEN_COST, FEATURE); deducted = false; }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: saveErr.message,
        });
      }

      // Deduction already happened atomically before Claude — no second deduct here.

      return {
        id: saved.id,
        dna: result.dna,
        variations: result.variations,
        tips: Array.isArray(result.tips) ? result.tips : [],
        tokensUsed: TOKEN_COST,
        tokensRemaining: deduct.balance_after,
      };
    }),

  // === SELECT VARIATION ===
  selectVariation: protectedProcedure
    .input(
      z.object({
        postId: z.string().uuid(),
        variationId: z.enum(['safe', 'balanced', 'bold']),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { data: post } = await ctx.supabase
        .from('posts')
        .select('variations')
        .eq('id', input.postId)
        .eq('user_id', ctx.user.id)
        .single();

      if (!post) throw new TRPCError({ code: 'NOT_FOUND' });

      const selected = (post.variations as any[]).find(
        (v) => v.id === input.variationId
      );
      if (!selected) throw new TRPCError({ code: 'BAD_REQUEST' });

      await ctx.supabase
        .from('posts')
        .update({
          selected_variation: input.variationId,
          content: selected.content,
          hashtags: Array.isArray(selected.hashtags) ? selected.hashtags : [],
        })
        .eq('id', input.postId)
        .eq('user_id', ctx.user.id);

      return { success: true };
    }),

  // === STYLE SAMPLES CRUD ===
  addStyleSample: protectedProcedure
    .input(
      z.object({
        content: z.string().min(50).max(5000),
      })
    )
    .mutation(async ({ input, ctx }) => {
      let styleAnalysis: any = null;
      try {
        const { analyzeWritingStyle } = await import('../lib/style-analyzer');
        styleAnalysis = await analyzeWritingStyle([input.content]);
      } catch (err: any) {
        console.warn('[style-analyzer] failed:', err?.message || err);
      }

      const { data, error } = await ctx.supabase
        .from('user_writing_samples')
        .insert({
          user_id: ctx.user.id,
          content: input.content,
          source: 'manual',
          style_analysis: styleAnalysis,
        })
        .select()
        .single();

      if (error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message,
        });
      return { id: data.id, styleAnalysis };
    }),

  listStyleSamples: protectedProcedure.query(async ({ ctx }) => {
    const { data } = await ctx.supabase
      .from('user_writing_samples')
      .select('*')
      .eq('user_id', ctx.user.id)
      .order('created_at', { ascending: false });
    return data || [];
  }),

  deleteStyleSample: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.supabase
        .from('user_writing_samples')
        .delete()
        .eq('id', input.id)
        .eq('user_id', ctx.user.id);
      return { success: true };
    }),

  // === INSPIRATION PREVIEW ===
  previewInspiration: protectedProcedure
    .input(z.object({ url: z.string().url() }))
    .mutation(async ({ input }) => {
      const { extractFromURL } = await import('../lib/inspiration-extractor');
      const content = await extractFromURL(input.url);
      return {
        source: content.source,
        title: content.title,
        preview: content.summary.slice(0, 500),
      };
    }),

  // === LIST (preserve for history) ===
  list: protectedProcedure.query(async ({ ctx }) => {
    const { data } = await ctx.supabase
      .from('posts')
      .select('*')
      .eq('user_id', ctx.user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    return data || [];
  }),

  // === DELETE ===
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.supabase
        .from('posts')
        .delete()
        .eq('id', input.id)
        .eq('user_id', ctx.user.id);
      return { success: true };
    }),

  // === UPDATE (for LinkedIn status, etc.) ===
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        patch: z
          .object({
            status: z.enum(['draft', 'scheduled', 'posted']).optional(),
            content: z.string().optional(),
            scheduled_for: z.string().nullable().optional(),
          })
          .partial(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { data, error } = await ctx.supabase
        .from('posts')
        .update({ ...input.patch, updated_at: new Date().toISOString() })
        .eq('id', input.id)
        .eq('user_id', ctx.user.id)
        .select()
        .single();
      if (error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message,
        });
      return data;
    }),
});
