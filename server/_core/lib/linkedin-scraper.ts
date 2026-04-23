// Multi-actor LinkedIn scraper with shape-specific normalizers + Layer-2
// slug verification to catch silent wrong-profile returns.
//
// IMPORTANT — root-cause note (2026-04-24):
//   The actor `apimaestro~linkedin-profile-detail` was confirmed to be
//   broken: it always returned the SAME profile (Sarp Tecimer,
//   public_identifier=sarptecimer) regardless of the input URL — including
//   for fake/non-existent URLs. Users were being charged for analyses of a
//   complete stranger. It has been removed from the ACTORS list. Any caller
//   must still verify returned slug === requested slug (see
//   extractSlugFromUrl + extractSlugFromProfile below) before trusting the
//   data or deducting tokens.
//
// Actor shapes (confirmed by live testing):
//   dev_fusion:  flat: { fullName, headline, about, experiences[], skills[{title}],
//                        educations[{title, subtitle, description, period}], licenseAndCertificates[],
//                        languages[{name, proficiency}], addressWithCountry, publicIdentifier, linkedinUrl }
//   harvestapi:  flat-ish: { fullName, headline, about, experience[], skills[],
//                            education[], publicIdentifier, linkedinUrl }

const APIFY_TOKEN = process.env.APIFY_TOKEN || process.env.APIFY_API_TOKEN || '';

export interface UnifiedProfile {
  slug: string;                  // Profile's own vanity/URL slug (for identity verification)
  fullName: string;
  firstName: string;
  headline: string;
  summary: string;
  location: string;
  profilePicture: string;
  bannerImage: string;
  customUrl: boolean;
  openToWork: boolean;
  linkedinUrl: string;           // Canonical URL from the profile itself
  experience: Array<{
    title: string;
    company: string;
    duration?: string;
    location?: string;
    description?: string;
  }>;
  education: Array<{
    school: string;
    degree?: string;
    field?: string;
    year?: string;
  }>;
  skills: string[];
  certifications: Array<{ name: string; issuer?: string }>;
  recommendations: Array<{ from: string; text: string }>;
  languages: Array<{ name: string; proficiency?: string }>;
  activity: Array<{ title: string; date?: string }>;
  raw: any;                      // Keep full original for debugging
}

// ─── Slug helpers (used by linkedin route for identity verification) ──

export function extractSlugFromUrl(url: string): string {
  if (!url || typeof url !== 'string') return '';
  const match = url.match(/linkedin\.com\/in\/([^/?#]+)/i);
  if (!match) return '';
  return match[1].toLowerCase().replace(/\/+$/, '').replace(/^-|-$/g, '');
}

export function extractSlugFromProfile(p: UnifiedProfile): string {
  // Direct slug field is best — set by the normalizer from the actor's own fields.
  if (p.slug) return p.slug.toLowerCase().replace(/^-|-$/g, '');
  // Fall through to any URL-like field on the raw payload
  const raw = p.raw || {};
  const candidates = [
    raw.publicIdentifier,
    raw.public_identifier,
    raw.vanityName,
    raw.vanity,
    raw.linkedinUrl,
    raw.profileUrl,
    raw.profile_url,
    raw.url,
    raw.basic_info?.public_identifier,
    raw.basic_info?.profile_url,
  ].filter((x) => typeof x === 'string' && x.length > 0) as string[];
  for (const u of candidates) {
    const m = u.match(/\/in\/([^/?#]+)/i);
    if (m) return m[1].toLowerCase().replace(/^-|-$/g, '');
    if (!u.includes('/') && u.length < 100) return u.toLowerCase().replace(/^-|-$/g, '');
  }
  return '';
}

export function slugsMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  return norm(a) === norm(b);
}

// ─── Shape-specific normalizers ────────────────────────────────────

function normalizeDevFusion(raw: any): UnifiedProfile {
  const fullName = raw.fullName || `${raw.firstName || ''} ${raw.lastName || ''}`.trim();
  const exp = Array.isArray(raw.experiences) ? raw.experiences : [];
  const edu = Array.isArray(raw.educations) ? raw.educations : [];
  const skillsArr = Array.isArray(raw.skills) ? raw.skills : [];
  const certs = Array.isArray(raw.licenseAndCertificates) ? raw.licenseAndCertificates : [];
  const langs = Array.isArray(raw.languages) ? raw.languages : [];

  const linkedinUrl = raw.linkedinUrl || raw.publicProfileUrl || raw.profileUrl || '';
  const slugFromUrl = linkedinUrl ? extractSlugFromUrl(linkedinUrl) : '';
  const slug = (raw.publicIdentifier || raw.vanityName || slugFromUrl || '').toString().toLowerCase();

  return {
    slug,
    fullName,
    firstName: raw.firstName || fullName.split(' ')[0] || '',
    headline: raw.headline || raw.jobTitle || '',
    summary: raw.about || raw.summary || '',
    location: raw.addressWithCountry || raw.addressCountryFull || raw.jobLocation || '',
    profilePicture: raw.profilePic || raw.profilePicture || raw.profilePicHighQuality || '',
    bannerImage: raw.backgroundImage || raw.bannerImage || '',
    customUrl: !!raw.publicIdentifier && !/^\w{5,}-\w{5,}/.test(raw.publicIdentifier),
    openToWork: !!(raw.openToWork || raw.isOpenToWork),
    linkedinUrl,
    experience: exp.map((e: any) => ({
      title: e.title || e.jobTitle || '',
      company: e.companyName || e.company || '',
      duration: e.duration || `${e.jobStartedOn?.year || ''} - ${e.jobStillWorking ? 'Present' : (e.jobEndedOn?.year || '')}`.trim(),
      location: e.jobLocation || e.location || '',
      description: e.jobDescription || e.description || '',
    })),
    education: edu.map((e: any) => ({
      school: e.title || e.schoolName || e.school || '',
      degree: e.subtitle || e.degree || '',
      field: e.field || e.fieldOfStudy || '',
      year: e.period || e.year || e.endDate || '',
    })),
    skills: skillsArr.map((s: any) => (typeof s === 'string' ? s : s.title || s.name || s.skill || '')).filter(Boolean),
    certifications: certs.map((c: any) => ({ name: c.name || c.title || '', issuer: c.authority || c.issuer || c.organization || '' })),
    recommendations: (raw.recommendations || []).map((r: any) => ({ from: r.from || r.author || '', text: r.text || r.content || '' })),
    languages: langs.map((l: any) => ({ name: l.name || l.language || '', proficiency: l.proficiency || l.level || '' })),
    activity: (raw.posts || raw.activity || raw.recentActivity || []).slice(0, 10).map((a: any) => ({ title: a.title || a.text || a.content || '', date: a.date || '' })),
    raw,
  };
}

function normalizeHarvest(raw: any): UnifiedProfile {
  const fullName = raw.fullName || raw.name || `${raw.firstName || ''} ${raw.lastName || ''}`.trim();
  const exp = Array.isArray(raw.experience) ? raw.experience : Array.isArray(raw.experiences) ? raw.experiences : [];
  const edu = Array.isArray(raw.education) ? raw.education : Array.isArray(raw.educations) ? raw.educations : [];
  const skillsArr = Array.isArray(raw.skills) ? raw.skills : [];
  const certs = Array.isArray(raw.certifications) ? raw.certifications : Array.isArray(raw.licenseAndCertificates) ? raw.licenseAndCertificates : [];
  const langs = Array.isArray(raw.languages) ? raw.languages : [];

  const linkedinUrl = raw.linkedinUrl || raw.profileUrl || raw.url || '';
  const slugFromUrl = linkedinUrl ? extractSlugFromUrl(linkedinUrl) : '';
  const slug = (raw.publicIdentifier || raw.vanityName || slugFromUrl || '').toString().toLowerCase();

  return {
    slug,
    fullName,
    firstName: raw.firstName || fullName.split(' ')[0] || '',
    headline: raw.headline || '',
    summary: raw.about || raw.summary || '',
    location: raw.location || raw.addressWithCountry || '',
    profilePicture: raw.profilePicture || raw.profilePic || raw.photo || '',
    bannerImage: raw.backgroundImage || raw.bannerImage || '',
    customUrl: !!raw.publicIdentifier && !/^\w{5,}-\w{5,}/.test(raw.publicIdentifier),
    openToWork: !!raw.openToWork,
    linkedinUrl,
    experience: exp.map((e: any) => ({
      title: e.title || e.position || e.jobTitle || '',
      company: e.company || e.companyName || '',
      duration: e.duration || e.date_range || `${e.startDate || ''} - ${e.endDate || ''}`,
      location: e.location || '',
      description: e.description || e.jobDescription || '',
    })),
    education: edu.map((e: any) => ({
      school: e.school || e.schoolName || e.title || '',
      degree: e.degree || e.subtitle || '',
      field: e.field || e.fieldOfStudy || '',
      year: e.period || e.year || e.endDate || '',
    })),
    skills: skillsArr.map((s: any) => (typeof s === 'string' ? s : s.name || s.title || '')).filter(Boolean),
    certifications: certs.map((c: any) => ({ name: c.name || '', issuer: c.issuer || c.authority || '' })),
    recommendations: (raw.recommendations || []).map((r: any) => ({ from: r.from || r.author || '', text: r.text || '' })),
    languages: langs.map((l: any) => ({ name: l.name || l.language || '', proficiency: l.proficiency || '' })),
    activity: (raw.posts || raw.activity || []).slice(0, 10).map((a: any) => ({ title: a.title || a.text || '', date: a.date || '' })),
    raw,
  };
}

// ─── Completeness scoring ──────────────────────────────────────────

export function computeCompleteness(p: UnifiedProfile): number {
  let score = 0;
  if (p.headline && p.headline.length > 15) score += 10;
  if (p.summary && p.summary.length > 100) score += 15;
  if (p.experience.length > 0) score += 20;
  if (p.experience[0]?.description && p.experience[0].description.length > 50) score += 5;
  if (p.skills.length > 3) score += 15;
  if (p.skills.length > 10) score += 5;
  if (p.education.length > 0) score += 15;
  if (p.certifications.length > 0) score += 5;
  if (p.languages.length > 0) score += 5;
  if (p.activity.length > 0) score += 5;
  return Math.min(score, 100);
}

export function detectLanguage(p: UnifiedProfile): 'ar' | 'en' {
  const text = [p.headline, p.summary, ...p.experience.map(e => e.description || '')].join(' ');
  const arabicChars = (text.match(/[\u0600-\u06FF]/g) || []).length;
  if (text.length === 0) return 'en';
  return arabicChars / text.length > 0.3 ? 'ar' : 'en';
}

function getMissingSections(p: UnifiedProfile): string[] {
  const missing: string[] = [];
  if (!p.headline || p.headline.length < 15) missing.push('headline');
  if (!p.summary || p.summary.length < 100) missing.push('summary');
  if (p.experience.length === 0) missing.push('experience');
  if (p.skills.length < 3) missing.push('skills');
  if (p.education.length === 0) missing.push('education');
  if (p.certifications.length === 0) missing.push('certifications');
  if (p.languages.length === 0) missing.push('languages');
  return missing;
}

// ─── Actors ────────────────────────────────────────────────────────

interface Actor {
  id: string;
  inputKey: string;
  normalize: (raw: any) => UnifiedProfile;
}

// Order matters: best-coverage direct-URL actor first.
// apimaestro~linkedin-profile-detail REMOVED — confirmed broken (returns
// Sarp Tecimer for any URL, including fake ones). See module header.
const ACTORS: Actor[] = [
  { id: 'dev_fusion~Linkedin-Profile-Scraper', inputKey: 'profileUrls', normalize: normalizeDevFusion },
  { id: 'harvestapi~linkedin-profile-scraper', inputKey: 'linkedinUrls', normalize: normalizeHarvest },
];

async function runActor(actor: Actor, url: string, timeoutMs = 90000): Promise<UnifiedProfile | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(
      `https://api.apify.com/v2/acts/${actor.id}/run-sync-get-dataset-items?token=${APIFY_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [actor.inputKey]: [url] }),
        signal: ctrl.signal,
      }
    );
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    const raw = Array.isArray(data) ? data[0] : data;
    if (!raw) return null;
    return actor.normalize(raw);
  } catch {
    return null;
  }
}

// ─── Public API ────────────────────────────────────────────────────

export interface ScrapeOutcome {
  profile: UnifiedProfile;
  completeness: number;
  source: string;
  missingSections: string[];
  attempts: string[];
  /** Identity check — returned slug vs requested slug. Callers MUST verify. */
  requestedSlug: string;
  returnedSlug: string;
  identityMatch: boolean;
}

export async function scrapeLinkedInProfileMulti(url: string): Promise<ScrapeOutcome> {
  if (!APIFY_TOKEN) throw new Error('APIFY_TOKEN missing');

  const requestedSlug = extractSlugFromUrl(url);

  let best: UnifiedProfile | null = null;
  let bestScore = 0;
  let bestSource = '';
  const attempts: string[] = [];

  for (const actor of ACTORS) {
    const profile = await runActor(actor, url);
    if (!profile) {
      attempts.push(`${actor.id}: FAILED/empty`);
      continue;
    }

    // Layer-2 defence: reject any actor response whose slug does not match
    // the requested URL. This catches silent search-actor behavior where an
    // actor returns a "close match" instead of the exact profile.
    const returnedSlug = extractSlugFromProfile(profile);
    if (!slugsMatch(requestedSlug, returnedSlug)) {
      attempts.push(`${actor.id}: SLUG_MISMATCH requested=${requestedSlug} returned=${returnedSlug} fullName=${profile.fullName}`);
      console.warn('[scraper] slug mismatch — rejecting actor result', { actor: actor.id, requestedSlug, returnedSlug, fullName: profile.fullName });
      continue;
    }

    const score = computeCompleteness(profile);
    attempts.push(`${actor.id}: ${score}%`);
    console.log(`[scraper] ${actor.id} completeness=${score}% (skills=${profile.skills.length}, exp=${profile.experience.length}, edu=${profile.education.length})`);
    if (score > bestScore) {
      best = profile;
      bestScore = score;
      bestSource = actor.id;
    }
    if (score >= 85) break; // good enough, stop trying
  }

  if (!best) {
    // No actor returned a slug-matching profile. Distinguish between "we
    // got data but it was the wrong person" and "no data at all" so the
    // caller can surface the right NOT_FOUND message.
    const hadMismatch = attempts.some((a) => a.includes('SLUG_MISMATCH'));
    const err = new Error(
      hadMismatch
        ? `Identity mismatch — actor returned a different profile. Attempts: ${attempts.join(' | ')}`
        : `Profile not found or private. Attempts: ${attempts.join(' | ')}`
    );
    (err as any).kind = hadMismatch ? 'URL_MISMATCH' : 'NOT_FOUND';
    (err as any).requestedSlug = requestedSlug;
    (err as any).attempts = attempts;
    throw err;
  }

  const returnedSlug = extractSlugFromProfile(best);

  return {
    profile: best,
    completeness: bestScore,
    source: bestSource,
    missingSections: getMissingSections(best),
    attempts,
    requestedSlug,
    returnedSlug,
    identityMatch: slugsMatch(requestedSlug, returnedSlug),
  };
}
