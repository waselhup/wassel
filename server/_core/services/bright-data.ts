// Bright Data adapter for direct-URL LinkedIn profile scraping.
// Replaces the Apify search-actor path (harvestapi~linkedin-profile-search)
// which had a silent nearest-match bug — see docs/brightdata-integration-notes.md.
//
// Dataset: gd_l1viktl72bvl7bjuj0 (LinkedIn people profiles, async trigger → poll → fetch).
// Fake URLs return error_code="dead_page" with zero records, not a nearest match.

import {
  extractSlugFromUrl,
  extractSlugFromProfile,
  slugsMatch,
  type UnifiedProfile,
  type ScrapeOutcome,
} from '../lib/linkedin-scraper';

const DEFAULT_DATASET_ID = 'gd_l1viktl72bvl7bjuj0';
const TRIGGER_URL = 'https://api.brightdata.com/datasets/v3/trigger';
const PROGRESS_URL = 'https://api.brightdata.com/datasets/v3/progress';
const SNAPSHOT_URL = 'https://api.brightdata.com/datasets/v3/snapshot';
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 90000;

export class BrightDataProfileNotFoundError extends Error {
  code: string;
  requestedSlug: string;
  errorCode?: string;
  constructor(message: string, requestedSlug: string, errorCode?: string) {
    super(message);
    this.name = 'BrightDataProfileNotFoundError';
    this.code = 'NOT_FOUND';
    this.requestedSlug = requestedSlug;
    this.errorCode = errorCode;
  }
}

function getConfig(): { apiKey: string; datasetId: string } {
  const apiKey = process.env.BRIGHT_DATA_API_KEY || '';
  const datasetId = process.env.BRIGHT_DATA_LINKEDIN_DATASET_ID || DEFAULT_DATASET_ID;
  if (!apiKey) throw new Error('BRIGHT_DATA_API_KEY missing');
  return { apiKey, datasetId };
}

async function triggerCollection(url: string): Promise<string> {
  const { apiKey, datasetId } = getConfig();
  const triggerUrl = `${TRIGGER_URL}?dataset_id=${datasetId}&include_errors=true`;
  console.log('[BRIGHT_DATA] trigger', { datasetId, url });

  const res = await fetch(triggerUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([{ url }]),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Bright Data trigger failed: HTTP ${res.status} — ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const snapshotId = data?.snapshot_id;
  if (!snapshotId) throw new Error(`Bright Data trigger returned no snapshot_id: ${JSON.stringify(data).slice(0, 300)}`);
  return snapshotId;
}

async function pollUntilReady(snapshotId: string): Promise<void> {
  const { apiKey } = getConfig();
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const res = await fetch(`${PROGRESS_URL}/${snapshotId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      console.warn('[BRIGHT_DATA] progress HTTP', res.status);
      continue;
    }
    const data = await res.json();
    const status = data?.status;
    console.log('[BRIGHT_DATA] progress', { snapshotId, status, records: data?.records, errors: data?.errors });
    if (status === 'ready') return;
    if (status === 'failed') throw new Error(`Bright Data snapshot failed: ${JSON.stringify(data).slice(0, 300)}`);
  }
  throw new Error(`Bright Data snapshot timed out after ${POLL_TIMEOUT_MS}ms`);
}

async function fetchSnapshot(snapshotId: string): Promise<any[]> {
  const { apiKey } = getConfig();
  const res = await fetch(`${SNAPSHOT_URL}/${snapshotId}?format=json`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Bright Data snapshot fetch failed: HTTP ${res.status} — ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [data];
}

function isErrorRow(row: any): boolean {
  if (!row) return true;
  if (row.error || row.error_code) return true;
  if (!row.id && !row.linkedin_id && !row.name && !row.first_name) return true;
  return false;
}

function normalize(raw: any): UnifiedProfile {
  const fullName = raw.name || `${raw.first_name || ''} ${raw.last_name || ''}`.trim();
  const exp = Array.isArray(raw.experience) ? raw.experience : [];
  const edu = Array.isArray(raw.education) ? raw.education : [];
  const certs = Array.isArray(raw.certifications) ? raw.certifications : [];
  const langs = Array.isArray(raw.languages) ? raw.languages : [];
  const activity = Array.isArray(raw.activity) ? raw.activity : [];
  const rawRecs = Array.isArray(raw.recommendations) ? raw.recommendations : [];

  const linkedinUrl = raw.url || raw.input_url || raw.input?.url || '';
  const slugFromField = (raw.id || raw.linkedin_id || '').toString().toLowerCase();
  const slugFromUrl = linkedinUrl ? extractSlugFromUrl(linkedinUrl) : '';
  const slug = slugFromField || slugFromUrl;

  const currentCompany = raw.current_company || {};
  const skillsList: string[] = [];
  if (Array.isArray(raw.skills)) {
    for (const s of raw.skills) {
      if (typeof s === 'string') skillsList.push(s);
      else if (s?.name) skillsList.push(s.name);
      else if (s?.title) skillsList.push(s.title);
    }
  }

  // Bright Data inconsistency: `position` is sometimes the full
  // "Title at Company" string, sometimes absent, sometimes just a title.
  // `current_company.title` + `.name` is more reliable. Build the best
  // headline we can from whichever fields are present.
  const ccTitle = currentCompany.title;
  const ccName = currentCompany.name || raw.current_company_name;
  const composed = [ccTitle, ccName].filter(Boolean).join(' at ');
  let headline = raw.headline || '';
  if (!headline) {
    if (raw.position && raw.position.toLowerCase().includes(' at ')) {
      headline = raw.position;
    } else {
      headline = composed || raw.position || ccName || '';
    }
  }

  return {
    slug,
    fullName,
    firstName: raw.first_name || (fullName.split(' ')[0] || ''),
    headline,
    summary: raw.about || '',
    location: raw.location || [raw.city, raw.country_code].filter(Boolean).join(', '),
    profilePicture: raw.avatar || '',
    bannerImage: raw.banner_image || '',
    customUrl: !!slug && !/^\w{5,}-\w{5,}/.test(slug),
    openToWork: !!raw.open_to_work,
    linkedinUrl,
    experience: exp.map((e: any) => ({
      title: e?.title || e?.position || '',
      company: e?.company || e?.subtitle || '',
      duration: e?.duration || `${e?.start_date || ''} - ${e?.end_date || 'Present'}`.trim(),
      location: e?.location || '',
      description: e?.description || e?.description_html || '',
    })),
    education: edu.map((e: any) => ({
      school: e?.title || e?.school || '',
      degree: e?.degree || e?.subtitle || '',
      field: e?.field || e?.description || '',
      year: [e?.start_year, e?.end_year].filter(Boolean).join(' - '),
    })),
    skills: skillsList,
    certifications: certs.map((c: any) => ({
      name: c?.title || c?.name || '',
      issuer: c?.subtitle || c?.issuer || '',
    })),
    recommendations: rawRecs.map((r: any) => {
      if (typeof r === 'string') {
        const m = r.match(/^([^“"]+?)\s*[“"](.*)[”"]$/s);
        if (m) return { from: m[1].trim(), text: m[2].trim() };
        return { from: '', text: r };
      }
      return { from: r?.from || r?.author || '', text: r?.text || r?.content || '' };
    }),
    languages: langs.map((l: any) => ({
      name: l?.title || l?.name || l?.language || '',
      proficiency: l?.subtitle || l?.proficiency || l?.level || '',
    })),
    activity: activity.slice(0, 10).map((a: any) => ({
      title: a?.title || a?.text || '',
      date: a?.date || '',
    })),
    raw,
  };
}

export async function scrapeLinkedInProfileBrightData(url: string): Promise<ScrapeOutcome> {
  const requestedSlug = extractSlugFromUrl(url);
  const attempts: string[] = [];

  const snapshotId = await triggerCollection(url);
  attempts.push(`bright-data: triggered snapshot=${snapshotId}`);
  await pollUntilReady(snapshotId);
  const rows = await fetchSnapshot(snapshotId);

  const first = rows[0];
  if (!first || isErrorRow(first)) {
    const errCode = first?.error_code || 'unknown';
    const errMsg = first?.error || 'No records returned';
    attempts.push(`bright-data: error_code=${errCode} msg=${errMsg}`);
    console.warn('[BRIGHT_DATA] not found', { requestedSlug, errCode, errMsg });
    throw new BrightDataProfileNotFoundError(
      `Profile not found or private. ${errMsg}`,
      requestedSlug,
      errCode,
    );
  }

  const profile = normalize(first);
  const returnedSlug = extractSlugFromProfile(profile);

  if (!slugsMatch(requestedSlug, returnedSlug)) {
    attempts.push(`bright-data: SLUG_MISMATCH requested=${requestedSlug} returned=${returnedSlug} fullName=${profile.fullName}`);
    console.error('[BRIGHT_DATA] slug mismatch — rejecting', { requestedSlug, returnedSlug, fullName: profile.fullName });
    const err: any = new Error(`Identity mismatch — Bright Data returned a different profile`);
    err.kind = 'URL_MISMATCH';
    err.requestedSlug = requestedSlug;
    err.attempts = attempts;
    throw err;
  }

  const completeness = computeCompletenessBD(profile);
  const missingSections = getMissingSectionsBD(profile);
  attempts.push(`bright-data: ${completeness}%`);
  console.log('[BRIGHT_DATA] success', {
    slug: returnedSlug,
    fullName: profile.fullName,
    headline: profile.headline,
    summaryLen: profile.summary.length,
    experienceCount: profile.experience.length,
    educationCount: profile.education.length,
    certCount: profile.certifications.length,
    langCount: profile.languages.length,
    activityCount: profile.activity.length,
    completeness,
    missing: missingSections,
  });

  return {
    profile,
    completeness,
    source: 'bright-data',
    missingSections,
    attempts,
    requestedSlug,
    returnedSlug,
    identityMatch: true,
  };
}

// Bright Data-specific completeness scorer.
//
// Why it differs from linkedin-scraper.ts: Bright Data's default LinkedIn
// people-profiles dataset does NOT return a skills array, and some profiles
// omit experience/certifications/languages entirely. The Apify-era scorer
// penalized every missing skill hard, which caused a false-negative 20%
// score for legitimate profiles. This scorer treats skills as bonus-only
// and uses lower thresholds on summary/headline.
function computeCompletenessBD(p: UnifiedProfile): number {
  let score = 0;
  // Identity (always present for a resolved profile)
  if (p.fullName) score += 10;
  // Headline — composed from current_company when missing, so threshold 5
  if (p.headline && p.headline.length > 5) score += 15;
  // Summary — Bright Data `about` length varies widely, accept from 50 chars
  if (p.summary && p.summary.length > 50) score += 20;
  if (p.summary && p.summary.length > 200) score += 5;
  // Experience — big signal when present but many profiles hide it
  if (p.experience.length > 0) score += 20;
  if (p.experience[0]?.description && p.experience[0].description.length > 50) score += 5;
  // Education
  if (p.education.length > 0) score += 10;
  // Certifications / languages — bonus
  if (p.certifications.length > 0) score += 5;
  if (p.languages.length > 0) score += 5;
  // Activity (Bright Data reliably returns this)
  if (p.activity.length > 0) score += 5;
  // Skills — bonus-only. Bright Data's default dataset doesn't return this.
  if (p.skills.length >= 3) score += 5;
  return Math.min(score, 100);
}

function getMissingSectionsBD(p: UnifiedProfile): string[] {
  const missing: string[] = [];
  if (!p.headline || p.headline.length < 5) missing.push('headline');
  if (!p.summary || p.summary.length < 50) missing.push('summary');
  if (p.experience.length === 0 && p.education.length === 0 && p.activity.length === 0) {
    missing.push('experience_or_activity');
  }
  if (p.education.length === 0) missing.push('education');
  return missing;
}
