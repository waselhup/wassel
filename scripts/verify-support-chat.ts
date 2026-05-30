/**
 * verify-support-chat.ts — proves the cost-control cap is enforced SERVER-SIDE.
 *
 * Runs the real engine (server/_core/lib/support-engine.ts) against the live DB
 * with the service-role client. No browser, no UI.
 *
 * Scenario (visitor, cap = 5):
 *   (a) an FAQ-matching question  → source:'faq', ai_reply_count unchanged (0 AI)
 *   (b) 5 off-FAQ questions       → source:'ai', counter increments 1..5
 *   (c) the 6th off-FAQ question  → source:'handoff', status 'awaiting_admin',
 *                                   + an admin notification row created, NO AI
 *
 * It re-reads ai_reply_count straight from the DB at the end to prove the count
 * is persisted server-side (not a client-tracked number), then cleans up.
 *
 * Build + run (bundled, mirrors production):
 *   npx esbuild scripts/verify-support-chat.ts --platform=node --bundle \
 *     --format=cjs --outfile=.tmp-verify/verify-support.cjs <canvas externals>
 *   node .tmp-verify/verify-support.cjs
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import * as eng from '../server/_core/lib/support-engine';

// CWD is the project root when run from there.
const ROOT = process.cwd();

// ── Load env from the local backup file (values stay on disk, never printed). ──
function loadEnv(file: string): void {
  let raw = '';
  try {
    raw = readFileSync(file, 'utf8');
  } catch {
    return;
  }
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let val = m[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[m[1]]) process.env[m[1]] = val;
  }
}
loadEnv(join(ROOT, '.env.local.backup-20260418213218'));

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in env.');
  process.exit(1);
}
console.log('ANTHROPIC_API_KEY present:', !!process.env.ANTHROPIC_API_KEY);

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Stub the AI generator (no live key needed). This exercises the REAL
//    counter-increment + cap + handoff + admin-notify DB logic; only the text
//    of the reply is canned. Set VERIFY_LIVE_AI=1 to use the real Claude call.
let aiCalls = 0;
if (process.env.VERIFY_LIVE_AI !== '1') {
  eng.__setAiReplyGeneratorForTests(async ({ message }) => {
    aiCalls += 1;
    return { reply: `رد تجريبي رقم ${aiCalls} على: ${message.slice(0, 24)}…`, language: 'ar' };
  });
  console.log('AI generator: STUBBED (canned replies; proves cap logic without a live key)');
} else {
  console.log('AI generator: LIVE (real Claude Haiku calls)');
}

function line(label: string, value: unknown) {
  console.log(`  ${label.padEnd(22)} ${String(value)}`);
}

async function main() {
  console.log('\n=== Support-chat server-side cap verification ===\n');

  const { data: adminsBefore } = await supabase.from('profiles').select('id').eq('is_admin', true);
  const adminIds = (adminsBefore ?? []).map((a: { id: string }) => a.id);
  const { count: notifBefore } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('template_key', 'support_handoff');
  console.log(`Admins found: ${adminIds.length} | existing support_handoff notifications: ${notifBefore ?? 0}\n`);

  // ── start a VISITOR conversation ──────────────────────────────────
  const conv = await eng.startConversation(supabase, { mode: 'visitor', visitorId: 'verify-script' });
  console.log(`Started visitor conversation: ${conv.id}`);
  line('cap (visitor)', eng.resolveCap(conv));
  line('initial ai_reply_count', conv.ai_reply_count);

  const sources: string[] = [];

  // (a) FAQ-matching question — should be source:'faq', no AI.
  console.log('\n(a) FAQ-matching question: "ما هو وصل؟"');
  const r0 = await eng.sendMessage(supabase, { conversationId: conv.id, message: 'ما هو وصل؟' });
  line('source', r0.source);
  line('ai_reply_count', r0.aiReplyCount);
  line('faqId', r0.faqId);
  sources.push(r0.source);

  // (b) 5 off-FAQ questions — should be source:'ai', counter 1..5.
  console.log('\n(b) 5 off-FAQ questions (expect source:ai, counter 1..5):');
  const offFaq = [
    'هل تنصحني بتغيير مجال عملي من المحاسبة إلى تطوير المنتجات؟',
    'كم متوسط راتب مدير المنتج في القطاع المصرفي السعودي؟',
    'ما رأيك في مهاراتي إذا كنت أعمل في خدمة العملاء منذ سنتين؟',
    'هل أحتاج شهادة احترافية معينة لأصبح محلل أعمال؟',
    'ما الفرق بين دور محلل البيانات ومهندس البيانات من حيث المهام اليومية؟',
  ];
  for (let i = 0; i < offFaq.length; i++) {
    const r = await eng.sendMessage(supabase, { conversationId: conv.id, message: offFaq[i] });
    console.log(`  #${i + 1}: source=${r.source}  ai_reply_count=${r.aiReplyCount}  status=${r.status}`);
    sources.push(r.source);
  }

  // (c) 6th off-FAQ question — cap reached → handoff, no AI, admin notified.
  console.log('\n(c) 6th off-FAQ question (expect source:handoff, status awaiting_admin):');
  const r6 = await eng.sendMessage(supabase, {
    conversationId: conv.id,
    message: 'وهل يمكنك ترشيح وظائف شاغرة لي بشكل مباشر الآن؟',
  });
  line('source', r6.source);
  line('ai_reply_count', r6.aiReplyCount);
  line('status', r6.status);
  line('capReached', r6.capReached);
  line('reply (preview)', r6.reply.slice(0, 60) + '…');
  sources.push(r6.source);

  // ── Re-read the counter STRAIGHT FROM THE DB (proves server-side) ──
  const { data: dbConv } = await supabase
    .from('support_conversations')
    .select('ai_reply_count, status')
    .eq('id', conv.id)
    .single();
  console.log('\n--- Re-read from DB (server-side source of truth) ---');
  line('db ai_reply_count', dbConv?.ai_reply_count);
  line('db status', dbConv?.status);

  // ── New admin notification created? ───────────────────────────────
  const { count: notifAfter } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('template_key', 'support_handoff');
  const newNotifs = (notifAfter ?? 0) - (notifBefore ?? 0);
  console.log('\n--- Admin notification on handoff ---');
  line('new support_handoff rows', newNotifs);

  // ── Message transcript persisted? ─────────────────────────────────
  const { data: msgs } = await supabase
    .from('support_messages')
    .select('role, source')
    .eq('conversation_id', conv.id)
    .order('created_at', { ascending: true });
  console.log('\n--- Persisted transcript (role:source) ---');
  console.log('  ' + (msgs ?? []).map((m: any) => `${m.role}:${m.source}`).join('  '));

  // ── Assertions ────────────────────────────────────────────────────
  console.log('\n=== RESULT ===');
  const checks: Array<[string, boolean]> = [
    ['(a) first answer source === faq', sources[0] === 'faq'],
    ['(b) five AI replies', sources.slice(1, 6).every((s) => s === 'ai')],
    ['(c) sixth reply is handoff', sources[6] === 'handoff'],
    ['counter stopped at 5 (cap)', dbConv?.ai_reply_count === 5],
    ['status === awaiting_admin', dbConv?.status === 'awaiting_admin'],
    ['admin notification created', newNotifs >= 1],
  ];
  if (process.env.VERIFY_LIVE_AI !== '1') {
    // The AI generator must have fired exactly 5× (turns 1-5) and NOT on the
    // 6th/handoff turn — direct proof the cap gates the spend, not the client.
    checks.push(['AI invoked exactly 5x (not on handoff)', aiCalls === 5]);
  }
  let allPass = true;
  for (const [label, ok] of checks) {
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`);
    if (!ok) allPass = false;
  }
  console.log(`\n  sources sequence: [${sources.join(', ')}]`);

  // ── Cleanup: remove the test conversation + its admin notifications ──
  await supabase.from('support_conversations').delete().eq('id', conv.id); // cascades messages
  await supabase
    .from('notifications')
    .delete()
    .eq('template_key', 'support_handoff')
    .contains('metadata', { conversation_id: conv.id });
  console.log('\n  (cleaned up test conversation + its handoff notifications)');

  console.log(`\n${allPass ? '✅ ALL CHECKS PASSED' : '❌ SOME CHECKS FAILED'}\n`);
  process.exit(allPass ? 0 : 1);
}

main().catch((e) => {
  console.error('verify-support-chat failed:', e);
  process.exit(1);
});
