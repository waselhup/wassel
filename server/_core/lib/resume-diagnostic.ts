import type { SupabaseClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { getCareerProfileWithOverrides } from './career-profile';
import { scrapeLinkedInProfileHybrid } from '../services/profile-scraper';
import {
  computeAtsScore,
  computeTargetProfileBenchmark,
  ResumeError,
  type Resume,
  type AtsScoreResult,
  type TargetProfileBenchmark,
} from './resume-engine';

/**
 * Resume v2 — FREE ATS diagnostic (M3 "Outputs").
 *
 * The diagnostic mirrors the Radar free-diagnostic pattern: the user gets a
 * full 4-component ATS read (keywords / sections / format / quantified) plus a
 * "current → expected" projection and an internal target-profile benchmark, at
 * ZERO tokens. The paid 179-token tailored build remains the locked output —
 * the diagnostic SELLS the points, it does not hand over a resume.
 *
 * #26 (algorithm owns the numbers): every number here is deterministic. There
 * is NO Claude call on this path — neither for LinkedIn nor for an uploaded
 * CV. We map the available signal into a minimal `Resume` shape and run the
 * SAME computeAtsScore the paid build uses, so the free "current" score and
 * the post-build score are measured on one ruler.
 *
 * Two entry paths:
 *   A) upload a CV  → the client parses text (document.parse) and posts it;
 *      we structure it deterministically into a Resume and score it.
 *   B) no CV        → we score the user's LinkedIn profile AS-IF it were a
 *      resume, so the user sees where their profile-as-resume stands today.
 *
 * Cache protection (free lifetime, like radar): the diagnostic is keyed by
 * (user, target_role, source_hash) in resume_diagnostics. A repeat of the same
 * source returns the cached row — no recompute, no surprise. It is always 0
 * tokens, so there is nothing to refund and no abuse surface (no model spend).
 */

export type DiagnosticSource = 'linkedin' | 'upload';

export type DiagnosticResult = {
  /** Which entry path produced this. */
  source: DiagnosticSource;
  /** Current ATS total + the 4-component breakdown (same shape as the build). */
  atsScore: number;
  atsBreakdown: AtsScoreResult['breakdown'];
  /** Projected ATS once the visible headroom is recovered (capped 95, R10). */
  expectedScore: number;
  /** Internal target-profile benchmark (you vs ideal-for-role, deterministic). */
  benchmark: TargetProfileBenchmark;
  targetRole: string;
  language: 'ar' | 'en';
  /** Stable id of the persisted diagnostic row (for the unlock CTA / dedup). */
  diagnosticId: string;
  /** True when this is a re-served cached diagnostic (0 work, 0 tokens). */
  isCacheHit: boolean;
};

/** Minimal CV upload payload — already text-extracted client-side (0 AI). */
export type UploadedCvInput = {
  /** Plain text extracted from the uploaded PDF/DOCX via document.parse. */
  text: string;
  /** Optional filename, for display only. */
  filename?: string;
};

/** Expected ATS once the visible per-component headroom is recovered (cap 95). */
function expectedFromBreakdown(total: number, breakdown: AtsScoreResult['breakdown']): number {
  const headroom =
    Math.max(0, 40 - breakdown.keywords) +
    Math.max(0, 25 - breakdown.sections) +
    Math.max(0, 20 - breakdown.format) +
    Math.max(0, 15 - breakdown.quantified);
  return Math.min(95, total + headroom);
}

// ─────────────────────────────────────────────
// Path B — map a scraped LinkedIn profile into a Resume shape for scoring.
// We intentionally keep dates loose; the ATS format check will (correctly)
// flag non-ISO dates as a real gap the paid build fixes — that honesty is the
// point ("your LinkedIn-as-resume scores X; the tailored build lifts it").
// ─────────────────────────────────────────────

function linkedinToResume(
  profile: Record<string, unknown>,
  targetRole: string,
  language: 'ar' | 'en',
): Resume {
  const str = (v: unknown): string => (typeof v === 'string' ? v : '');
  const arr = <T = unknown>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

  const experience = arr<Record<string, unknown>>(profile.experience).map((e) => ({
    role: str(e.title),
    company: str(e.company),
    location: str(e.location) || null,
    start: str(e.duration), // raw duration string — not ISO, scored honestly
    end: '',
    // LinkedIn descriptions are paragraphs; split into pseudo-bullets so the
    // quantified-achievements check has something to measure.
    bullets: str(e.description)
      ? str(e.description)
          .split(/\n+|(?<=[.!؟])\s+/)
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
          .slice(0, 6)
      : [],
  }));

  const education = arr<Record<string, unknown>>(profile.education).map((ed) => ({
    degree: str(ed.degree) || str(ed.field),
    institution: str(ed.school),
    graduated: str(ed.year),
    honors: null,
  }));

  const skills = arr<unknown>(profile.skills)
    .map((s) => (typeof s === 'string' ? s : str((s as Record<string, unknown>)?.name)))
    .filter((s) => s.length > 0);

  const certifications = arr<Record<string, unknown>>(profile.certifications).map((c) => ({
    name: str(c.name),
    issuer: str(c.issuer),
    year: '',
  }));

  const languages = arr<Record<string, unknown>>(profile.languages).map((l) => ({
    name: str(l.name),
    proficiency: str(l.proficiency),
  }));

  return {
    header: {
      name: str(profile.fullName),
      title: str(profile.headline) || targetRole,
      location: str(profile.location) || null,
      phone: null,
      email: null,
      linkedin_url: str(profile.linkedinUrl) || null,
    },
    summary: str(profile.about ?? profile.summary),
    experience,
    education,
    skills: { hard: skills, soft: [] },
    certifications,
    languages,
    meta: {
      target_role: targetRole,
      template_id: 'diagnostic',
      profile_hash: '',
      language,
      version_label: 'diagnostic',
      generated_at: new Date().toISOString(),
    },
  };
}

// ─────────────────────────────────────────────
// Path A — structure uploaded CV text into a Resume shape, deterministically.
// No Claude. We use light heuristics good enough for the 4-component score:
//   - the whole text feeds the keyword match (flattenResumeText reads bullets,
//     skills, summary, titles), so keyword coverage is honest even with rough
//     sectioning;
//   - presence of section headers drives the sections sub-score;
//   - lines that look like bullets feed the quantified check.
// The structuring only needs to be good enough to MEASURE; the paid build is
// where real structure is produced.
// ─────────────────────────────────────────────

const SECTION_HEADERS = {
  summary: /\b(summary|profile|objective|about)\b|الملخص|نبذة|الهدف/i,
  experience: /\b(experience|employment|work history|career)\b|الخبر|الخبرات|العمل/i,
  education: /\b(education|academic|qualifications)\b|التعليم|المؤهلات|الدراس/i,
  skills: /\b(skills|competencies|expertise|technologies)\b|المهارات|الكفاءات/i,
} as const;

function uploadedTextToResume(text: string, targetRole: string, language: 'ar' | 'en'): Resume {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const nonEmpty = lines.filter((l) => l.length > 0);

  const has = (re: RegExp) => nonEmpty.some((l) => re.test(l));
  const hasSummary = has(SECTION_HEADERS.summary);
  const hasExperience = has(SECTION_HEADERS.experience);
  const hasEducation = has(SECTION_HEADERS.education);
  const hasSkills = has(SECTION_HEADERS.skills);

  // Bullet-like lines: start with a bullet glyph, dash, or are mid-length
  // sentences. These feed the quantified-achievements ratio.
  const bulletLines = nonEmpty.filter(
    (l) => /^[•\-–*▪◦·]/.test(l) || (l.length >= 30 && l.length <= 240 && /\s/.test(l)),
  );

  // A rough summary block: the first paragraph after a summary header, else the
  // first long line. Capped so the format check (long_summary > 480) is fair.
  let summary = '';
  const summaryIdx = nonEmpty.findIndex((l) => SECTION_HEADERS.summary.test(l));
  if (summaryIdx >= 0 && nonEmpty[summaryIdx + 1]) {
    summary = nonEmpty[summaryIdx + 1].slice(0, 480);
  } else {
    summary = (nonEmpty.find((l) => l.length >= 60) ?? '').slice(0, 480);
  }

  // Skills: gather comma/•-separated tokens from a skills section if present.
  let skills: string[] = [];
  const skillsIdx = nonEmpty.findIndex((l) => SECTION_HEADERS.skills.test(l));
  if (skillsIdx >= 0) {
    const block = nonEmpty.slice(skillsIdx + 1, skillsIdx + 5).join(', ');
    skills = block
      .split(/[,،•|/]+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 2 && s.length <= 40)
      .slice(0, 20);
  }

  // One synthetic experience entry carrying the bullet lines, so the quantified
  // ratio is measured against the document's achievement-like content.
  const experience = hasExperience
    ? [
        {
          role: targetRole,
          company: '',
          location: null,
          start: '',
          end: '',
          bullets: bulletLines.slice(0, 12),
        },
      ]
    : [];

  return {
    header: {
      name: '',
      title: targetRole,
      location: null,
      phone: null,
      email: null,
      linkedin_url: null,
    },
    summary: hasSummary || summary ? summary : '',
    experience,
    education: hasEducation ? [{ degree: '', institution: '', graduated: '', honors: null }] : [],
    skills: { hard: hasSkills ? (skills.length ? skills : ['—']) : skills, soft: [] },
    certifications: [],
    languages: [],
    meta: {
      target_role: targetRole,
      template_id: 'diagnostic',
      profile_hash: '',
      language,
      version_label: 'diagnostic',
      generated_at: new Date().toISOString(),
    },
  };
}

function sha16(s: string): string {
  return createHash('sha256').update(s).digest('hex').slice(0, 16);
}

// ─────────────────────────────────────────────
// Persist + dedup. resume_diagnostics is a tiny free-lifetime cache keyed by
// (user, target_role, source, source_hash). 0 tokens always — no refund path.
// ─────────────────────────────────────────────

async function persistDiagnostic(
  supabase: SupabaseClient,
  opts: {
    userId: string;
    source: DiagnosticSource;
    sourceHash: string;
    targetRole: string;
    language: 'ar' | 'en';
    ats: AtsScoreResult;
    expectedScore: number;
    benchmark: TargetProfileBenchmark;
  },
): Promise<{ id: string; isCacheHit: boolean }> {
  // Dedup: same source for the same role → return the existing row.
  const { data: existing } = await supabase
    .from('resume_diagnostics')
    .select('id')
    .eq('user_id', opts.userId)
    .eq('target_role', opts.targetRole)
    .eq('source', opts.source)
    .eq('source_hash', opts.sourceHash)
    .maybeSingle();

  if (existing?.id) {
    await supabase
      .from('resume_diagnostics')
      .update({ last_accessed_at: new Date().toISOString() })
      .eq('id', existing.id);
    return { id: existing.id as string, isCacheHit: true };
  }

  const { data: row, error } = await supabase
    .from('resume_diagnostics')
    .insert({
      user_id: opts.userId,
      source: opts.source,
      source_hash: opts.sourceHash,
      target_role: opts.targetRole,
      language: opts.language,
      ats_score: opts.ats.total,
      expected_score: opts.expectedScore,
      ats_breakdown: opts.ats.breakdown,
      benchmark: opts.benchmark,
      tokens_charged: 0,
    })
    .select('id')
    .single();

  // Persistence is best-effort: the diagnostic is free and recomputable, so a
  // write failure must not deny the user their result. Fall back to a synthetic
  // id derived from the source hash.
  if (error || !row) {
    return { id: `ephemeral_${opts.sourceHash}`, isCacheHit: false };
  }
  return { id: row.id as string, isCacheHit: false };
}

// ─────────────────────────────────────────────
// Public: run the free diagnostic.
// ─────────────────────────────────────────────

export async function runDiagnostic(
  supabase: SupabaseClient,
  opts: {
    userId: string;
    language?: 'ar' | 'en';
    overrideTargetRole?: string;
    /** When present, path A (uploaded CV). When absent, path B (LinkedIn). */
    upload?: UploadedCvInput;
  },
): Promise<DiagnosticResult> {
  const language: 'ar' | 'en' = opts.language ?? 'ar';
  const profile = await getCareerProfileWithOverrides(supabase, opts.userId, 'resume');
  if (!profile) throw new ResumeError('NO_CAREER_PROFILE', 'Career profile missing.');
  const targetRole = opts.overrideTargetRole?.trim() || profile.target_role;
  const industry = profile.industry ?? '';
  const level = profile.level ?? 'mid';

  let resume: Resume;
  let source: DiagnosticSource;
  let sourceHash: string;

  if (opts.upload) {
    // ── Path A: uploaded CV (text already extracted client-side). ──
    source = 'upload';
    const text = (opts.upload.text ?? '').slice(0, 60000);
    if (text.trim().length < 40) {
      throw new ResumeError('INTERNAL', 'Uploaded CV text is too short to diagnose.');
    }
    resume = uploadedTextToResume(text, targetRole, language);
    sourceHash = sha16(`upload:${targetRole}:${text}`);
  } else {
    // ── Path B: score the user's LinkedIn profile as-if a resume. ──
    source = 'linkedin';
    if (!profile.linkedin_url) {
      throw new ResumeError('NO_LINKEDIN_URL', 'LinkedIn URL missing in career profile.');
    }
    let unifiedProfile: Record<string, unknown>;
    try {
      const outcome = await scrapeLinkedInProfileHybrid(profile.linkedin_url);
      unifiedProfile = (outcome.profile ?? {}) as Record<string, unknown>;
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      if (e?.code === 'NOT_FOUND' || e?.code === 'URL_MISMATCH') {
        throw new ResumeError(
          'LINKEDIN_NOT_FOUND',
          language === 'ar' ? 'تعذّر الوصول إلى بروفايل لينكد إن' : 'LinkedIn profile unreachable.',
          { reason: e.code },
        );
      }
      throw new ResumeError('INTERNAL', `LinkedIn scrape failed: ${e?.message ?? 'unknown'}`);
    }
    resume = linkedinToResume(unifiedProfile, targetRole, language);
    sourceHash = sha16(`linkedin:${targetRole}:${JSON.stringify({
      headline: unifiedProfile.headline ?? null,
      about: unifiedProfile.about ?? unifiedProfile.summary ?? null,
      experience: Array.isArray(unifiedProfile.experience)
        ? (unifiedProfile.experience as Array<Record<string, unknown>>).map((e) => ({
            title: e.title ?? null,
            company: e.company ?? null,
          }))
        : [],
      skills: Array.isArray(unifiedProfile.skills) ? unifiedProfile.skills : [],
    })}`);
  }

  // #26: deterministic score on the SAME ruler the paid build uses.
  const ats = computeAtsScore(resume, targetRole, industry);
  const expectedScore = expectedFromBreakdown(ats.total, ats.breakdown);
  const benchmark = computeTargetProfileBenchmark(ats.breakdown, ats.total, level);

  const { id, isCacheHit } = await persistDiagnostic(supabase, {
    userId: opts.userId,
    source,
    sourceHash,
    targetRole,
    language,
    ats,
    expectedScore,
    benchmark,
  });

  return {
    source,
    atsScore: ats.total,
    atsBreakdown: ats.breakdown,
    expectedScore,
    benchmark,
    targetRole,
    language,
    diagnosticId: id,
    isCacheHit,
  };
}
