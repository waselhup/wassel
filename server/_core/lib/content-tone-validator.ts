/**
 * Content tone validator — A11 enforcement.
 *
 * Wassel's content tone (per docs/decisions/A11.md):
 *   - ❌ Hook patterns ("Stop scrolling…", "I cannot believe this…", "Hot take:")
 *   - ❌ Vision 2030 references
 *   - ❌ Fabricated statistics (heuristic, not enforced here — see engine)
 *   - ❌ Hashtag spam (max 3 hashtags)
 *   - ❌ Emoji-heavy openers (>2 emojis in the first 50 chars)
 *   - ❌ Vendor/model attributions
 *   - ❌ Religious salutations (per language-rules.md)
 *
 * The validator is invoked AFTER generation, BEFORE cache write.
 * On a violation, the engine retries once with a stricter system prompt.
 * After a second failure, the engine logs a warning and serves to the user
 * anyway (the generation succeeded — the prompt design is the real fix).
 */

const FORBIDDEN_PATTERNS_AR: ReadonlyArray<{ pattern: RegExp; label: string }> = [
  { pattern: /توقّ?ف\s*عن\s*التمرير/i,       label: 'hook: stop_scrolling_ar' },
  { pattern: /لن\s*تصدّ?ق/i,                  label: 'hook: i_cannot_believe_ar' },
  { pattern: /رأي\s*صادم\s*[:.\-،]/i,         label: 'hook: hot_take_ar' },
  { pattern: /رأي\s*غير\s*شائع\s*[:.\-،]/i,   label: 'hook: unpopular_opinion_ar' },
  { pattern: /رؤية\s*2030/i,                  label: 'banned: vision_2030_ar' },
  { pattern: /انثروبيك/i,                     label: 'vendor: anthropic_ar' },
  { pattern: /كلود/i,                         label: 'vendor: claude_ar' },
  { pattern: /شات\s*جي\s*بي\s*تي/i,           label: 'vendor: chatgpt_ar' },
  { pattern: /مدعوم\s*ب/i,                    label: 'vendor: powered_by_ar' },
  { pattern: /بسم\s*الله/i,                   label: 'salutation: bismillah' },
  { pattern: /السلام\s*عليكم/i,               label: 'salutation: assalamu_alaikum' },
];

const FORBIDDEN_PATTERNS_EN: ReadonlyArray<{ pattern: RegExp; label: string }> = [
  { pattern: /stop\s+scrolling/i,             label: 'hook: stop_scrolling_en' },
  { pattern: /i\s+cannot\s+believe\s+(this|how|what)/i, label: 'hook: i_cannot_believe_en' },
  { pattern: /\bhot\s*take\s*[:.\-]/i,        label: 'hook: hot_take_en' },
  { pattern: /\bunpopular\s*opinion\s*[:.\-]/i, label: 'hook: unpopular_opinion_en' },
  { pattern: /vision\s*2030/i,                label: 'banned: vision_2030_en' },
  { pattern: /\banthropic\b/i,                label: 'vendor: anthropic_en' },
  { pattern: /\bclaude\b/i,                   label: 'vendor: claude_en' },
  { pattern: /\bopenai\b/i,                   label: 'vendor: openai_en' },
  { pattern: /\bchatgpt\b/i,                  label: 'vendor: chatgpt_en' },
  { pattern: /\bgpt\b/i,                      label: 'vendor: gpt_en' },
  { pattern: /\bpowered\s+by\b/i,             label: 'vendor: powered_by_en' },
];

// Conservative emoji range — Misc Symbols, Dingbats, Misc Symbols & Pictographs,
// Emoticons, Transport, Supplemental Symbols, Symbols & Pictographs Extended-A.
const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F600}-\u{1F64F}]/gu;
const HASHTAG_RE = /(^|\s)#[\p{L}\p{N}_]+/gu;

export type ToneValidation = {
  valid: boolean;
  violations: string[]; // human-readable labels
};

/**
 * Validate content against all forbidden patterns + hashtag/emoji rules.
 * Pass the full text (post body, carousel caption + slides concatenated, etc.).
 */
export function validateTone(content: string, language: 'ar' | 'en'): ToneValidation {
  if (!content || content.trim().length === 0) {
    return { valid: true, violations: [] };
  }

  const violations: string[] = [];
  const patterns = language === 'ar' ? FORBIDDEN_PATTERNS_AR : FORBIDDEN_PATTERNS_EN;

  // Always check both alphabets — a forbidden EN pattern in AR content (or
  // vice-versa) is still a violation. AR patterns dominate AR content but EN
  // brand/vendor names can leak in either direction.
  const allPatterns = [...patterns, ...(language === 'ar' ? FORBIDDEN_PATTERNS_EN : FORBIDDEN_PATTERNS_AR)];
  const seen = new Set<string>();
  for (const { pattern, label } of allPatterns) {
    if (pattern.test(content) && !seen.has(label)) {
      violations.push(label);
      seen.add(label);
    }
  }

  // Hashtag count
  const hashtagCount = countHashtags(content);
  if (hashtagCount > 3) {
    violations.push(`hashtag_spam: ${hashtagCount}_hashtags`);
  }

  // Emoji-heavy opener
  if (hasEmojiHeavyOpener(content)) {
    violations.push('emoji_heavy_opener');
  }

  return { valid: violations.length === 0, violations };
}

/**
 * Count hashtags in text. Counts only proper hashtag tokens (preceded by start
 * or whitespace). Does NOT count `#1` style ordinal markers.
 */
export function countHashtags(text: string): number {
  if (!text) return 0;
  const matches = text.matchAll(HASHTAG_RE);
  let n = 0;
  for (const m of matches) {
    // Skip "#1", "#10", "#1st" — those are ordinal markers, not hashtags.
    const tag = m[0].trim();
    if (/^#\d/.test(tag)) continue;
    n++;
  }
  return n;
}

/**
 * Check if the first 50 chars contain >2 emojis (a common "trend-bait" pattern).
 * Per A11, openings should be observational, not emoji-driven.
 */
export function hasEmojiHeavyOpener(text: string): boolean {
  if (!text) return false;
  const opener = text.slice(0, 50);
  const emojis = opener.match(EMOJI_RE);
  return (emojis?.length ?? 0) > 2;
}

/**
 * Flatten a Carousel or RepurposeBundle into a single string for validation.
 * Each surface should pass the combined text — the validator doesn't care
 * about structure, just patterns.
 */
export function flattenForValidation(value: unknown): string {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';
  const obj = value as Record<string, unknown>;
  const parts: string[] = [];

  // Post shape
  if (typeof obj.body === 'string') parts.push(obj.body);
  if (Array.isArray(obj.hashtags)) parts.push(...obj.hashtags.filter((h): h is string => typeof h === 'string'));

  // Carousel shape
  if (typeof obj.caption === 'string') parts.push(obj.caption);
  if (Array.isArray(obj.slides)) {
    for (const slide of obj.slides as Array<Record<string, unknown>>) {
      if (typeof slide.title === 'string') parts.push(slide.title);
      if (typeof slide.body === 'string') parts.push(slide.body);
    }
  }

  // Repurpose shape
  if (obj.carousel && typeof obj.carousel === 'object') {
    parts.push(flattenForValidation(obj.carousel));
  }
  if (obj.short_video_script && typeof obj.short_video_script === 'object') {
    const v = obj.short_video_script as Record<string, unknown>;
    if (typeof v.hook === 'string') parts.push(v.hook);
    if (Array.isArray(v.beats)) parts.push(...v.beats.filter((b): b is string => typeof b === 'string'));
    if (typeof v.cta === 'string') parts.push(v.cta);
  }
  if (obj.follow_up_post && typeof obj.follow_up_post === 'object') {
    parts.push(flattenForValidation(obj.follow_up_post));
  }

  return parts.join('\n\n');
}
