/**
 * Profile language detection for the Profile Radar.
 *
 * Why this exists: the report language (what the *analysis narrative* is in)
 * and the suggestions language (what *rewrites of the user's headline / about
 * / experience copy* should be in) are different concepts. A Saudi candidate
 * may want an English-language report explaining their Arabic profile — but
 * the suggested headline rewrite has to come back in Arabic so they can paste
 * it directly into LinkedIn.
 *
 * We sample the headline + about + first few experience descriptions and
 * compute the Arabic-character ratio over the alphabetic content. Mixed
 * profiles default to whichever language the bulk of the prose is in; if
 * neither dominates, English wins (LinkedIn's lingua franca, and what most
 * recruiters scan first).
 */

export type ProfileLang = 'ar' | 'en';

export interface ProfileTextSample {
  headline?: string | null;
  summary?: string | null;
  experience?: Array<{ title?: string | null; description?: string | null }> | null;
}

const ARABIC_CHAR = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
const LATIN_CHAR = /[A-Za-z]/;

function classifyChar(ch: string): 'ar' | 'en' | 'other' {
  if (ARABIC_CHAR.test(ch)) return 'ar';
  if (LATIN_CHAR.test(ch)) return 'en';
  return 'other';
}

/**
 * Compute the Arabic ratio over alphabetic characters in `text`.
 * Returns NaN when the string has no alphabetic content.
 */
export function arabicRatio(text: string): number {
  if (!text) return NaN;
  let ar = 0;
  let en = 0;
  for (const ch of text) {
    const k = classifyChar(ch);
    if (k === 'ar') ar++;
    else if (k === 'en') en++;
  }
  const alpha = ar + en;
  if (alpha === 0) return NaN;
  return ar / alpha;
}

/**
 * Detect the dominant language of a LinkedIn profile from its text fields.
 *
 * Heuristic:
 *  - Concatenate headline + summary + first 3 experience titles/descriptions
 *  - Strip generic platform terms that appear identical in both languages
 *    (URLs, technical acronyms) so they don't bias the count
 *  - Compute Arabic ratio
 *  - >= 0.45 → 'ar' (Arabic-leaning bilingual profiles still want AR rewrites)
 *  - otherwise → 'en'
 *
 * The 0.45 threshold (not 0.5) intentionally favours Arabic on borderline
 * mixed profiles — Saudi candidates routinely write a bilingual headline
 * ("Software Engineer | مهندس برمجيات") but think of the profile as Arabic.
 */
export function detectProfileLanguage(sample: ProfileTextSample): ProfileLang {
  const parts: string[] = [];
  if (sample.headline) parts.push(String(sample.headline));
  if (sample.summary) parts.push(String(sample.summary));
  if (Array.isArray(sample.experience)) {
    for (const e of sample.experience.slice(0, 3)) {
      if (e?.title) parts.push(String(e.title));
      if (e?.description) parts.push(String(e.description).slice(0, 400));
    }
  }
  const joined = parts.join(' ').replace(/https?:\/\/\S+/g, ' ');
  const ratio = arabicRatio(joined);
  if (Number.isNaN(ratio)) return 'en';
  return ratio >= 0.45 ? 'ar' : 'en';
}
