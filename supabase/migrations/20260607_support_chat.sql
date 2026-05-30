-- ============================================================
-- 20260607_support_chat.sql
-- Customer-service chat backend (Part 1). Cost-controlled engine:
-- FAQ-first (zero AI), then AI capped per conversation, then human handoff.
-- Reuses the existing `notifications` table for admin cap-hit alerts.
-- (Already applied to the live DB via Supabase migrations
--  `support_chat_backend` + `support_faqs_seed`; this file is the tracked,
--  reproducible source of truth.)
-- ============================================================

-- 1) Saved FAQ entries (bilingual). FAQ-first = zero AI cost.
create table if not exists public.support_faqs (
  id            uuid primary key default gen_random_uuid(),
  question_ar   text    not null,
  question_en   text    not null,
  answer_ar     text    not null,
  answer_en     text    not null,
  keywords      text[]  not null default '{}',
  audience      text    not null default 'all'
                  check (audience in ('all','visitor','user')),
  display_order integer not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists support_faqs_active_order_idx
  on public.support_faqs (is_active, display_order);

-- 2) One conversation (visitor OR logged-in user).
create table if not exists public.support_conversations (
  id              uuid primary key default gen_random_uuid(),
  mode            text not null check (mode in ('visitor','user')),
  user_id         uuid references auth.users(id) on delete set null,  -- nullable: visitors have none
  status          text not null default 'active'
                    check (status in ('active','awaiting_admin','closed')),
  ai_reply_count  integer not null default 0,     -- SERVER-SIDE cost counter
  allow_extended  boolean not null default false, -- admin flag → raises cap to 20 for users
  visitor_id      text,                           -- opaque client-generated id (anti-abuse)
  last_message_at timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists support_conversations_status_idx on public.support_conversations (status);
create index if not exists support_conversations_user_idx   on public.support_conversations (user_id);

-- 3) Every message in a conversation (full transcript for Admin in Part 2).
create table if not exists public.support_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.support_conversations(id) on delete cascade,
  role            text not null check (role in ('user','assistant','admin')),
  source          text not null check (source in ('user','faq','ai','handoff','admin')),
  content         text not null,
  faq_id          uuid references public.support_faqs(id) on delete set null,
  created_at      timestamptz not null default now()
);
create index if not exists support_messages_conversation_idx
  on public.support_messages (conversation_id, created_at);

-- ── RLS ──────────────────────────────────────────────────────────────
-- Server uses the SERVICE ROLE key (bypasses RLS) for all writes; these
-- policies are defense-in-depth and lock down the anon key.
alter table public.support_faqs          enable row level security;
alter table public.support_conversations enable row level security;
alter table public.support_messages      enable row level security;

drop policy if exists support_faqs_read_active on public.support_faqs;
create policy support_faqs_read_active on public.support_faqs
  for select using (is_active = true);

drop policy if exists support_conversations_owner on public.support_conversations;
create policy support_conversations_owner on public.support_conversations
  for select using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
  );

drop policy if exists support_messages_via_conversation on public.support_messages;
create policy support_messages_via_conversation on public.support_messages
  for select using (
    exists (
      select 1 from public.support_conversations c
      where c.id = conversation_id
        and (
          c.user_id = auth.uid()
          or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
        )
    )
  );

-- ── Seed: starter FAQ entries (audience 'all') ───────────────────────
-- Keywords are SPECIFIC terms only — generic interrogatives (كم/ما/how/what…)
-- are intentionally excluded so a single common word can't absorb an
-- off-topic question into the FAQ path (the engine also stopword-guards them).
insert into public.support_faqs (question_ar, question_en, answer_ar, answer_en, keywords, display_order)
select * from (values
  ('ما هو وصل؟',
   'What is Wassel?',
   'وصل رفيقك المهني الذي يساعدك على تحليل ملفك المهني، وكتابة سيرتك الذاتية ومحتواك المهني، وتطوير حضورك خطوة بخطوة. كل ذلك بالعربية أولاً.',
   'Wassel is your career companion. It helps you analyze your professional profile, craft your resume and professional content, and grow your presence step by step — Arabic-first.',
   array['وصل','what','wassel','about','ماهو','ما هو','تعريف'], 1),
  ('كم تكلفة وصل وما هي الباقات؟',
   'How much does Wassel cost and what are the plans?',
   'تبدأ التجربة مجاناً مع باقة "استكشف". وتتوفر باقة "الانطلاق" بـ 199 ريالاً شهرياً، وباقة "النمو" بـ 399 ريالاً شهرياً، إضافة إلى حلول مخصصة للمؤسسات. يمكنك الاطلاع على التفاصيل في صفحة الباقات.',
   'You can start free with the Explore plan. Starter is 199 SAR/month, Growth is 399 SAR/month, and custom Enterprise solutions are available. See the Plans page for details.',
   array['سعر','تكلفة','باقات','باقة','price','pricing','plans','cost','اشتراك'], 2),
  ('كيف تعمل النقاط (التوكنز)؟',
   'How do tokens work?',
   'النقاط هي وحدة الاستخدام في وصل. تمنحك كل باقة رصيداً شهرياً من النقاط، وتُستهلك مع كل عملية مثل تحليل الملف أو إنشاء محتوى. يمكنك متابعة رصيدك في أي وقت من لوحتك.',
   'Tokens are the usage unit in Wassel. Each plan grants a monthly token balance, and tokens are consumed per action — like analyzing your profile or generating content. You can track your balance anytime in your dashboard.',
   array['نقاط','توكن','توكنز','رصيد','token','tokens','credits','استخدام'], 3),
  ('هل بياناتي آمنة؟',
   'Is my data safe?',
   'نعم. نلتزم بحماية بياناتك وفق نظام حماية البيانات الشخصية (PDPL). بياناتك ملك لك، ويمكنك تصديرها أو حذفها في أي وقت من إعدادات الخصوصية.',
   'Yes. We protect your data in line with the Personal Data Protection Law (PDPL). Your data belongs to you — you can export or delete it anytime from Privacy settings.',
   array['بيانات','خصوصية','آمن','أمان','data','privacy','safe','pdpl','حماية'], 4),
  ('كيف أبدأ؟',
   'How do I start?',
   'ابدأ بإنشاء حساب مجاني، ثم أكمل ملفك المهني في خطوات بسيطة. بعدها يرشدك وصل إلى أول خطوة مناسبة لهدفك المهني.',
   'Start by creating a free account, then complete your career profile in a few simple steps. Wassel will then guide you to the right first step for your goal.',
   array['ابدأ','بداية','تسجيل','حساب','start','begin','signup','register'], 5)
) as v(question_ar, question_en, answer_ar, answer_en, keywords, display_order)
where not exists (select 1 from public.support_faqs);
