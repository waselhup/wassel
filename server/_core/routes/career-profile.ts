import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc-init';
import {
  getCareerProfile,
  upsertCareerProfile,
  updateCareerProfile,
  deleteCareerProfile,
  createSectionOverride,
  listActiveSectionOverrides,
  deleteSectionOverride,
  exportUserData,
  deleteUserData,
  logActivity,
  type CareerProfileInput,
  type CareerProfilePatch,
} from '../lib/career-profile';
import { getWallets } from '../lib/wallets';

const GOAL = z.enum(['job_search', 'promotion', 'personal_brand', 'opportunities', 'career_change']);
const LEVEL = z.enum(['entry', 'mid', 'senior', 'executive']);
const LANGUAGE = z.enum(['ar', 'en']);
const SECTION = z.enum(['radar', 'resume', 'content']);

const CAREER_PROFILE_INPUT = z.object({
  goal: GOAL,
  level: LEVEL,
  target_role: z.string().min(1).max(80),
  industry: z.string().min(1).max(60),
  primary_language: LANGUAGE.default('ar'),
  linkedin_url: z.string().url().nullable().optional(),
  manual_about: z.string().max(1000).nullable().optional(),
  manual_top_skills: z.array(z.string().max(40)).max(8).nullable().optional(),
  manual_current_role: z.string().max(120).nullable().optional(),
  manual_years_experience: z.number().int().min(0).max(60).nullable().optional(),
  manual_education: z.string().max(200).nullable().optional(),
});

const CAREER_PROFILE_PATCH = CAREER_PROFILE_INPUT.partial();

function normalizeInput(input: z.infer<typeof CAREER_PROFILE_INPUT>): CareerProfileInput {
  return {
    goal: input.goal,
    level: input.level,
    target_role: input.target_role.trim(),
    industry: input.industry.trim(),
    primary_language: input.primary_language ?? 'ar',
    linkedin_url: input.linkedin_url ?? null,
    manual_about: input.manual_about ?? null,
    manual_top_skills: input.manual_top_skills ?? null,
    manual_current_role: input.manual_current_role ?? null,
    manual_years_experience: input.manual_years_experience ?? null,
    manual_education: input.manual_education ?? null,
  };
}

function normalizePatch(patch: z.infer<typeof CAREER_PROFILE_PATCH>): CareerProfilePatch {
  const out: CareerProfilePatch = {};
  if (patch.goal !== undefined) out.goal = patch.goal;
  if (patch.level !== undefined) out.level = patch.level;
  if (patch.target_role !== undefined) out.target_role = patch.target_role.trim();
  if (patch.industry !== undefined) out.industry = patch.industry.trim();
  if (patch.primary_language !== undefined) out.primary_language = patch.primary_language;
  if (patch.linkedin_url !== undefined) out.linkedin_url = patch.linkedin_url ?? null;
  if (patch.manual_about !== undefined) out.manual_about = patch.manual_about ?? null;
  if (patch.manual_top_skills !== undefined) out.manual_top_skills = patch.manual_top_skills ?? null;
  if (patch.manual_current_role !== undefined) out.manual_current_role = patch.manual_current_role ?? null;
  if (patch.manual_years_experience !== undefined) out.manual_years_experience = patch.manual_years_experience ?? null;
  if (patch.manual_education !== undefined) out.manual_education = patch.manual_education ?? null;
  return out;
}

export const careerProfileRouter = router({
  /**
   * Returns the user's canonical career profile (or null if not yet onboarded).
   * Cheap — used by AuthGate to decide whether to redirect to /v2/onboarding.
   */
  get: protectedProcedure.query(async ({ ctx }) => {
    const profile = await getCareerProfile(ctx.supabase, ctx.user.id);
    return { profile };
  }),

  /**
   * Snapshot of the current user's wallets. Used by Settings → Wallet and
   * by the onboarding "complete" screen.
   */
  wallets: protectedProcedure.query(async ({ ctx }) => {
    const snapshot = await getWallets(ctx.supabase, ctx.user.id);
    return snapshot;
  }),

  /**
   * Create the career profile. Called by the Onboarding wizard on
   * completion. Idempotent: if a profile already exists (race condition
   * with a parallel tab), this updates it instead.
   */
  create: protectedProcedure
    .input(CAREER_PROFILE_INPUT)
    .mutation(async ({ ctx, input }) => {
      const normalized = normalizeInput(input);
      const result = await upsertCareerProfile(ctx.supabase, ctx.user.id, normalized);
      if (!result.success) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: result.message ?? 'Failed to create career profile',
        });
      }
      await logActivity(ctx.supabase, ctx.user.id, 'onboarding.completed', null, {
        goal: normalized.goal,
        level: normalized.level,
        has_linkedin: Boolean(normalized.linkedin_url),
      });
      return { profile: result.profile };
    }),

  /**
   * Partial update from Settings → Career Profile.
   */
  update: protectedProcedure
    .input(CAREER_PROFILE_PATCH)
    .mutation(async ({ ctx, input }) => {
      const patch = normalizePatch(input);
      if (Object.keys(patch).length === 0) {
        return { profile: await getCareerProfile(ctx.supabase, ctx.user.id) };
      }
      const result = await updateCareerProfile(ctx.supabase, ctx.user.id, patch);
      if (!result.success) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: result.message ?? 'Failed to update career profile',
        });
      }
      await logActivity(ctx.supabase, ctx.user.id, 'career_profile.updated', null, {
        fields_changed: Object.keys(patch),
      });
      return { profile: result.profile };
    }),

  /**
   * Settings → "Reset profile" — deletes the canonical row. The user will be
   * sent back to onboarding on their next login by AuthGate.
   */
  delete: protectedProcedure.mutation(async ({ ctx }) => {
    const result = await deleteCareerProfile(ctx.supabase, ctx.user.id);
    if (!result.success) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: result.message ?? 'Failed to delete career profile',
      });
    }
    await logActivity(ctx.supabase, ctx.user.id, 'career_profile.deleted');
    return { success: true };
  }),

  /**
   * Section overrides — list / create / delete a temporary "act as if"
   * payload that decays after `expires_in_hours` (default 24).
   */
  listOverrides: protectedProcedure.query(async ({ ctx }) => {
    const overrides = await listActiveSectionOverrides(ctx.supabase, ctx.user.id);
    return { overrides };
  }),

  sectionOverride: protectedProcedure
    .input(
      z.object({
        section: SECTION,
        payload: z.record(z.string(), z.unknown()),
        expires_in_hours: z.number().int().positive().max(168).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await createSectionOverride(
        ctx.supabase,
        ctx.user.id,
        input.section,
        input.payload,
        input.expires_in_hours ?? 24
      );
      if (!result.success) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: result.message ?? 'Failed to create section override',
        });
      }
      return { override: result.override };
    }),

  deleteOverride: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const result = await deleteSectionOverride(ctx.supabase, ctx.user.id, input.id);
      if (!result.success) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: result.message ?? 'Failed to delete section override',
        });
      }
      return { success: true };
    }),

  /**
   * PDPL "Download my data" — returns everything Wassel stores for this user.
   */
  export: protectedProcedure.mutation(async ({ ctx }) => {
    const blob = await exportUserData(ctx.supabase, ctx.user.id);
    await logActivity(ctx.supabase, ctx.user.id, 'career_profile.exported');
    return { data: blob };
  }),

  /**
   * PDPL "Delete everything" — wipes career-copilot-owned tables for this
   * user. Does NOT delete the auth.users row (Supabase Admin API handles
   * that out of band). Does NOT touch tables outside Career Copilot's scope.
   */
  deleteAllData: protectedProcedure
    .input(z.object({ confirm: z.literal(true) }))
    .mutation(async ({ ctx, input }) => {
      void input;
      const result = await deleteUserData(ctx.supabase, ctx.user.id);
      return { success: result.success, errors: result.errors };
    }),
});

export type CareerProfileRouter = typeof careerProfileRouter;
