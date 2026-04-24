// LinkdAPI adapter — primary LinkedIn profile scraper.
//
// Why this exists: Bright Data's default dataset omits skills / certifications /
// languages on many profiles, which capped completeness at ~55% for rich
// profiles and starved the Claude analyzer of signal. LinkdAPI's /profile/full
// endpoint returns a complete structured profile (skills w/ assessment flag,
// certifications with issuer + dates, honors, languages with proficiency, full
// position history) for ~$0.008/call.
//
// Endpoint: GET https://linkdapi.com/api/v1/profile/full?username={slug}
// Headers:
//   X-linkdapi-apikey: <LINKDAPI_API_KEY>
//   User-Agent: <must be non-empty or API returns 503 "DNS cache overflow">
//
// Response envelope: {success, statusCode, message, errors, data}
//   - success=true  → data is the profile object
//   - success=false → data=null, profile doesn't exist / private (treat as NOT_FOUND)
//
// Contract: returns ScrapeOutcome compatible with the linkedin.ts route.
// Throws LinkdApiProfileNotFoundError (code=NOT_FOUND) for missing profiles.
// Throws error with kind='URL_MISMATCH' if returned username !== requested slug.
// All other errors (HTTP 5xx, network) bubble up so the orchestrator can
// fall back to Bright Data.

import {
  extractSlugFromUrl,
  slugsMatch,
  type UnifiedProfile,
  type ScrapeOutcome,
} from '../lib/linkedin-scraper';

const DEFAULT_BASE_URL = 'https://linkdapi.com/api/v1';
const USER_AGENT = 'Mozilla/5.0 (compatible; Wassel/1.0)';
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 800;
const REQUEST_TIMEOUT_MS = 45000;

export class LinkdApiProfileNotFoundError extends Error {
  code: string;
  requestedSlug: string;
  apiMessage?: string;
  constructor(message: string, requestedSlug: string, apiMessage?: string) {
    super(message);
    this.name = 'LinkdApiProfileNotFoundError';
    this.code = 'NOT_FOUND';
    this.requestedSlug = requestedSlug;
    this.apiMessage = apiMessage;
  }
}

// ─── LinkdAPI response types (just what we consume) ────────────────

interface LinkdApiDate {
  year: number;
  month: number;
  day: number;
}

interface LinkdApiPosition {
  companyId?: number;
  companyName?: string;
  companyIndustry?: string;
  title?: string;
  location?: string;
  description?: string;
  employmentType?: string;
  start?: LinkdApiDate;
  end?: LinkdApiDate;
}

interface LinkdApiEducation {
  schoolName?: string;
  fieldOfStudy?: string;
  degree?: string;
  grade?: string;
  description?: string;
  start?: LinkdApiDate;
  end?: LinkdApiDate;
}

interface LinkdApiCertification {
  name?: string;
  authority?: string;
  company?: { name?: string };
  start?: LinkdApiDate;
  end?: LinkdApiDate;
}

interface LinkdApiHonor {
  title?: string;
  issuer?: string;
  issuedOn?: LinkdApiDate;
}

interface LinkdApiProfileData {
  id?: number;
  urn?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  isCreator?: boolean;
  isPremium?: boolean;
  isInfluencer?: boolean;
  isOpenToWork?: boolean;
  isHiring?: boolean;
  followerCount?: number;
  connectionsCount?: number;
  profilePicture?: string;
  backgroundImage?: Array<{ url?: string }>;
  summary?: string;
  headline?: string;
  geo?: { country?: string; city?: string; full?: string; countryCode?: string };
  industry?: { name?: string; urn?: string };
  currentPositions?: Array<{ companyName?: string; company?: { name?: string } }>;
  languages?: Array<{ name?: string; proficiency?: string }>;
  educations?: LinkdApiEducation[];
  position?: LinkdApiPosition[];
  fullPositions?: LinkdApiPosition[];
  skills?: Array<{ name?: string; passedSkillAssessment?: boolean }>;
  certifications?: LinkdApiCertification[];
  honorsAndAwards?: LinkdApiHonor[];
}

interface LinkdApiEnvelope {
  success?: boolean;
  statusCode?: number;
  message?: string;
  errors?: unknown;
  data?: LinkdApiProfileData | null;
}

// ─── Config ────────────────────────────────────────────────────────

function getConfig(): { apiKey: string; baseUrl: string } {
  const apiKey = process.env.LINKDAPI_API_KEY || '';
  const baseUrl = (process.env.LINKDAPI_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
  if (!apiKey) throw new Error('LINKDAPI_API_KEY missing');
  return { apiKey, baseUrl };
}

// ─── Date helpers ──────────────────────────────────────────────────

const MONTH_NAMES = [
  '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function fmtDate(d?: LinkdApiDate): string {
  if (!d || !d.year) return '';
  const month = d.month && d.month >= 1 && d.month <= 12 ? `${MONTH_NAMES[d.month]} ` : '';
  return `${month}${d.year}`;
}

function fmtDatePeriod(start?: LinkdApiDate, end?: LinkdApiDate): string {
  const s = fmtDate(start);
  const e = fmtDate(end);
  if (!s && !e) return '';
  if (s && !e) return `${s} - Present`;
  if (!s && e) return e;
  return `${s} - ${e}`;
}

function fmtYear(d?: LinkdApiDate): string {
  if (!d || !d.year) return '';
  return String(d.year);
}

function fmtYearRange(start?: LinkdApiDate, end?: LinkdApiDate): string {
  const s = fmtYear(start);
  const e = fmtYear(end);
  if (!s && !e) return '';
  if (s && !e) return s;
  if (!s && e) return e;
  return `${s} - ${e}`;
}

// ─── Fetch with retry ──────────────────────────────────────────────

async function fetchProfileWithRetry(username: string): Promise<LinkdApiEnvelope> {
  const { apiKey, baseUrl } = getConfig();
  const url = `${baseUrl}/profile/full?username=${encodeURIComponent(username)}`;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const t0 = Date.now();
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), REQUEST_TIMEOUT_MS);
      console.log('[LINKDAPI] request', { username, attempt, url: `${baseUrl}/profile/full` });

      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'X-linkdapi-apikey': apiKey,
          'User-Agent': USER_AGENT,
          'Accept': 'application/json',
        },
        signal: ctl.signal,
      }).finally(() => clearTimeout(timer));

      const durMs = Date.now() - t0;

      // 503 is LinkdAPI's "DNS cache overflow" — transient. Retry with backoff.
      if (res.status === 503) {
        const body = await res.text().catch(() => '');
        console.warn('[LINKDAPI] 503 transient', { username, attempt, durMs, body: body.slice(0, 200) });
        lastError = new Error(`LinkdAPI 503 (attempt ${attempt}): ${body.slice(0, 200)}`);
        if (attempt < MAX_RETRIES) {
          const delay = RETRY_BASE_MS * Math.pow(2, attempt - 1);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        throw lastError;
      }

      // 429 rate limit — do NOT retry (each retry burns quota). Fail fast so
      // the orchestrator can either fall back to BD or surface to the user.
      if (res.status === 429) {
        const body = await res.text().catch(() => '');
        console.error('[LINKDAPI] 429 rate limit — not retrying', { username, attempt, durMs, body: body.slice(0, 200) });
        throw new Error(`LinkdAPI 429 rate-limited: ${body.slice(0, 200)}`);
      }

      // Other non-2xx → hard fail (bubble to orchestrator for BD fallback).
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        console.error('[LINKDAPI] http error', { username, attempt, status: res.status, durMs, body: body.slice(0, 200) });
        throw new Error(`LinkdAPI HTTP ${res.status}: ${body.slice(0, 200)}`);
      }

      const envelope = (await res.json()) as LinkdApiEnvelope;
      console.log('[LINKDAPI] response', {
        username,
        attempt,
        durMs,
        success: envelope.success,
        hasData: !!envelope.data,
      });
      return envelope;
    } catch (err: any) {
      const isAbort = err?.name === 'AbortError';
      console.warn('[LINKDAPI] request failed', {
        username, attempt, message: err?.message, isAbort,
      });
      lastError = err;
      if (attempt < MAX_RETRIES) {
        const delay = RETRY_BASE_MS * Math.pow(2, attempt - 1);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error('LinkdAPI fetch failed');
}

// ─── Normalizer: LinkdAPI.data → UnifiedProfile ────────────────────

function normalize(d: LinkdApiProfileData): UnifiedProfile {
  const fullName = [d.firstName, d.lastName].filter(Boolean).join(' ').trim();
  const slug = (d.username || '').toLowerCase();

  // Prefer fullPositions (complete history) over position (trimmed).
  const positionsSrc = Array.isArray(d.fullPositions) && d.fullPositions.length
    ? d.fullPositions
    : Array.isArray(d.position) ? d.position : [];

  const experience = positionsSrc.map((p) => ({
    title: p.title || '',
    company: p.companyName || '',
    duration: fmtDatePeriod(p.start, p.end),
    location: p.location || '',
    description: p.description || '',
  }));

  const education = (d.educations || []).map((e) => ({
    school: e.schoolName || '',
    degree: e.degree || '',
    field: e.fieldOfStudy || '',
    year: fmtYearRange(e.start, e.end),
  }));

  const skills = (d.skills || [])
    .map((s) => s?.name || '')
    .filter((s) => !!s);

  const certifications = (d.certifications || []).map((c) => ({
    name: c.name || '',
    issuer: c.authority || c.company?.name || '',
  }));

  const languages = (d.languages || []).map((l) => ({
    name: l.name || '',
    proficiency: l.proficiency || '',
  }));

  const honorsAndAwards = (d.honorsAndAwards || []).map((h) => ({
    title: h.title || '',
    issuer: h.issuer || '',
    issuedOn: fmtDate(h.issuedOn),
  }));

  // Headline fallback: raw headline is almost always present, but if not,
  // compose from currentPositions.
  let headline = d.headline || '';
  if (!headline && d.currentPositions && d.currentPositions.length) {
    const cp = d.currentPositions[0];
    const company = cp.company?.name || cp.companyName || '';
    if (company) headline = `at ${company}`;
  }

  const location = d.geo?.full || [d.geo?.city, d.geo?.country].filter(Boolean).join(', ');
  const bannerUrl = d.backgroundImage && d.backgroundImage[0]?.url ? d.backgroundImage[0].url : '';

  const profile: UnifiedProfile = {
    slug,
    fullName: fullName || d.username || '',
    firstName: d.firstName || (fullName.split(' ')[0] || ''),
    headline,
    summary: d.summary || '',
    location,
    profilePicture: d.profilePicture || '',
    bannerImage: bannerUrl,
    // LinkedIn custom URLs don't contain the auto-generated "-<hash>" tail.
    customUrl: !!slug && !/^\w{5,}-\w{5,}-/.test(slug),
    openToWork: !!d.isOpenToWork,
    linkedinUrl: slug ? `https://www.linkedin.com/in/${slug}/` : '',
    experience,
    education,
    skills,
    certifications,
    recommendations: [],
    languages,
    activity: [],
    honorsAndAwards,
    industry: d.industry?.name ? { name: d.industry.name } : undefined,
    flags: {
      isOpenToWork: !!d.isOpenToWork,
      isPremium: !!d.isPremium,
      isCreator: !!d.isCreator,
      isInfluencer: !!d.isInfluencer,
      isHiring: !!d.isHiring,
    },
    raw: d,
  };

  return profile;
}

// ─── Completeness scorer ───────────────────────────────────────────
// Tuned for LinkdAPI's rich data. A profile with:
//   summary >200 + headline + 3 experiences + 1 education + 5+ skills
//   + 1 cert + 2 languages + banner + (not auto-gen slug)
// should score 90-100. Sparse profiles still fail the existing <25 gate
// in linkedin.ts.
export function computeCompletenessLinkdAPI(p: UnifiedProfile): number {
  let score = 0;
  // Identity (always present for a resolved profile)
  if (p.fullName) score += 5;
  // Headline — rich when present, LinkdAPI almost always returns this
  if (p.headline && p.headline.length > 5) score += 15;
  // Summary — accept from 50 chars, bonus over 200
  if (p.summary && p.summary.length > 50) score += 15;
  if (p.summary && p.summary.length > 200) score += 5;
  // Experience — big signal
  if (p.experience.length >= 1) score += 10;
  if (p.experience.length >= 3) score += 5;
  if (p.experience[0]?.description && p.experience[0].description.length > 30) score += 5;
  // Education
  if (p.education.length >= 1) score += 10;
  // Skills — bonus, LinkdAPI returns this reliably
  if (p.skills.length >= 3) score += 5;
  if (p.skills.length >= 10) score += 5;
  // Certifications
  if (p.certifications && p.certifications.length >= 1) score += 5;
  // Languages
  if (p.languages && p.languages.length >= 1) score += 5;
  // Honors
  if (p.honorsAndAwards && p.honorsAndAwards.length >= 1) score += 3;
  // Profile polish
  if (p.profilePicture) score += 4;
  if (p.bannerImage) score += 2;
  if (p.customUrl) score += 2;
  return Math.min(score, 100);
}

export function getMissingSectionsLinkdAPI(p: UnifiedProfile): string[] {
  const missing: string[] = [];
  if (!p.headline || p.headline.length < 5) missing.push('headline');
  if (!p.summary || p.summary.length < 50) missing.push('summary');
  if (p.experience.length === 0) missing.push('experience');
  if (p.education.length === 0) missing.push('education');
  if (p.skills.length < 3) missing.push('skills');
  if (!p.certifications || p.certifications.length === 0) missing.push('certifications');
  return missing;
}

// ─── Public entrypoint ─────────────────────────────────────────────

export async function scrapeLinkedInProfileLinkdAPI(url: string): Promise<ScrapeOutcome> {
  const requestedSlug = extractSlugFromUrl(url);
  const attempts: string[] = [];

  if (!requestedSlug) {
    throw new Error(`LinkdAPI: cannot extract slug from URL: ${url}`);
  }

  console.log('[LINKDAPI] start', { requestedSlug });

  const envelope = await fetchProfileWithRetry(requestedSlug);
  attempts.push(`linkdapi: success=${envelope.success} hasData=${!!envelope.data}`);

  // NOT_FOUND: LinkdAPI returns HTTP 200 with success:false for missing/private.
  if (envelope.success === false || !envelope.data) {
    const apiMsg = envelope.message || 'Profile not found';
    console.warn('[LINKDAPI] profile not found', { requestedSlug, apiMsg });
    throw new LinkdApiProfileNotFoundError(
      `Profile not found or private: ${apiMsg}`,
      requestedSlug,
      apiMsg,
    );
  }

  const data = envelope.data;

  // Slug verification — LinkdAPI echoes the username in data.username.
  // If they don't match, something is seriously wrong; fail hard.
  const returnedSlug = (data.username || '').toLowerCase();
  if (!slugsMatch(requestedSlug, returnedSlug)) {
    attempts.push(`linkdapi: SLUG_MISMATCH requested=${requestedSlug} returned=${returnedSlug}`);
    console.error('[LINKDAPI] slug mismatch — rejecting', { requestedSlug, returnedSlug });
    const err: any = new Error(`Identity mismatch — LinkdAPI returned a different profile`);
    err.kind = 'URL_MISMATCH';
    err.requestedSlug = requestedSlug;
    err.returnedSlug = returnedSlug;
    err.attempts = attempts;
    throw err;
  }

  const profile = normalize(data);
  const completeness = computeCompletenessLinkdAPI(profile);
  const missingSections = getMissingSectionsLinkdAPI(profile);
  attempts.push(`linkdapi: ${completeness}% skills=${profile.skills.length} certs=${profile.certifications.length} langs=${profile.languages.length}`);

  console.log('[LINKDAPI] success', {
    slug: returnedSlug,
    fullName: profile.fullName,
    headline: profile.headline.slice(0, 80),
    summaryLen: profile.summary.length,
    experienceCount: profile.experience.length,
    educationCount: profile.education.length,
    skillsCount: profile.skills.length,
    certCount: profile.certifications.length,
    langCount: profile.languages.length,
    honorCount: profile.honorsAndAwards?.length || 0,
    completeness,
    missing: missingSections,
  });

  return {
    profile,
    completeness,
    source: 'linkdapi',
    missingSections,
    attempts,
    requestedSlug,
    returnedSlug,
    identityMatch: true,
  };
}
