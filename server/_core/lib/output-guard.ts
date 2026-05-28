/**
 * Output Guard — Layer 5 (minimal slice).
 *
 * Deterministic check that runs on every Claude output before it reaches
 * the user. Blocks banned vendor / model names and Eastern Arabic digits,
 * mirroring the user-facing bans in docs/ban-list.md.
 *
 * When validateOutput returns invalid, callers throw MODEL_FAILED so the
 * existing per-engine Bowling Lane Rule refunds the user's token and
 * Sprint 8's error-formatter renders a friendly message.
 *
 * No logging table, no feedback UI, no aggregation — those wait for real
 * Beta signal (see docs/AI_TRAINING_ARCHITECTURE.md).
 */

const BANNED_USER_FACING = [
  // Vendor names
  'apify',
  'apollo',
  'bright data',
  'brightdata',
  'waalaxy',
  // AI / model names
  'claude',
  'gpt',
  'openai',
  'anthropic',
  'claude-sonnet',
  'claude-haiku',
  // Linguistic landmines (case-insensitive substring; Arabic has no case)
  'أتمنى أن تكون بخير',
];

const EASTERN_ARABIC_DIGITS = /[٠-٩]/;

export interface ValidationResult {
  valid: boolean;
  reason?: string;
  sample?: string;
}

/**
 * Validate AI output for banned words and Eastern Arabic digits.
 *
 * Empty / whitespace-only input is treated as valid here — empty output is
 * a separate failure mode handled by the engine (extractJson returning null).
 *
 * @param text Raw text from extractText(claudeResponse)
 * @param operation Optional label (e.g. 'radar.discovery') used in the warning log
 */
export function validateOutput(
  text: string,
  operation?: string,
): ValidationResult {
  if (!text || text.length === 0) {
    return { valid: true };
  }

  const lower = text.toLowerCase();

  for (const banned of BANNED_USER_FACING) {
    const needle = banned.toLowerCase();
    if (lower.includes(needle)) {
      const idx = lower.indexOf(needle);
      const sample = text
        .slice(Math.max(0, idx - 40), idx + 80)
        .replace(/[\n\r]+/g, ' ');
      console.warn(
        `[output-guard] banned word "${banned}" in ${operation || 'output'}. Sample: ${sample}`,
      );
      return {
        valid: false,
        reason: `banned_word:${banned}`,
        sample,
      };
    }
  }

  const digitMatch = text.match(EASTERN_ARABIC_DIGITS);
  if (digitMatch) {
    console.warn(
      `[output-guard] Eastern Arabic digit "${digitMatch[0]}" in ${operation || 'output'}`,
    );
    return {
      valid: false,
      reason: 'eastern_arabic_digit',
      sample: digitMatch[0],
    };
  }

  return { valid: true };
}
