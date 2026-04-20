import { callClaude, extractText, extractJson } from './claude-client';

export interface StyleProfile {
  tone: string[];
  dialect: string;
  sentenceLength: 'short' | 'medium' | 'long' | 'mixed';
  formality: number;
  useOfEmojis: boolean;
  useOfQuestions: boolean;
  signaturePhrases: string[];
  languageMix: 'ar-only' | 'en-only' | 'mixed';
  summary: string;
}

const STYLE_SYSTEM = `You are an expert writing style analyzer.

Given 1-3 sample posts from a user, extract their UNIQUE writing signature.

Return ONLY valid JSON:
{
  "tone": string[],
  "dialect": string,
  "sentenceLength": "short" | "medium" | "long" | "mixed",
  "formality": number,
  "useOfEmojis": boolean,
  "useOfQuestions": boolean,
  "signaturePhrases": string[],
  "languageMix": "ar-only" | "en-only" | "mixed",
  "summary": string
}

Focus on what makes THIS user DIFFERENT from generic AI writing.
Detect Arabic dialect variants carefully (Hasawi, Najdi, Hijazi, Eastern).`;

export async function analyzeWritingStyle(
  samples: string[]
): Promise<StyleProfile | null> {
  const combined = samples
    .map((s, i) => `--- Sample ${i + 1} ---\n${s}`)
    .join('\n\n');

  const response = await callClaude({
    task: 'post_generate',
    system: STYLE_SYSTEM,
    userContent: combined,
    maxTokens: 1500,
  });

  const text = extractText(response);
  const parsed = extractJson<StyleProfile>(text);
  return parsed;
}
