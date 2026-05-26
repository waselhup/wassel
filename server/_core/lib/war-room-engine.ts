/**
 * War Room engine — the conversation orchestration layer.
 *
 * Each agent reply pulls together:
 *   1. The agent's personality (system_prompt_extension_{lang})
 *   2. The last 50 decisions Ali made with this agent (learning)
 *   3. The wassel_context.md file
 *   4. The current session's recent turns
 *
 * All Claude calls flow through callClaudeForAgent so cost is logged.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { loadWasselContext } from './context-loader';
import { callClaudeForAgent } from '../agents/cost-tracker';
import { detectExpression, type Expression } from './expression-detector';

let cachedAdmin: SupabaseClient | null = null;
function getAdminClient(): SupabaseClient {
  if (cachedAdmin) return cachedAdmin;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) throw new Error('Supabase service-role credentials missing');
  cachedAdmin = createClient(url, key, { auth: { persistSession: false } });
  return cachedAdmin;
}

export type Language = 'ar' | 'en';
export type SpeakerType = 'ali' | 'agent';
export type DecisionType =
  | 'approve'
  | 'reject'
  | 'edit'
  | 'approve_with_changes'
  | 'ask_question'
  | 'defer';

export interface Personality {
  agent_id: string;
  age: number;
  speech_style_ar: string;
  speech_style_en: string;
  catchphrases_ar: string[] | null;
  catchphrases_en: string[] | null;
  expressions: string[];
  default_expression: Expression;
  table_seat: number;
  voice_pitch: number;
  voice_rate: number;
  signature_animation: string | null;
  system_prompt_extension_ar: string;
  system_prompt_extension_en: string;
}

export interface DecisionMemoryRow {
  decision_type: DecisionType;
  original_proposal: string;
  ali_response: string | null;
  ali_edit: string | null;
  topic_tags: string[] | null;
  created_at: string;
}

export interface ConversationTurn {
  id: string;
  speaker_type: SpeakerType;
  speaker_id: string | null;
  message: string;
  language: Language;
  expression: string | null;
  created_at: string;
}

interface BuildPromptArgs {
  agentId: string;
  language: Language;
  recentTurns: ConversationTurn[];
  topicTags?: string[];
}

const FALLBACK_BRIEFS: Record<string, { ar: string; en: string }> = {
  faris:        { ar: 'صباح الخير علي. الفريق جاهز.',                   en: 'Good morning Ali. Team is ready.' },
  sayed:        { ar: 'بوس! عندي 3 hooks جاهزة.',                       en: 'Boss! I have 3 hooks ready.' },
  al_mukhadram: { ar: 'يا علي العزيز، 8 مستخدمين يحتاجون اهتمامك.',     en: 'My dear Ali, 8 users need your attention.' },
  hassan:       { ar: 'الأرقام تقول: 5 hot leads.',                      en: 'Numbers say: 5 hot leads.' },
  fatima:       { ar: 'لاحظت نمطاً جديداً.',                              en: 'I noticed a new pattern.' },
  dhai:         { ar: 'لا تنبيهات.',                                     en: 'No alerts.' },
  hussein:      { ar: 'الخدمات سليمة.',                                  en: 'Services healthy.' },
  mohammed:     { ar: 'الـ runway 47 يوم.',                              en: 'Runway 47 days.' },
};

const MORNING_ORDER: string[] = ['faris', 'sayed', 'al_mukhadram', 'hassan', 'fatima', 'dhai', 'hussein', 'mohammed'];

/** Load a personality row by agent_id. Throws on missing. */
async function loadPersonality(agentId: string): Promise<Personality> {
  const { data, error } = await getAdminClient()
    .from('agent_personalities')
    .select('*')
    .eq('agent_id', agentId)
    .single();
  if (error || !data) throw new Error(`Personality not found for ${agentId}: ${error?.message || ''}`);
  // catchphrases come back as JSONB — typed loosely
  return {
    ...(data as any),
    catchphrases_ar: Array.isArray((data as any).catchphrases_ar) ? (data as any).catchphrases_ar : null,
    catchphrases_en: Array.isArray((data as any).catchphrases_en) ? (data as any).catchphrases_en : null,
    expressions: Array.isArray((data as any).expressions) ? (data as any).expressions : ['neutral'],
  } as Personality;
}

/** Read the last N decisions for this user × agent. */
export async function getDecisionMemory(
  userId: string,
  agentId: string,
  limit: number = 50,
  topicTags?: string[]
): Promise<DecisionMemoryRow[]> {
  let q = getAdminClient()
    .from('agent_decision_memory')
    .select('decision_type, original_proposal, ali_response, ali_edit, topic_tags, created_at')
    .eq('user_id', userId)
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (topicTags && topicTags.length) {
    q = q.overlaps('topic_tags', topicTags);
  }
  const { data } = await q;
  return ((data as any) || []) as DecisionMemoryRow[];
}

/** Build the system prompt + user prompt for an agent reply. */
async function buildAgentPrompts(
  userId: string,
  args: BuildPromptArgs
): Promise<{ system: string; user: string }> {
  const [personality, decisions, wasselContext] = await Promise.all([
    loadPersonality(args.agentId),
    getDecisionMemory(userId, args.agentId, 50, args.topicTags),
    loadWasselContext(),
  ]);

  const extension =
    args.language === 'ar'
      ? personality.system_prompt_extension_ar
      : personality.system_prompt_extension_en;
  const speechStyle =
    args.language === 'ar' ? personality.speech_style_ar : personality.speech_style_en;

  const decisionsBlock =
    decisions.length === 0
      ? args.language === 'ar'
        ? '(لا يوجد قرارات سابقة — هذه أول محادثة)'
        : '(No prior decisions — this is the first conversation)'
      : decisions
          .map((d) => {
            const tail = d.ali_edit || d.ali_response || 'no response';
            return `- ${d.decision_type}: "${(d.original_proposal || '').slice(0, 120)}" → "${tail.slice(0, 120)}"`;
          })
          .join('\n');

  const conversationBlock = args.recentTurns
    .map((t) => {
      const who = t.speaker_type === 'ali' ? 'Ali' : (t.speaker_id || 'agent');
      return `${who}: ${t.message}`;
    })
    .join('\n');

  const system = [
    wasselContext,
    '---',
    extension,
    '',
    args.language === 'ar'
      ? `أسلوب كلامك: ${speechStyle}`
      : `Your speech style: ${speechStyle}`,
    '',
    args.language === 'ar'
      ? 'تاريخ قرارات Ali معك (آخر 50):'
      : 'Ali decision history with you (last 50):',
    decisionsBlock,
    '',
    args.language === 'ar'
      ? 'استخدم هذا التاريخ لتفهم كيف Ali يفكر. لا تكرر اقتراحات رفضها سابقاً. اقترح بنفس النمط الذي يوافق عليه.'
      : 'Use this history to understand how Ali thinks. Do not repeat suggestions he previously rejected. Suggest in the pattern he approves.',
    '',
    args.language === 'ar'
      ? 'قواعد الرد:'
      : 'Reply rules:',
    args.language === 'ar' ? '1. اقترح قبل أن تطلب موافقة — اسأل علي عن رأيه في النبرة/التوقيت/المنهج.' : '1. Suggest before asking for approval — ask Ali about tone/timing/approach.',
    args.language === 'ar' ? '2. لو الموضوع مشابه لقرار سابق رفضه علي، أشر إلى ذلك وعدّل اقتراحك.' : '2. If the topic resembles a prior rejection, acknowledge it and adjust.',
    args.language === 'ar' ? '3. اجعل ردك مختصراً (60-120 كلمة عادة، إلا إذا طلب علي تفاصيل).' : '3. Keep replies concise (60-120 words usually, unless Ali asks for detail).',
    args.language === 'ar' ? '4. ردك يجب يكون بالعربية.' : '4. Reply in English.',
  ].join('\n');

  const user = conversationBlock
    ? `${conversationBlock}\n\n${args.language === 'ar' ? 'ردك:' : 'Your reply:'}`
    : args.language === 'ar'
      ? 'علي فتح غرفة القيادة. اعطه brief افتتاحي قصير (جملة أو جملتين).'
      : 'Ali just opened the war room. Give a brief opener (one or two sentences).';

  return { system, user };
}

// ────────────────────────────────────────────────────────────────────
// PUBLIC API
// ────────────────────────────────────────────────────────────────────

/** Start a new session for `userId`. */
export async function startSession(userId: string, language: Language, voiceEnabled = false): Promise<string> {
  const { data, error } = await getAdminClient()
    .from('war_room_sessions')
    .insert({ user_id: userId, language, voice_enabled: voiceEnabled })
    .select('id')
    .single();
  if (error || !data) throw new Error(`startSession failed: ${error?.message}`);
  return (data as any).id as string;
}

export async function endSession(sessionId: string): Promise<void> {
  await getAdminClient()
    .from('war_room_sessions')
    .update({ ended_at: new Date().toISOString() })
    .eq('id', sessionId);
}

/** Append a turn to the conversation log. Returns the row id. */
export async function appendTurn(args: {
  sessionId: string;
  userId: string;
  speakerType: SpeakerType;
  speakerId: string | null;
  message: string;
  language: Language;
  expression: Expression | null;
  metadata?: Record<string, unknown>;
  parentId?: string | null;
}): Promise<string> {
  const { data, error } = await getAdminClient()
    .from('war_room_conversations')
    .insert({
      session_id: args.sessionId,
      user_id: args.userId,
      speaker_type: args.speakerType,
      speaker_id: args.speakerId,
      message: args.message,
      language: args.language,
      expression: args.expression,
      metadata: args.metadata ?? null,
      parent_id: args.parentId ?? null,
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`appendTurn failed: ${error?.message}`);

  // Bump messages_count on the session (best effort).
  try {
    const { data: sess } = await getAdminClient()
      .from('war_room_sessions')
      .select('messages_count')
      .eq('id', args.sessionId)
      .single();
    const next = ((sess as any)?.messages_count || 0) + 1;
    await getAdminClient().from('war_room_sessions').update({ messages_count: next }).eq('id', args.sessionId);
  } catch {
    /* non-fatal */
  }

  return (data as any).id as string;
}

/** Pull the last N turns for a session, oldest-first. */
export async function getRecentTurns(sessionId: string, limit: number = 20): Promise<ConversationTurn[]> {
  const { data } = await getAdminClient()
    .from('war_room_conversations')
    .select('id, speaker_type, speaker_id, message, language, expression, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return (((data as any) || []) as ConversationTurn[]).reverse();
}

/**
 * Generate a single agent reply for a given session.
 * Logs the agent turn to the DB and returns it.
 */
export async function generateAgentReply(args: {
  sessionId: string;
  userId: string;
  agentId: string;
  language: Language;
  topicTags?: string[];
  prompt?: string; // optional override (used by morningBrief)
}): Promise<{ message: string; expression: Expression; turnId: string }> {
  const personality = await loadPersonality(args.agentId);
  const recentTurns = args.prompt ? [] : await getRecentTurns(args.sessionId, 20);
  const { system, user } = await buildAgentPrompts(args.userId, {
    agentId: args.agentId,
    language: args.language,
    recentTurns,
    topicTags: args.topicTags,
  });

  let message: string;
  try {
    const res = await callClaudeForAgent({
      agentId: args.agentId,
      task: 'post_generate', // haiku-tier — fast and cheap
      purpose: args.prompt ? 'war_room_brief' : 'war_room_reply',
      system,
      userContent: args.prompt || user,
      maxTokens: 500,
      temperature: 0.75,
      injectContext: false, // we already injected via system
    });
    message = res.text.trim();
    if (!message) {
      message = FALLBACK_BRIEFS[args.agentId]?.[args.language] || 'لا تعليق.';
    }
  } catch (err: any) {
    console.error(`[war-room] Claude failed for ${args.agentId}:`, err?.message || err);
    message = FALLBACK_BRIEFS[args.agentId]?.[args.language] || 'لا تعليق.';
  }

  const expression = detectExpression(message, args.language, personality.default_expression);

  const turnId = await appendTurn({
    sessionId: args.sessionId,
    userId: args.userId,
    speakerType: 'agent',
    speakerId: args.agentId,
    message,
    language: args.language,
    expression,
  });

  return { message, expression, turnId };
}

/**
 * Morning brief — every agent says one line, faris first.
 */
export async function getMorningBrief(sessionId: string, userId: string, language: Language): Promise<Array<{
  agentId: string;
  message: string;
  expression: Expression;
  turnId: string;
}>> {
  const out: Array<{ agentId: string; message: string; expression: Expression; turnId: string }> = [];
  for (const agentId of MORNING_ORDER) {
    const prompt =
      language === 'ar'
        ? 'علي فتح غرفة القيادة. اعطه brief افتتاحي قصير (جملة أو جملتين كحد أقصى). كن في شخصيتك.'
        : 'Ali just opened the war room. Give a brief opener (max one or two sentences). Stay in character.';
    const reply = await generateAgentReply({
      sessionId,
      userId,
      agentId,
      language,
      prompt,
    });
    out.push({ agentId, ...reply });
  }
  return out;
}

/**
 * Pick which agents should respond to Ali's message.
 * Heuristic: scan for agent names + role keywords. Falls back to Faris.
 */
function pickRespondingAgents(message: string, language: Language): string[] {
  const t = message.toLowerCase();
  const hits: string[] = [];
  const nameMap: Record<string, string[]> = {
    faris:        ['faris', 'فارس'],
    sayed:        ['sayed', 'سيد'],
    al_mukhadram: ['mukhadram', 'mukhdrm', 'المخضرم', 'مخضرم'],
    hassan:       ['hassan', 'حسن'],
    fatima:       ['fatima', 'فاطمة'],
    dhai:         ['dhai', 'ضي'],
    hussein:      ['hussein', 'حسين'],
    mohammed:     ['mohammed', 'محمد'],
  };
  const roleMap: Record<string, string[]> = {
    sayed:        ['content', 'post', 'tweet', 'thread', 'hook', 'محتوى', 'منشور', 'ads', 'إعلان'],
    al_mukhadram: ['user', 'support', 'whatsapp', 'مستخدم', 'دعم', 'health', 'churn'],
    hassan:       ['conversion', 'upgrade', 'pitch', 'sales', 'mrr', 'ترقية', 'بيع', 'إيرادات'],
    fatima:       ['research', 'data', 'pattern', 'friction', 'بحث', 'تحليل', 'نمط'],
    dhai:         ['compliance', 'fraud', 'pdpl', 'tos', 'امتثال', 'احتيال'],
    hussein:      ['error', 'service', 'api', 'latency', 'خطأ', 'خدمة'],
    mohammed:     ['cost', 'margin', 'runway', 'invoice', 'تكلفة', 'هامش', 'فاتورة'],
    faris:        ['brief', 'summary', 'all', 'team', 'تقرير', 'الفريق', 'الجميع'],
  };

  for (const [id, words] of Object.entries(nameMap)) {
    if (words.some((w) => t.includes(w.toLowerCase()))) hits.push(id);
  }
  if (hits.length === 0) {
    for (const [id, words] of Object.entries(roleMap)) {
      if (words.some((w) => t.includes(w.toLowerCase()))) hits.push(id);
    }
  }
  if (hits.length === 0) hits.push('faris'); // COO answers when nobody is addressed

  // Dedup, preserve first-seen order
  return Array.from(new Set(hits));
}

/**
 * Handle Ali's message: log it, then route to responding agents.
 * Returns the array of agent replies in the order they responded.
 */
export async function sendMessage(args: {
  sessionId: string;
  userId: string;
  message: string;
  language: Language;
}): Promise<{
  aliTurnId: string;
  replies: Array<{ agentId: string; message: string; expression: Expression; turnId: string }>;
}> {
  const aliTurnId = await appendTurn({
    sessionId: args.sessionId,
    userId: args.userId,
    speakerType: 'ali',
    speakerId: null,
    message: args.message,
    language: args.language,
    expression: null,
  });

  const respondingAgents = pickRespondingAgents(args.message, args.language);
  const replies: Array<{ agentId: string; message: string; expression: Expression; turnId: string }> = [];
  // Sequential so the conversation has a clear order (Claude rate-limits also prefer this).
  for (const agentId of respondingAgents.slice(0, 3)) {
    try {
      const reply = await generateAgentReply({
        sessionId: args.sessionId,
        userId: args.userId,
        agentId,
        language: args.language,
      });
      replies.push({ agentId, ...reply });
    } catch (err: any) {
      console.error(`[war-room] reply failed for ${agentId}:`, err?.message || err);
    }
  }

  return { aliTurnId, replies };
}

/**
 * Record a decision Ali made (approve / reject / edit / etc).
 * Used by the learning loop.
 */
export async function recordDecision(args: {
  userId: string;
  agentId: string;
  conversationId: string | null;
  decisionType: DecisionType;
  originalProposal: string;
  aliResponse?: string | null;
  aliEdit?: string | null;
  rejectionReason?: string | null;
  topicTags?: string[];
}): Promise<string> {
  const { data, error } = await getAdminClient()
    .from('agent_decision_memory')
    .insert({
      user_id: args.userId,
      agent_id: args.agentId,
      conversation_id: args.conversationId,
      decision_type: args.decisionType,
      original_proposal: args.originalProposal,
      ali_response: args.aliResponse ?? null,
      ali_edit: args.aliEdit ?? null,
      rejection_reason: args.rejectionReason ?? null,
      topic_tags: args.topicTags ?? null,
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`recordDecision failed: ${error?.message}`);
  return (data as any).id as string;
}

/**
 * Generate a small "projector" payload for a turn — used when an agent
 * wants to "show" data. Caller provides the shape; we just persist it.
 */
export async function attachScreenContent(args: {
  conversationId: string;
  contentType: 'chart' | 'table' | 'text' | 'image' | 'funnel' | 'kpi' | 'comparison';
  titleAr?: string;
  titleEn?: string;
  payload: Record<string, unknown>;
  displayDurationSeconds?: number;
}): Promise<string> {
  const { data, error } = await getAdminClient()
    .from('war_room_screen_content')
    .insert({
      conversation_id: args.conversationId,
      content_type: args.contentType,
      title_ar: args.titleAr ?? null,
      title_en: args.titleEn ?? null,
      payload: args.payload,
      display_duration_seconds: args.displayDurationSeconds ?? 30,
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`attachScreenContent failed: ${error?.message}`);
  return (data as any).id as string;
}

/**
 * Compute Monday-of-this-week as a YYYY-MM-DD date string (UTC).
 */
function isoMonday(d: Date = new Date()): string {
  const day = d.getUTCDay(); // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setUTCDate(d.getUTCDate() + diff);
  return mon.toISOString().slice(0, 10);
}

/**
 * Generate Faris's weekly journal — a synthesis of Ali's decisions this week.
 * Idempotent on (user_id, week_start) via UNIQUE constraint + upsert.
 */
export async function generateWeeklyJournal(userId: string, language: Language = 'ar'): Promise<{ id: string; created: boolean }> {
  const weekStart = isoMonday();
  // Pull all decisions in the trailing 7 days
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await getAdminClient()
    .from('agent_decision_memory')
    .select('agent_id, decision_type, original_proposal, ali_response, ali_edit, topic_tags, created_at')
    .eq('user_id', userId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(200);

  const decisions = ((data as any) || []) as Array<{
    agent_id: string;
    decision_type: DecisionType;
    original_proposal: string;
    ali_response: string | null;
    ali_edit: string | null;
    topic_tags: string[] | null;
  }>;

  // Patterns by agent
  const patterns: Record<string, { total: number; approve: number; reject: number; edit: number }> = {};
  for (const d of decisions) {
    const p = patterns[d.agent_id] || { total: 0, approve: 0, reject: 0, edit: 0 };
    p.total += 1;
    if (d.decision_type === 'approve' || d.decision_type === 'approve_with_changes') p.approve += 1;
    else if (d.decision_type === 'reject') p.reject += 1;
    else if (d.decision_type === 'edit') p.edit += 1;
    patterns[d.agent_id] = p;
  }

  let obsAr = '';
  let obsEn = '';

  if (decisions.length === 0) {
    obsAr = 'الأسبوع كان هادئاً يا علي. لا قرارات نتعلم منها بعد. عندما تبدأ في التفاعل مع الفريق، أبدأ في تحليل أنماطك.';
    obsEn = 'Quiet week, Ali. No decisions to learn from yet. Once you start interacting with the team, I will analyze your patterns.';
  } else {
    const summary = Object.entries(patterns)
      .map(([id, p]) => `${id}: ${p.approve}/${p.total} approved`)
      .join(', ');

    try {
      const system = [
        await loadWasselContext(),
        '---',
        'أنت فارس، COO فريق علي. اكتب فقرة من 80-120 كلمة بالعربية تلخص ما تعلمناه عن علي هذا الأسبوع. اذكر نمطاً أو نمطين فقط، وذكر اسم وكيل أو وكيلين. تكلم بضمير المتكلم (نحن).',
      ].join('\n');
      const userPrompt = `تفاصيل: ${decisions.length} قرار هذا الأسبوع. ${summary}. لا تخترع أرقاماً، استخدم هذه الأرقام فقط.`;
      const res = await callClaudeForAgent({
        agentId: 'faris',
        task: 'post_generate',
        purpose: 'weekly_journal_ar',
        system,
        userContent: userPrompt,
        maxTokens: 400,
        temperature: 0.6,
        injectContext: false,
      });
      obsAr = res.text.trim();

      const systemEn = 'You are Faris, COO of Ali team. Write an 80-120 word paragraph in English summarizing what we learned about Ali this week. Mention one or two patterns and one or two agent names. Speak in first person plural (we).';
      const resEn = await callClaudeForAgent({
        agentId: 'faris',
        task: 'post_generate',
        purpose: 'weekly_journal_en',
        system: systemEn,
        userContent: `Details: ${decisions.length} decisions this week. ${summary}. Do not invent numbers, use only these.`,
        maxTokens: 400,
        temperature: 0.6,
        injectContext: false,
      });
      obsEn = resEn.text.trim();
    } catch (err: any) {
      console.error('[war-room] weekly journal claude failed:', err?.message || err);
      obsAr = `هذا الأسبوع: ${decisions.length} قرار. ${summary}.`;
      obsEn = `This week: ${decisions.length} decisions. ${summary}.`;
    }
  }

  // Upsert via INSERT ... ON CONFLICT
  const adminDb = getAdminClient();
  const existing = await adminDb
    .from('agent_learning_journal')
    .select('id')
    .eq('user_id', userId)
    .eq('week_start', weekStart)
    .maybeSingle();

  if (existing.data?.id) {
    await adminDb
      .from('agent_learning_journal')
      .update({
        observations_ar: obsAr,
        observations_en: obsEn,
        patterns_detected: patterns,
        decisions_analyzed: decisions.length,
      })
      .eq('id', existing.data.id);
    return { id: existing.data.id, created: false };
  }

  const { data: row, error } = await adminDb
    .from('agent_learning_journal')
    .insert({
      user_id: userId,
      week_start: weekStart,
      observations_ar: obsAr,
      observations_en: obsEn,
      patterns_detected: patterns,
      decisions_analyzed: decisions.length,
    })
    .select('id')
    .single();
  if (error || !row) throw new Error(`weekly journal insert failed: ${error?.message}`);
  return { id: (row as any).id as string, created: true };
}

/** Load the most recent journal for a user (or by week). */
export async function getWeeklyJournal(userId: string, weekStart?: string): Promise<any | null> {
  let q = getAdminClient().from('agent_learning_journal').select('*').eq('user_id', userId);
  if (weekStart) q = q.eq('week_start', weekStart);
  q = q.order('week_start', { ascending: false }).limit(1);
  const { data } = await q;
  return ((data as any) || [])[0] || null;
}

/** Counts for the in-room "knows N decisions" badge. */
export async function getAgentMemoryStats(userId: string): Promise<Array<{ agentId: string; count: number }>> {
  const { data } = await getAdminClient()
    .from('agent_decision_memory')
    .select('agent_id')
    .eq('user_id', userId);
  const counts = new Map<string, number>();
  for (const r of ((data as any) || []) as Array<{ agent_id: string }>) {
    counts.set(r.agent_id, (counts.get(r.agent_id) || 0) + 1);
  }
  return Array.from(counts.entries()).map(([agentId, count]) => ({ agentId, count }));
}

/** Lightweight per-session stats. */
export async function getSessionStats(userId: string): Promise<{
  totalSessions: number;
  totalMessages: number;
  totalDecisions: number;
}> {
  const adminDb = getAdminClient();
  const [{ count: sessions }, { count: messages }, { count: decisions }] = await Promise.all([
    adminDb.from('war_room_sessions').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    adminDb.from('war_room_conversations').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    adminDb.from('agent_decision_memory').select('id', { count: 'exact', head: true }).eq('user_id', userId),
  ]) as any[];
  return {
    totalSessions: (sessions as number) || 0,
    totalMessages: (messages as number) || 0,
    totalDecisions: (decisions as number) || 0,
  };
}

/** Bulk-load personalities for the frontend. */
export async function listPersonalities(): Promise<Personality[]> {
  const { data } = await getAdminClient()
    .from('agent_personalities')
    .select('*')
    .order('table_seat', { ascending: true });
  return (((data as any) || []) as any[]).map((d) => ({
    ...d,
    catchphrases_ar: Array.isArray(d.catchphrases_ar) ? d.catchphrases_ar : null,
    catchphrases_en: Array.isArray(d.catchphrases_en) ? d.catchphrases_en : null,
    expressions: Array.isArray(d.expressions) ? d.expressions : ['neutral'],
  })) as Personality[];
}
