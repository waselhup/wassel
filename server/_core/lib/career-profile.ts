import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Career Profile helper — wrappers around `career_profile` and
 * `section_overrides` tables. The Career Profile is the backbone:
 * one row per user, written once during onboarding and read by every
 * other screen (R02 — the user is never asked the same question twice).
 *
 * See:
 *   docs/MASTER-BRIEF.md §5
 *   docs/decisions/A02.md
 *   docs/PRD/02-onboarding.md
 */

export type CareerGoal = 'job_search' | 'promotion' | 'personal_brand' | 'opportunities' | 'career_change';
export type CareerLevel = 'entry' | 'mid' | 'senior' | 'executive';
export type Language = 'ar' | 'en';

export type CareerProfile = {
  user_id: string;
  goal: CareerGoal;
  level: CareerLevel;
  target_role: string;
  industry: string;
  primary_language: Language;
  linkedin_url: string | null;
  manual_about: string | null;
  manual_top_skills: string[] | null;
  manual_current_role: string | null;
  manual_years_experience: number | null;
  manual_education: string | null;
  created_at: string;
  updated_at: string;
};

export type CareerProfileInput = Omit<CareerProfile, 'user_id' | 'created_at' | 'updated_at'>;
export type CareerProfilePatch = Partial<CareerProfileInput>;

export type SectionOverrideSection = 'radar' | 'resume' | 'content';

export type SectionOverride = {
  id: string;
  user_id: string;
  section: SectionOverrideSection;
  payload: Record<string, unknown>;
  created_at: string;
  expires_at: string;
};

/* ────────────────────────────────────────────
 * Read
 * ──────────────────────────────────────────── */

export async function getCareerProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<CareerProfile | null> {
  const { data, error } = await supabase
    .from('career_profile')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[career-profile] read error:', error.message);
    return null;
  }
  return (data as CareerProfile | null) ?? null;
}

/**
 * Returns the canonical profile merged with any non-expired overrides for
 * `section`. The override `payload` is shallow-merged over the canonical row.
 * Returns `null` if the user has no canonical profile yet.
 */
export async function getCareerProfileWithOverrides(
  supabase: SupabaseClient,
  userId: string,
  section: SectionOverrideSection
): Promise<(CareerProfile & { _overrideApplied: boolean }) | null> {
  const profile = await getCareerProfile(supabase, userId);
  if (!profile) return null;

  const { data: overrides } = await supabase
    .from('section_overrides')
    .select('*')
    .eq('user_id', userId)
    .eq('section', section)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1);

  const active = (overrides as SectionOverride[] | null | undefined)?.[0];
  if (!active) {
    return { ...profile, _overrideApplied: false };
  }

  return {
    ...profile,
    ...(active.payload as Partial<CareerProfile>),
    user_id: profile.user_id,
    created_at: profile.created_at,
    updated_at: profile.updated_at,
    _overrideApplied: true,
  };
}

/* ────────────────────────────────────────────
 * Write
 * ──────────────────────────────────────────── */

export async function createCareerProfile(
  supabase: SupabaseClient,
  userId: string,
  input: CareerProfileInput
): Promise<{ success: boolean; profile?: CareerProfile; message?: string }> {
  const { data, error } = await supabase
    .from('career_profile')
    .insert({ user_id: userId, ...input })
    .select('*')
    .single();

  if (error) {
    return { success: false, message: error.message };
  }
  return { success: true, profile: data as CareerProfile };
}

export async function upsertCareerProfile(
  supabase: SupabaseClient,
  userId: string,
  input: CareerProfileInput
): Promise<{ success: boolean; profile?: CareerProfile; message?: string }> {
  const { data, error } = await supabase
    .from('career_profile')
    .upsert({ user_id: userId, ...input }, { onConflict: 'user_id' })
    .select('*')
    .single();

  if (error) return { success: false, message: error.message };
  return { success: true, profile: data as CareerProfile };
}

export async function updateCareerProfile(
  supabase: SupabaseClient,
  userId: string,
  patch: CareerProfilePatch
): Promise<{ success: boolean; profile?: CareerProfile; message?: string }> {
  const { data, error } = await supabase
    .from('career_profile')
    .update(patch)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error) return { success: false, message: error.message };
  return { success: true, profile: data as CareerProfile };
}

export async function deleteCareerProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<{ success: boolean; message?: string }> {
  const { error } = await supabase
    .from('career_profile')
    .delete()
    .eq('user_id', userId);

  if (error) return { success: false, message: error.message };
  return { success: true };
}

/* ────────────────────────────────────────────
 * Section overrides
 * ──────────────────────────────────────────── */

export async function createSectionOverride(
  supabase: SupabaseClient,
  userId: string,
  section: SectionOverrideSection,
  payload: Record<string, unknown>,
  expiresInHours = 24
): Promise<{ success: boolean; override?: SectionOverride; message?: string }> {
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);
  const { data, error } = await supabase
    .from('section_overrides')
    .insert({
      user_id: userId,
      section,
      payload,
      expires_at: expiresAt.toISOString(),
    })
    .select('*')
    .single();

  if (error) return { success: false, message: error.message };
  return { success: true, override: data as SectionOverride };
}

export async function listActiveSectionOverrides(
  supabase: SupabaseClient,
  userId: string
): Promise<SectionOverride[]> {
  const { data, error } = await supabase
    .from('section_overrides')
    .select('*')
    .eq('user_id', userId)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[career-profile] overrides read error:', error.message);
    return [];
  }
  return (data as SectionOverride[] | null) ?? [];
}

export async function deleteSectionOverride(
  supabase: SupabaseClient,
  userId: string,
  overrideId: string
): Promise<{ success: boolean; message?: string }> {
  const { error } = await supabase
    .from('section_overrides')
    .delete()
    .eq('id', overrideId)
    .eq('user_id', userId);

  if (error) return { success: false, message: error.message };
  return { success: true };
}

/* ────────────────────────────────────────────
 * PDPL — export and delete-all-data (R15 / A15)
 * ──────────────────────────────────────────── */

/**
 * Returns everything Wassel stores about the user, as one JSON object suitable
 * for download. Best-effort — missing tables return empty arrays rather than
 * failing the whole export (the user's right under PDPL is to receive what
 * we DO have, not to be blocked because one query failed).
 */
export async function exportUserData(
  supabase: SupabaseClient,
  userId: string
): Promise<Record<string, unknown>> {
  const sections: Record<string, unknown> = {
    _generated_at: new Date().toISOString(),
    _user_id: userId,
  };

  const queries: Array<{ key: string; table: string; orderBy?: string }> = [
    { key: 'career_profile',     table: 'career_profile' },
    { key: 'section_overrides',  table: 'section_overrides',  orderBy: 'created_at' },
    { key: 'wallet_bonus',       table: 'wallet_bonus' },
    { key: 'wallet_subscription',table: 'wallet_subscription' },
    { key: 'wallet_topup',       table: 'wallet_topup' },
    { key: 'wallet_transactions',table: 'wallet_transactions',orderBy: 'created_at' },
    { key: 'ai_suggestions',     table: 'ai_suggestions',     orderBy: 'created_at' },
    { key: 'activity_log',       table: 'activity_log',       orderBy: 'created_at' },
    { key: 'linkedin_analyses',  table: 'linkedin_analyses',  orderBy: 'created_at' },
    { key: 'profile_analyses',   table: 'profile_analyses',   orderBy: 'created_at' },
    { key: 'cv_versions',        table: 'cv_versions',        orderBy: 'created_at' },
    { key: 'posts',              table: 'posts',              orderBy: 'created_at' },
    { key: 'knowledge_items',    table: 'knowledge_items',    orderBy: 'created_at' },
  ];

  for (const q of queries) {
    let qry = supabase.from(q.table).select('*').eq('user_id', userId);
    if (q.orderBy) qry = qry.order(q.orderBy, { ascending: true });
    const { data, error } = await qry;
    if (error) {
      sections[q.key] = { _error: error.message };
    } else {
      sections[q.key] = data ?? [];
    }
  }

  // profiles is keyed by id, not user_id
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  sections.profile = profile ?? null;

  return sections;
}

/**
 * PDPL nuclear option — delete career-copilot-owned data for the user.
 * Does NOT delete the auth.users row (Supabase Admin API handles that out of
 * band). Does NOT touch tables outside Career Copilot's scope to avoid
 * stepping on parallel-session data ownership.
 */
export async function deleteUserData(
  supabase: SupabaseClient,
  userId: string
): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];
  const tables = [
    'section_overrides',
    'career_profile',
    'wallet_bonus',
    'wallet_subscription',
    'wallet_topup',
    'wallet_transactions',
    'ai_suggestions',
    'activity_log',
  ];
  for (const t of tables) {
    const { error } = await supabase.from(t).delete().eq('user_id', userId);
    if (error) errors.push(`${t}: ${error.message}`);
  }
  return { success: errors.length === 0, errors };
}

/* ────────────────────────────────────────────
 * Activity log helper (best-effort emit)
 * ──────────────────────────────────────────── */

export async function logActivity(
  supabase: SupabaseClient,
  userId: string,
  action: string,
  target?: string,
  payload?: Record<string, unknown>
): Promise<void> {
  try {
    await supabase.from('activity_log').insert({
      user_id: userId,
      action,
      target: target ?? null,
      payload: payload ?? null,
    });
  } catch (e) {
    // Best-effort — don't fail the caller because of an audit insert
    console.warn('[career-profile] activity_log insert failed (non-fatal):', e);
  }
}
