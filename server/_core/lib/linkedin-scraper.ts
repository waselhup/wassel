// Multi-actor LinkedIn scraper with completeness scoring + language detection.
// Tries actors in order, picks the most complete result.

const APIFY_TOKEN = process.env.APIFY_TOKEN || process.env.APIFY_API_TOKEN || '';

interface Actor {
  id: string;
  inputKey: string; // some actors want "profileUrls", others "linkedinUrls"
}

const ACTORS: Actor[] = [
  { id: 'dev_fusion~Linkedin-Profile-Scraper', inputKey: 'profileUrls' },
  { id: 'apimaestro~linkedin-profile-detail', inputKey: 'profileUrls' },
  { id: 'harvestapi~linkedin-profile-scraper', inputKey: 'linkedinUrls' },
];

export interface ScrapeOutcome {
  profile: any;
  completeness: number;
  actor: string;
  missingSections: string[];
}

// Field-presence weights (sums to 100)
const WEIGHTS = {
  headline: 10,
  summary: 15,
  experience: 25,
  skills: 15,
  education: 15,
  recommendations: 5,
  activity: 10,
  certifications: 5,
};

export function computeCompleteness(p: any): number {
  if (!p) return 0;
  let score = 0;
  if ((p.headline || '').length > 10) score += WEIGHTS.headline;
  if (((p.summary || p.about || '') as string).length > 50) score += WEIGHTS.summary;
  if ((p.experience?.length || p.positions?.length || 0) > 0) score += WEIGHTS.experience;
  if ((p.skills?.length || 0) > 0) score += WEIGHTS.skills;
  if ((p.education?.length || 0) > 0) score += WEIGHTS.education;
  if ((p.recommendations?.length || p.recommendationsReceived?.length || 0) > 0) score += WEIGHTS.recommendations;
  if ((p.activity?.length || p.posts?.length || 0) > 0) score += WEIGHTS.activity;
  if ((p.certifications?.length || p.licenses?.length || 0) > 0) score += WEIGHTS.certifications;
  return Math.min(score, 100);
}

export function detectLanguage(profile: any): 'ar' | 'en' {
  const text = [
    profile?.headline || '',
    profile?.summary || profile?.about || '',
    ...((profile?.experience || profile?.positions || []).map((e: any) => e?.description || e?.summary || '')),
  ].join(' ');
  const arabicChars = (text.match(/[\u0600-\u06FF]/g) || []).length;
  const totalChars = text.replace(/\s/g, '').length;
  if (totalChars === 0) return 'en';
  return arabicChars / totalChars > 0.3 ? 'ar' : 'en';
}

async function tryActor(actor: Actor, url: string, timeoutMs = 90000): Promise<any | null> {
  try {
    const body: Record<string, any> = { [actor.inputKey]: [url] };
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(
      `https://api.apify.com/v2/acts/${actor.id}/run-sync-get-dataset-items?token=${APIFY_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      }
    );
    clearTimeout(timer);
    if (!res.ok) {
      console.warn(`[scraper] ${actor.id} HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    const profile = Array.isArray(data) ? data[0] : data;
    return profile || null;
  } catch (err: any) {
    console.warn(`[scraper] ${actor.id} failed:`, err?.message);
    return null;
  }
}

export async function scrapeLinkedInProfileMulti(url: string): Promise<ScrapeOutcome> {
  if (!APIFY_TOKEN) throw new Error('APIFY_TOKEN missing');

  let best: any = null;
  let bestScore = 0;
  let bestActor = '';

  for (const actor of ACTORS) {
    const profile = await tryActor(actor, url);
    if (!profile) continue;
    const score = computeCompleteness(profile);
    console.log(`[scraper] ${actor.id} completeness=${score}%`);
    if (score > bestScore) {
      best = profile;
      bestScore = score;
      bestActor = actor.id;
    }
    if (score >= 85) break; // good enough, stop trying
  }

  if (!best || bestScore < 30) {
    throw new Error(`LinkedIn profile data too incomplete (best=${bestScore}%) — profile may be private`);
  }

  const missing: string[] = [];
  if (!best.headline || best.headline.length < 10) missing.push('headline');
  if (!(best.summary || best.about) || (best.summary || best.about || '').length < 50) missing.push('summary');
  if (!(best.experience?.length || best.positions?.length)) missing.push('experience');
  if (!best.skills?.length) missing.push('skills');
  if (!best.education?.length) missing.push('education');
  if (!(best.recommendations?.length || best.recommendationsReceived?.length)) missing.push('recommendations');
  if (!(best.activity?.length || best.posts?.length)) missing.push('activity');
  if (!(best.certifications?.length || best.licenses?.length)) missing.push('media');

  return { profile: best, completeness: bestScore, actor: bestActor, missingSections: missing };
}
