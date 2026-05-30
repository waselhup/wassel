import type { SupabaseClient } from '@supabase/supabase-js';
import { callClaude, extractText, extractJson, MODELS } from './claude-client';
import { supportChatPrompt } from '../prompts/_generated';

/**
 * Support / Customer-Service Chat Engine — Part 1 (backend).
 *
 * Two modes:
 *   - visitor   (not logged in): FAQ-first, then AI capped at VISITOR_AI_CAP.
 *   - user      (logged in):     FAQ-first, then AI capped at USER_AI_CAP_DEFAULT,
 *                                or USER_AI_CAP_EXTENDED iff an admin set
 *                                allow_extended = true on the conversation.
 *
 * IRON RULE — COST CONTROL IS SERVER-SIDE:
 *   The number of AI replies is counted in support_conversations.ai_reply_count
 *   (a DB column), incremented only after a successful Claude call, and the cap
 *   is checked against that DB value on every message. The client cannot raise
 *   its own cap. FAQ answers are tried first and cost zero AI.
 *
 * On cap-hit we DO NOT call Claude: we return a warm Arabic "handoff" message,
 * flip the conversation to status='awaiting_admin', and notify every admin.
 *
 * This engine is called with a SERVICE-ROLE Supabase client (bypasses RLS), so
 * it can read/write visitor conversations that have no auth user.
 */

// ─── Caps (the whole point of this feature) ─────────────────────────
export const VISITOR_AI_CAP = 5;          // visitor: up to 5 AI replies, then handoff
export const USER_AI_CAP_DEFAULT = 5;     // logged-in: same low cap by default
export const USER_AI_CAP_EXTENDED = 20;   // logged-in + admin allow_extended

export type SupportMode = 'visitor' | 'user';
export type MessageSource = 'user' | 'faq' | 'ai' | 'handoff' | 'admin';
export type ConversationStatus = 'active' | 'awaiting_admin' | 'closed';

export interface SupportConversation {
  id: string;
  mode: SupportMode;
  user_id: string | null;
  status: ConversationStatus;
  ai_reply_count: number;
  allow_extended: boolean;
  visitor_id: string | null;
  last_message_at: string;
  created_at: string;
  updated_at: string;
}

export interface FaqEntry {
  id: string;
  question_ar: string;
  question_en: string;
  answer_ar: string;
  answer_en: string;
  keywords: string[];
  audience: 'all' | 'visitor' | 'user';
  display_order: number;
}

export interface SendMessageResult {
  conversationId: string;
  source: MessageSource;        // 'faq' | 'ai' | 'handoff'
  reply: string;                // the text to render
  language: 'ar' | 'en';
  aiReplyCount: number;         // server-side counter AFTER this turn
  status: ConversationStatus;   // conversation status AFTER this turn
  faqId?: string | null;        // set when source === 'faq'
  capReached: boolean;          // true on the turn we hand off
}

/**
 * The AI-reply generator, isolated behind an injectable hook so the cost-control
 * DB logic (counter increment, cap, handoff, admin-notify) can be verified
 * WITHOUT a live API key. In production `aiReplyGenerator` is always the real
 * Claude-Haiku call below; only the verification script overrides it via
 * `__setAiReplyGeneratorForTests`. Never call the setter from app code.
 */
export interface AiReplyInput {
  audience: SupportMode;
  historyText: string;
  message: string;
  plansBlock: string;
}
export type AiReplyGenerator = (input: AiReplyInput) => Promise<{ reply: string; language: 'ar' | 'en' }>;

const realAiReplyGenerator: AiReplyGenerator = async ({ audience, historyText, message, plansBlock }) => {
  const res = await callClaude({
    task: 'campaign_message',          // any task; modelOverride forces Haiku
    modelOverride: MODELS.fast,        // claude-haiku-4-5-20251001
    system: supportChatPrompt.system.replace('{{plans}}', plansBlock),
    userContent:
      supportChatPrompt.user({ audience, history: historyText || '(لا يوجد)', message }) +
      '\n\nRespond ONLY with a JSON object matching: { "reply": string, "language": "ar" | "en" }. No prose outside the JSON.',
    maxTokens: 700,
    temperature: 0.5,
  });
  const text = extractText(res);
  const parsed = extractJson<{ reply?: string; language?: 'ar' | 'en' }>(text);
  if (parsed?.reply && parsed.reply.trim()) {
    return {
      reply: parsed.reply.trim(),
      language: parsed.language === 'en' ? 'en' : 'ar',
    };
  }
  // JSON-directive failed but we still got prose — use it rather than error.
  if (text.trim()) return { reply: text.trim(), language: 'ar' };
  return { reply: '', language: 'ar' };
};

let aiReplyGenerator: AiReplyGenerator = realAiReplyGenerator;

/** TEST-ONLY: override the AI generator. Pass null to restore the real one. */
export function __setAiReplyGeneratorForTests(fn: AiReplyGenerator | null): void {
  aiReplyGenerator = fn ?? realAiReplyGenerator;
}

export class SupportError extends Error {
  code:
    | 'CONVERSATION_NOT_FOUND'
    | 'CONVERSATION_CLOSED'
    | 'EMPTY_MESSAGE'
    | 'MODEL_FAILED'
    | 'INTERNAL';
  constructor(code: SupportError['code'], message: string) {
    super(message);
    this.code = code;
    this.name = 'SupportError';
  }
}

// ─── Text normalization + FAQ matching (zero-cost path) ─────────────

/**
 * Normalize Arabic + Latin text for keyword matching:
 *  - lowercase
 *  - strip Arabic diacritics (tashkeel) + tatweel
 *  - unify alef variants (أإآ → ا), ة → ه, ى → ي
 *  - collapse punctuation/whitespace to single spaces
 */
export function normalizeText(input: string): string {
  if (!input) return '';
  return input
    .toLowerCase()
    .replace(/[ً-ْٰـ]/g, '') // tashkeel + superscript alef + tatweel
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')           // drop punctuation (unicode-aware)
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Generic stopwords (ar + en) that must NEVER, on their own, trigger an FAQ
 * match — they appear in countless unrelated questions ("how much is the
 * salary?", "what is the difference?"). They are excluded both as keywords and
 * from the question-similarity overlap, so a single common word can't absorb an
 * off-topic message into the FAQ path. (Normalized form: tashkeel-stripped,
 * alef/ya/ta unified — matches normalizeText output.)
 */
const FAQ_STOPWORDS = new Set<string>([
  // Arabic interrogatives / fillers
  'كم', 'ما', 'ماذا', 'هل', 'كيف', 'متي', 'اين', 'لماذا', 'من', 'هي', 'هو',
  'في', 'علي', 'عن', 'مع', 'الى', 'او', 'و', 'ثم', 'ان', 'اي', 'لي', 'لك',
  'هذا', 'هذه', 'ذلك', 'يمكن', 'يمكنني', 'الذي', 'التي',
  // English interrogatives / fillers
  'how', 'what', 'is', 'are', 'the', 'a', 'an', 'do', 'does', 'can', 'i',
  'you', 'my', 'me', 'to', 'of', 'and', 'or', 'in', 'on', 'for', 'about',
]);

const MATCH_THRESHOLD = 3; // a single specific keyword (or a strong overlap) is enough

/**
 * Try to match a user message to a saved FAQ. Returns the best match or null.
 *
 * Scoring (deterministic, no AI):
 *  - +3 for each NON-stopword keyword that appears as a whole token (or, for
 *    multi-word keywords, as a substring) in the message
 *  - +2 if the message strongly overlaps the FAQ question (≥60% of the
 *    question's NON-stopword tokens appear)
 * A score of at least MATCH_THRESHOLD is required, so a single generic word
 * cannot pull an unrelated message into the FAQ path — it falls through to the
 * AI path (or handoff), which is what keeps the cap meaningful.
 */
export function matchFaq(message: string, faqs: FaqEntry[]): FaqEntry | null {
  const norm = normalizeText(message);
  if (!norm) return null;
  const tokens = new Set(norm.split(' ').filter(Boolean));

  let best: { faq: FaqEntry; score: number } | null = null;

  for (const faq of faqs) {
    let score = 0;

    for (const kwRaw of faq.keywords ?? []) {
      const kw = normalizeText(kwRaw);
      if (!kw) continue;
      if (kw.includes(' ')) {
        // multi-word keyword → substring match (specific by construction)
        if (norm.includes(kw)) score += 3;
      } else if (!FAQ_STOPWORDS.has(kw) && tokens.has(kw)) {
        // single-word keyword → whole-token match, but never a stopword
        score += 3;
      }
    }

    // Question-similarity bonus: share of the question's specific tokens present.
    for (const qText of [faq.question_ar, faq.question_en]) {
      const qTokens = normalizeText(qText)
        .split(' ')
        .filter((t) => t.length > 2 && !FAQ_STOPWORDS.has(t));
      if (qTokens.length === 0) continue;
      const overlap = qTokens.filter((t) => tokens.has(t)).length;
      if (overlap / qTokens.length >= 0.6) {
        score += 2;
        break;
      }
    }

    if (score >= MATCH_THRESHOLD && (!best || score > best.score)) {
      best = { faq, score };
    }
  }

  return best ? best.faq : null;
}

// ─── Language guess (for FAQ answer selection) ──────────────────────
function guessLanguage(message: string): 'ar' | 'en' {
  // If any Arabic letter is present, treat as Arabic (Wassel is Arabic-first).
  return /[؀-ۿ]/.test(message) ? 'ar' : 'en';
}

// ─── Cap resolution ─────────────────────────────────────────────────
export function resolveCap(conv: Pick<SupportConversation, 'mode' | 'allow_extended'>): number {
  if (conv.mode === 'visitor') return VISITOR_AI_CAP;
  return conv.allow_extended ? USER_AI_CAP_EXTENDED : USER_AI_CAP_DEFAULT;
}

// ─── FAQ list (public read) ─────────────────────────────────────────
export async function listFaqs(
  supabase: SupabaseClient,
  audience: SupportMode | 'all' = 'all'
): Promise<FaqEntry[]> {
  let q = supabase
    .from('support_faqs')
    .select('id, question_ar, question_en, answer_ar, answer_en, keywords, audience, display_order')
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  // 'all' audience FAQs are always shown; audience-specific ones filter in.
  if (audience !== 'all') {
    q = q.in('audience', ['all', audience]);
  }

  const { data, error } = await q;
  if (error) throw new SupportError('INTERNAL', error.message);
  return (data ?? []) as FaqEntry[];
}

// ─── Conversation lifecycle ─────────────────────────────────────────
export async function startConversation(
  supabase: SupabaseClient,
  params: { mode: SupportMode; userId?: string | null; visitorId?: string | null }
): Promise<SupportConversation> {
  const row = {
    mode: params.mode,
    user_id: params.userId ?? null,
    visitor_id: params.visitorId ?? null,
    status: 'active' as const,
    ai_reply_count: 0,
    allow_extended: false,
  };
  const { data, error } = await supabase
    .from('support_conversations')
    .insert(row)
    .select('*')
    .single();
  if (error) throw new SupportError('INTERNAL', error.message);
  return data as SupportConversation;
}

async function getConversation(
  supabase: SupabaseClient,
  conversationId: string
): Promise<SupportConversation | null> {
  const { data, error } = await supabase
    .from('support_conversations')
    .select('*')
    .eq('id', conversationId)
    .maybeSingle();
  if (error) throw new SupportError('INTERNAL', error.message);
  return (data as SupportConversation) ?? null;
}

async function insertMessage(
  supabase: SupabaseClient,
  conversationId: string,
  role: 'user' | 'assistant' | 'admin',
  source: MessageSource,
  content: string,
  faqId?: string | null
): Promise<void> {
  const { error } = await supabase.from('support_messages').insert({
    conversation_id: conversationId,
    role,
    source,
    content,
    faq_id: faqId ?? null,
  });
  if (error) throw new SupportError('INTERNAL', error.message);
}

async function recentHistory(
  supabase: SupabaseClient,
  conversationId: string,
  limit = 10
): Promise<Array<{ role: string; content: string }>> {
  const { data, error } = await supabase
    .from('support_messages')
    .select('role, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new SupportError('INTERNAL', error.message);
  // chronological (oldest first) for the prompt
  return (data ?? [])
    .slice()
    .reverse()
    .map((m) => ({ role: m.role, content: m.content }));
}

// ─── Admin notification on handoff (reuse existing notifications table) ──
async function notifyAdminsOfHandoff(
  supabase: SupabaseClient,
  conv: SupportConversation
): Promise<void> {
  const { data: admins, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('is_admin', true);
  if (error || !admins || admins.length === 0) return;

  const who = conv.mode === 'visitor' ? 'زائر' : 'مستخدم';
  const rows = admins.map((a: { id: string }) => ({
    user_id: a.id,
    channel: 'in_app' as const,
    category: 'system' as const,
    template_key: 'support_handoff',
    title_ar: 'محادثة دعم تحتاج متابعة',
    title_en: 'A support conversation needs follow-up',
    body_ar: `وصلت محادثة من ${who} إلى الحد الأقصى من الردود الآلية وتحتاج إلى رد بشري.`,
    body_en: `A conversation from a ${conv.mode} reached the automated reply limit and needs a human reply.`,
    cta_label_ar: 'فتح المحادثة',
    cta_label_en: 'Open conversation',
    cta_url: `/admin/support/${conv.id}`,
    metadata: { conversation_id: conv.id, mode: conv.mode },
    priority: 'high' as const,
    status: 'pending' as const,
  }));

  // Direct insert (not the RPC) — admin alerts must never be frequency-capped
  // or deduped away. Best-effort: a notification failure must not break chat.
  const { error: insErr } = await supabase.from('notifications').insert(rows);
  if (insErr) {
    console.error('[support-engine] admin handoff notify failed:', insErr.message);
  }
}

// ─── Plans block for the AI system prompt (read live tiers) ─────────
async function buildPlansBlock(supabase: SupabaseClient): Promise<string> {
  const { data, error } = await supabase
    .from('plans')
    .select('name_ar, name_en, monthly_price_sar, monthly_tokens, is_free, is_active, display_order')
    .eq('is_active', true)
    .order('display_order', { ascending: true });
  if (error || !data || data.length === 0) {
    return '- (تفاصيل الباقات متاحة في صفحة الباقات.)';
  }
  return data
    .map((p: any) => {
      const price = p.is_free || Number(p.monthly_price_sar) === 0
        ? (Number(p.monthly_price_sar) === 0 && !p.is_free ? 'مخصص / Custom' : 'مجاني / Free')
        : `${Number(p.monthly_price_sar)} SAR/شهر`;
      const tokens = p.monthly_tokens > 0 ? `${p.monthly_tokens} نقطة شهرياً` : 'حسب الاتفاق';
      return `- ${p.name_ar} (${p.name_en}): ${price} — ${tokens}`;
    })
    .join('\n');
}

// ─── The core: sendMessage ──────────────────────────────────────────
export async function sendMessage(
  supabase: SupabaseClient,
  params: { conversationId: string; message: string }
): Promise<SendMessageResult> {
  const message = (params.message ?? '').trim();
  if (!message) throw new SupportError('EMPTY_MESSAGE', 'Message is empty.');

  const conv = await getConversation(supabase, params.conversationId);
  if (!conv) throw new SupportError('CONVERSATION_NOT_FOUND', 'Conversation not found.');
  if (conv.status === 'closed') {
    throw new SupportError('CONVERSATION_CLOSED', 'This conversation is closed.');
  }

  const nowIso = new Date().toISOString();

  // 1) Always store the user's message first (full transcript for Admin).
  await insertMessage(supabase, conv.id, 'user', 'user', message);
  await supabase
    .from('support_conversations')
    .update({ last_message_at: nowIso, updated_at: nowIso })
    .eq('id', conv.id);

  // 2) FAQ-first — zero AI cost.
  const audience: SupportMode = conv.mode;
  const faqs = await listFaqs(supabase, audience);
  const matched = matchFaq(message, faqs);
  if (matched) {
    const lang = guessLanguage(message);
    const answer = lang === 'ar' ? matched.answer_ar : matched.answer_en;
    await insertMessage(supabase, conv.id, 'assistant', 'faq', answer, matched.id);
    return {
      conversationId: conv.id,
      source: 'faq',
      reply: answer,
      language: lang,
      aiReplyCount: conv.ai_reply_count, // unchanged — no AI was used
      status: conv.status,
      faqId: matched.id,
      capReached: false,
    };
  }

  // 3) No FAQ match → enforce the SERVER-SIDE cap before any AI call.
  const cap = resolveCap(conv);
  if (conv.ai_reply_count >= cap) {
    const lang = guessLanguage(message);
    const handoffAr =
      'شكراً لتواصلك مع وصل. سيقوم أحد أعضاء فريقنا بمتابعة سؤالك والرد عليك في أقرب وقت. في هذه الأثناء، يمكنك تصفح الأسئلة الشائعة.';
    const handoffEn =
      'Thank you for reaching out to Wassel. A member of our team will follow up on your question and get back to you shortly. In the meantime, feel free to browse the FAQ.';
    const reply = lang === 'ar' ? handoffAr : handoffEn;

    await insertMessage(supabase, conv.id, 'assistant', 'handoff', reply);
    await supabase
      .from('support_conversations')
      .update({ status: 'awaiting_admin', updated_at: new Date().toISOString() })
      .eq('id', conv.id);
    await notifyAdminsOfHandoff(supabase, { ...conv, status: 'awaiting_admin' });

    return {
      conversationId: conv.id,
      source: 'handoff',
      reply,
      language: lang,
      aiReplyCount: conv.ai_reply_count, // unchanged — no AI was used
      status: 'awaiting_admin',
      capReached: true,
    };
  }

  // 4) Under cap → call Claude Haiku (cheap) with the Wassel-aware prompt.
  const history = await recentHistory(supabase, conv.id, 10);
  const historyText = history
    .map((m) => `${m.role === 'user' ? 'user' : 'wassel'}: ${m.content}`)
    .join('\n');
  const plansBlock = await buildPlansBlock(supabase);

  let replyText = '';
  let lang: 'ar' | 'en' = guessLanguage(message);
  try {
    const out = await aiReplyGenerator({ audience, historyText, message, plansBlock });
    replyText = (out.reply ?? '').trim();
    if (out.language === 'ar' || out.language === 'en') lang = out.language;
  } catch (err) {
    throw new SupportError('MODEL_FAILED', err instanceof Error ? err.message : 'AI call failed');
  }

  if (!replyText) {
    throw new SupportError('MODEL_FAILED', 'Empty AI reply.');
  }

  // 5) Store the AI reply and INCREMENT the server-side counter atomically-ish.
  await insertMessage(supabase, conv.id, 'assistant', 'ai', replyText);
  const newCount = conv.ai_reply_count + 1;
  await supabase
    .from('support_conversations')
    .update({ ai_reply_count: newCount, updated_at: new Date().toISOString() })
    .eq('id', conv.id);

  return {
    conversationId: conv.id,
    source: 'ai',
    reply: replyText,
    language: lang,
    aiReplyCount: newCount,
    status: conv.status,
    capReached: false,
  };
}

// ─── Admin: toggle extended cap (UI-less in Part 1) ─────────────────
export async function setAllowExtended(
  supabase: SupabaseClient,
  conversationId: string,
  allow: boolean
): Promise<SupportConversation> {
  const { data, error } = await supabase
    .from('support_conversations')
    .update({ allow_extended: allow, updated_at: new Date().toISOString() })
    .eq('id', conversationId)
    .select('*')
    .single();
  if (error) throw new SupportError('INTERNAL', error.message);
  return data as SupportConversation;
}
