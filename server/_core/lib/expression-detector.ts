/**
 * Expression detector — maps a Claude reply (AR or EN) to one of the 6
 * portrait expressions used by AgentPortrait.tsx.
 *
 * This is intentionally lightweight (keyword scoring + emoji scan). It's
 * not sentiment analysis — it's a "what face should the agent be making
 * while saying this line?" heuristic.
 */

export type Expression = 'neutral' | 'happy' | 'thinking' | 'concerned' | 'excited' | 'frustrated';

interface KeywordSet {
  happy: string[];
  thinking: string[];
  concerned: string[];
  excited: string[];
  frustrated: string[];
}

const KEYWORDS_AR: KeywordSet = {
  happy: ['ممتاز', 'رائع', 'نجاح', 'هدف', 'تمام', 'أحسنت', 'جميل', 'مبروك', 'مذهل', 'العفو'],
  thinking: ['أعتقد', 'محتمل', 'ربما', 'سأفكر', 'لاحظت', 'يبدو', 'أتساءل', 'دعني أفكر'],
  concerned: ['تحذير', 'مشكلة', 'انخفاض', 'خطر', 'قلق', 'حذر', 'تنبيه', 'انتباه', 'احذر'],
  excited: ['بوس!', 'نار', 'انفجار', 'هذا هو', 'فجأة', 'رائع جداً', 'لا يصدق', 'مبهر', 'عظيم'],
  frustrated: ['مرفوض', 'فشل', 'لا أوافق', 'خطأ', 'لا ينطبق', 'مخالف', 'غير صحيح', 'لا يمكن'],
};

const KEYWORDS_EN: KeywordSet = {
  happy: ['excellent', 'great', 'success', 'goal', 'awesome', 'wonderful', 'perfect', 'congrats', 'amazing'],
  thinking: ['i think', 'maybe', 'perhaps', 'i wonder', 'let me think', 'noticed', 'seems', 'might', 'consider'],
  concerned: ['warning', 'problem', 'decline', 'risk', 'concern', 'careful', 'alert', 'caution', 'beware'],
  excited: ['boss!', 'fire', 'this is it', 'unbelievable', 'incredible', 'massive', 'huge', 'check this'],
  frustrated: ['rejected', 'failed', 'i disagree', 'error', 'does not apply', 'violation', 'incorrect', 'cannot'],
};

const EMOJI_MAP: Record<string, Expression> = {
  '🔥': 'excited',
  '💥': 'excited',
  '🚀': 'excited',
  '⚡': 'excited',
  '🎉': 'happy',
  '✨': 'happy',
  '😊': 'happy',
  '👍': 'happy',
  '✅': 'happy',
  '🤔': 'thinking',
  '💭': 'thinking',
  '⚠️': 'concerned',
  '😟': 'concerned',
  '😬': 'concerned',
  '❌': 'frustrated',
  '🚫': 'frustrated',
  '😤': 'frustrated',
};

/**
 * Detect the expression that best matches the tone of `text`.
 * Returns `defaultExpression` if no keywords/emojis match.
 */
export function detectExpression(
  text: string,
  language: 'ar' | 'en',
  defaultExpression: Expression = 'neutral'
): Expression {
  if (!text || !text.trim()) return defaultExpression;

  const haystack = text.toLowerCase();
  const keywords = language === 'ar' ? KEYWORDS_AR : KEYWORDS_EN;

  // Count keyword hits per expression
  const scores: Record<Expression, number> = {
    neutral: 0,
    happy: 0,
    thinking: 0,
    concerned: 0,
    excited: 0,
    frustrated: 0,
  };

  for (const expr of Object.keys(keywords) as Array<keyof KeywordSet>) {
    for (const word of keywords[expr]) {
      if (haystack.includes(word.toLowerCase())) {
        scores[expr] += 1;
      }
    }
  }

  // Emoji scan — emojis are strong signal, count double
  for (const [emoji, expr] of Object.entries(EMOJI_MAP)) {
    if (text.includes(emoji)) scores[expr] += 2;
  }

  // Punctuation hints
  const exclamCount = (text.match(/!/g) || []).length;
  if (exclamCount >= 2) scores.excited += 1;
  const questionCount = (text.match(/\?/g) || []).length;
  if (questionCount >= 2) scores.thinking += 1;

  // Pick highest-scoring expression; tie-break favors default
  let best: Expression = defaultExpression;
  let bestScore = 0;
  for (const expr of Object.keys(scores) as Expression[]) {
    if (scores[expr] > bestScore) {
      bestScore = scores[expr];
      best = expr;
    }
  }

  return bestScore > 0 ? best : defaultExpression;
}

/**
 * Optional helper — convert sentiment score (-1..1) to expression.
 */
export function sentimentToExpression(score: number, defaultExpression: Expression = 'neutral'): Expression {
  if (score >= 0.6) return 'happy';
  if (score >= 0.2) return 'thinking';
  if (score <= -0.6) return 'frustrated';
  if (score <= -0.2) return 'concerned';
  return defaultExpression;
}
