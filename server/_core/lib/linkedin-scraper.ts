// Multi-actor LinkedIn scraper with shape-specific normalizers.
// Picks the most complete result across actors.
//
// Confirmed actor shapes (from test-outputs/diag-*.json):
//   dev_fusion:  flat: { fullName, headline, about, experiences[], skills[{title}],
//                        educations[{title, subtitle, description, period}], licenseAndCertificates[],
//                        languages[{name, proficiency}], addressWithCountry }
//   apimaestro:  nested: { basic_info: { fullname, headline, about, location, ... },
//                          experience[{title, company, location, description}],
//                          skills[string], education[], certifications[{name,issuer}], languages[] }
//
// LinkedIn's public OAuth API does not return experience/skills/summary, so scraping
// is the only path for full analysis. iProyal residential proxy is available
// (LINKEDIN_PROXY_URL) but bypassing the authwall reliably needs logged-in cookies,
// so we depend on Apify actors that already maintain that infrastructure.

const APIFY_TOKEN = process.env.APIFY_TOKEN || process.env.APIFY_API_TOKEN || '';

export interface UnifiedProfile {
  fullName: string;
  firstName: string;
  headline: string;
  summary: string;
  location: string;
  profilePicture: string;
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
}

// ─── Shape-specific normalizers ────────────────────────────────────

function normalizeDevFusion(raw: any): UnifiedProfile {
  const fullName = raw.fullName || `${raw.firstName || ''} ${raw.lastName || ''}`.trim();
  const exp = Array.isArray(raw.experiences) ? raw.experiences : [];
  const edu = Array.isArray(raw.educations) ? raw.educations : [];
  const skillsArr = Array.isArray(raw.skills) ? raw.skills : [];
  const certs = Array.isArray(raw.licenseAndCertificates) ? raw.licenseAndCertificates : [];
  const langs = Array.isArray(raw.languages) ? raw.languages : [];

  return {
    fullName,
    firstName: raw.firstName || fullName.split(' ')[0] || '',
    headline: raw.headline || raw.jobTitle || '',
    summary: raw.about || raw.summary || '',
    location: raw.addressWithCountry || raw.addressCountryFull || raw.jobLocation || '',
    profilePicture: raw.profilePic || raw.profilePicture || raw.profilePicHighQuality || '',
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
  };
}

function normalizeApiMaestro(raw: any): UnifiedProfile {
  const bi = raw.basic_info || {};
  const exp = Array.isArray(raw.experience) ? raw.experience : [];
  const edu = Array.isArray(raw.education) ? raw.education : [];
  const skillsArr = Array.isArray(raw.skills) ? raw.skills : [];
  const certs = Array.isArray(raw.certifications) ? raw.certifications : [];
  const langs = Array.isArray(raw.languages) ? raw.languages : [];

  const fullName = bi.fullname || `${bi.first_name || ''} ${bi.last_name || ''}`.trim();
  return {
    fullName,
    firstName: bi.first_name || fullName.split(' ')[0] || '',
    headline: bi.headline || '',
    summary: bi.about || '',
    location: bi.location?.full || bi.location || '',
    profilePicture: bi.profile_picture_url || '',
    experience: exp.map((e: any) => ({
      title: e.title || e.position || '',
      company: e.company || e.company_name || '',
      duration: e.duration || e.date_range || `${e.start_date || ''} - ${e.end_date || ''}`,
      location: e.location || '',
      description: e.description || '',
    })),
    education: edu.map((e: any) => ({
      school: e.school || e.school_name || '',
      degree: e.degree || '',
      field: e.field || e.field_of_study || '',
      year: e.date_range || e.duration || '',
    })),
    skills: skillsArr.map((s: any) => (typeof s === 'string' ? s : s.name || s.title || '')).filter(Boolean),
    certifications: certs.map((c: any) => ({ name: c.name || '', issuer: c.issuer || c.organization || '' })),
    recommendations: (raw.recommendations || []).map((r: any) => ({ from: r.from || '', text: r.text || '' })),
    languages: langs.map((l: any) => ({ name: l.language || l.name || '', proficiency: l.proficiency || '' })),
    activity: (raw.posts || raw.activity || []).slice(0, 10).map((a: any) => ({ title: a.title || a.text || '', date: a.date || '' })),
  };
}

// Generic fallback for unknown shapes
function normalizeGeneric(raw: any): UnifiedProfile {
  if (raw?.basic_info) return normalizeApiMaestro(raw);
  return normalizeDevFusion(raw); // most fields overlap with dev_fusion
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

// Order matters: best-coverage actor first.
const ACTORS: Actor[] = [
  { id: 'dev_fusion~Linkedin-Profile-Scraper', inputKey: 'profileUrls', normalize: normalizeDevFusion },
  { id: 'apimaestro~linkedin-profile-detail', inputKey: 'profileUrls', normalize: normalizeApiMaestro },
  { id: 'harvestapi~linkedin-profile-scraper', inputKey: 'linkedinUrls', normalize: normalizeGeneric },
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
}

export async function scrapeLinkedInProfileMulti(url: string): Promise<ScrapeOutcome> {
  if (!APIFY_TOKEN) throw new Error('APIFY_TOKEN missing');

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

  if (!best || bestScore < 25) {
    throw new Error(`Profile data too incomplete to analyze. Attempts: ${attempts.join(', ')}`);
  }

  return {
    profile: best,
    completeness: bestScore,
    source: bestSource,
    missingSections: getMissingSections(best),
    attempts,
  };
}
