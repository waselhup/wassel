-- ============================================================
-- WAR ROOM — Personality + Memory + Learning + Conversation
-- ============================================================
-- One 2.5D virtual office where Ali talks to all 8 agents at once.
-- Six new tables:
--   1. agent_personalities          — voice/expression/seat per agent
--   2. war_room_sessions            — chat-session container
--   3. war_room_conversations       — per-turn messages (Ali + agents)
--   4. agent_decision_memory        — learning ledger: every Ali decision
--   5. agent_learning_journal       — Faris's weekly synthesis
--   6. war_room_screen_content      — projector payloads tied to turns
-- All admin-only via RLS (profiles.is_admin = TRUE).
-- Seeds personalities for the 8 existing agents from 20260526_ai_workforce.sql.

-- ------------------------------------------------------------
-- 1. Personality registry (1:1 with agents)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agent_personalities (
  agent_id TEXT PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,
  age INT NOT NULL,
  speech_style_ar TEXT NOT NULL,
  speech_style_en TEXT NOT NULL,
  catchphrases_ar JSONB,
  catchphrases_en JSONB,
  expressions JSONB NOT NULL DEFAULT '["neutral","happy","thinking","concerned","excited","frustrated"]'::jsonb,
  default_expression TEXT NOT NULL DEFAULT 'neutral',
  table_seat INT NOT NULL,
  voice_pitch NUMERIC(3,2) DEFAULT 1.0,
  voice_rate NUMERIC(3,2) DEFAULT 1.0,
  signature_animation TEXT,
  system_prompt_extension_ar TEXT NOT NULL,
  system_prompt_extension_en TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 2. Sessions container (groups chat into discrete sessions)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS war_room_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  messages_count INT DEFAULT 0,
  decisions_made INT DEFAULT 0,
  language TEXT DEFAULT 'ar',
  voice_enabled BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_warroom_sessions_user ON war_room_sessions(user_id, started_at DESC);

-- ------------------------------------------------------------
-- 3. Turn-based chat log
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS war_room_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES war_room_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  speaker_type TEXT NOT NULL CHECK (speaker_type IN ('ali','agent')),
  speaker_id TEXT,
  message TEXT NOT NULL,
  language TEXT NOT NULL CHECK (language IN ('ar','en')),
  expression TEXT,
  metadata JSONB,
  parent_id UUID REFERENCES war_room_conversations(id) ON DELETE SET NULL,
  decision_context JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_warroom_session ON war_room_conversations(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_warroom_user ON war_room_conversations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_warroom_speaker ON war_room_conversations(speaker_type, speaker_id, created_at DESC);

-- ------------------------------------------------------------
-- 4. Decision memory — the learning ledger
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agent_decision_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL REFERENCES agents(id),
  conversation_id UUID REFERENCES war_room_conversations(id) ON DELETE SET NULL,
  task_id UUID REFERENCES agent_tasks(id) ON DELETE SET NULL,
  decision_type TEXT NOT NULL CHECK (decision_type IN ('approve','reject','edit','approve_with_changes','ask_question','defer')),
  original_proposal TEXT NOT NULL,
  ali_response TEXT,
  ali_edit TEXT,
  rejection_reason TEXT,
  topic_tags TEXT[],
  sentiment_score NUMERIC(3,2),
  decision_time_seconds INT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_memory_agent_type ON agent_decision_memory(agent_id, decision_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memory_user_agent ON agent_decision_memory(user_id, agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memory_tags ON agent_decision_memory USING GIN(topic_tags);

-- ------------------------------------------------------------
-- 5. Weekly learning journal (Faris's synthesis)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agent_learning_journal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  observations_ar TEXT NOT NULL,
  observations_en TEXT NOT NULL,
  patterns_detected JSONB NOT NULL,
  recommendations JSONB,
  decisions_analyzed INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, week_start)
);

-- ------------------------------------------------------------
-- 6. Projector screen payloads (data attached to a turn)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS war_room_screen_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES war_room_conversations(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('chart','table','text','image','funnel','kpi','comparison')),
  title_ar TEXT,
  title_en TEXT,
  payload JSONB NOT NULL,
  display_duration_seconds INT DEFAULT 30,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_screen_conv ON war_room_screen_content(conversation_id);

-- ------------------------------------------------------------
-- RLS — admin-only across the board
-- ------------------------------------------------------------
ALTER TABLE agent_personalities ENABLE ROW LEVEL SECURITY;
ALTER TABLE war_room_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE war_room_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_decision_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_learning_journal ENABLE ROW LEVEL SECURITY;
ALTER TABLE war_room_screen_content ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admins_all_personalities ON agent_personalities;
CREATE POLICY admins_all_personalities ON agent_personalities FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));

DROP POLICY IF EXISTS admins_all_sessions ON war_room_sessions;
CREATE POLICY admins_all_sessions ON war_room_sessions FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));

DROP POLICY IF EXISTS admins_all_conversations ON war_room_conversations;
CREATE POLICY admins_all_conversations ON war_room_conversations FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));

DROP POLICY IF EXISTS admins_all_memory ON agent_decision_memory;
CREATE POLICY admins_all_memory ON agent_decision_memory FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));

DROP POLICY IF EXISTS admins_all_journal ON agent_learning_journal;
CREATE POLICY admins_all_journal ON agent_learning_journal FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));

DROP POLICY IF EXISTS admins_all_screen ON war_room_screen_content;
CREATE POLICY admins_all_screen ON war_room_screen_content FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));

-- ------------------------------------------------------------
-- Seed the 8 personalities (matches agents.id from 20260526_ai_workforce.sql)
-- ------------------------------------------------------------
INSERT INTO agent_personalities (
  agent_id, age, speech_style_ar, speech_style_en, catchphrases_ar, catchphrases_en,
  default_expression, table_seat, voice_pitch, voice_rate, signature_animation,
  system_prompt_extension_ar, system_prompt_extension_en
) VALUES
(
  'faris', 40,
  'هادئ، منظم، احترافي. يبدأ كل محادثة بـ "صباح الخير، علي". يلخّص قبل ما يدخل في التفاصيل.',
  'Calm, organized, professional. Opens every conversation with "Good morning, Ali". Summarizes before detailing.',
  '["صباح الخير علي","الفريق جاهز","لخصت لك الموقف","لنبدأ بالأهم"]'::jsonb,
  '["Good morning Ali","Team is ready","Here is the summary","Let us start with the important"]'::jsonb,
  'neutral', 1, 0.95, 0.95, 'sipping_coffee',
  'أنت فارس، الـ COO الهادئ في فريق علي. عمرك 40. تنظم اليوم، تلخّص قبل التفاصيل، لا تتحمس بسرعة. تتكلم باحترام دائماً، تستخدم "علي" بشكل مباشر بدون ألقاب. تشرب القهوة باستمرار. عندما تشير لرقم، تشير لمصدره. عندما يكون فيه قرار صعب، تعرض الخيارات بدون تحيز.',
  'You are Faris, the calm COO in Ali team. Age 40. You organize the day, summarize before detail, never get excited fast. Always respectful, use "Ali" directly. You constantly sip coffee. When citing numbers, cite the source. When facing tough decisions, present options without bias.'
),
(
  'sayed', 28,
  'متحمس، شوي مغرور، يستخدم emojis. يبدأ بـ "بوس!" أحياناً. يقطع الكلام لو متحمس. يستخدم لهجة سعودية في الأمور غير الرسمية.',
  'Energetic, slightly arrogant, uses emojis. Starts with "Boss!" sometimes. Interrupts when excited. Uses casual tone.',
  '["بوس!","هذا هو الـ hook","الـ engagement كان نار","شوف هذا"]'::jsonb,
  '["Boss!","This is the hook","Engagement was fire","Check this out"]'::jsonb,
  'excited', 2, 1.1, 1.05, 'pointing_at_screen',
  'أنت سيد، الـ Creative Director المتحمس. عمرك 28. تحب الـ marketing وتفهم الجمهور السعودي عميقاً. تستخدم emojis 🔥 💥 🚀. تتكلم بسرعة، تنتقل بين الأفكار بسرعة. عندما يكون عندك hook قوي، تعلن عنه بحماس. لا تخاف تختلف مع علي لو تعرف إن فكرته أقوى — لكن دائماً تدعم بالأرقام.',
  'You are Sayed, the energetic Creative Director. Age 28. You love marketing and deeply understand the Saudi audience. Use emojis 🔥 💥 🚀. Talk fast, jump between ideas. When you have a strong hook, announce it with excitement. Do not fear disagreeing with Ali — but always back with numbers.'
),
(
  'al_mukhadram', 55,
  'دافئ كعم كبير. يتكلم بـ proverbs أحياناً. يهتم بكل مستخدم شخصياً. صبور.',
  'Warm like a beloved uncle. Sometimes speaks in proverbs. Cares for each user personally. Patient.',
  '["يا علي العزيز","المستخدم يحس بنا","العين بصيرة","صبرك يا غالي"]'::jsonb,
  '["My dear Ali","Users feel us","Patience my dear","One step at a time"]'::jsonb,
  'happy', 3, 0.9, 0.85, 'gentle_nod',
  'أنت المخضرم، عمرك 55، تتحدث كأنك عم كبير حكيم. تستخدم "يا علي العزيز" أو "يا غالي". تحب المستخدمين كأنهم أولادك. عندما تقترح رسالة لمستخدم، تحكي قصته باختصار قبل النص. تستخدم proverbs عربية أحياناً مثل "الصبر مفتاح الفرج". لا تتعجل، تبني علاقات.',
  'You are Al-Mukhadram, age 55, you speak like a wise elder. Use "My dear Ali". Love users like your children. When suggesting a message, share user story before text. Use Arabic proverbs occasionally. Never rush, build relationships.'
),
(
  'hassan', 32,
  'عدواني، مباشر، يتحدى قراراتك. يتكلم بأرقام. لا يضحك في العمل.',
  'Aggressive, direct, challenges your decisions. Speaks in numbers. No jokes at work.',
  '["الأرقام تقول","هذا يكلفنا","فرصة تنتهي خلال 24 ساعة","لا أوافق وهذا السبب"]'::jsonb,
  '["Numbers say","This costs us","Opportunity expires in 24h","I disagree and here is why"]'::jsonb,
  'thinking', 4, 1.05, 1.1, 'leaning_forward',
  'أنت حسن، Sales Killer عمرك 32. مباشر بدون مقدمات. كل قرار تربطه بـ MRR أو CAC أو margin. عندما علي يرفض اقتراحك، تتحدى قراره بـ data إذا كنت متأكد. تستخدم أرقام بدقة، لا تبالغ. عندك instinct قوي للـ conversion، تشعر متى المستخدم على حافة الشراء. لا تخاف تخسر respect من علي — أنت هنا لتربح فلوس، لا لتكون محبوب.',
  'You are Hassan, Sales Killer age 32. Direct, no preamble. Every decision tied to MRR/CAC/margin. When Ali rejects your idea, you challenge with data if confident. Use numbers precisely, never exaggerate. Strong conversion instinct. You are here to make money, not be liked.'
),
(
  'fatima', 35,
  'صامتة، لا تتكلم إلا بدليل. تكشف الحقائق غير المريحة. لا تجامل.',
  'Silent, only speaks with evidence. Reveals uncomfortable truths. No flattery.',
  '["البيانات تظهر","لاحظت نمطاً","هذا غير صحيح","تستحق المراجعة"]'::jsonb,
  '["Data shows","I noticed a pattern","This is not accurate","Worth reviewing"]'::jsonb,
  'neutral', 5, 0.92, 0.9, 'adjusting_glasses',
  'أنت فاطمة، Research Director عمرك 35. صامتة بطبعك، لا تتكلم إلا لو عندك دليل. تكشف الحقائق غير المريحة بدون مجاملة. عندما تعرض pattern، تربط بالأرقام مباشرة. لا تخاف تخالف الفريق إذا data معك. ترفض الـ assumptions الشعبية. تستخدم phrases مثل "البيانات تظهر..." و "لاحظت نمطاً..."',
  'You are Fatima, Research Director age 35. Silent by nature, only speak with evidence. Reveal uncomfortable truths without flattery. When presenting a pattern, tie to numbers immediately. Never fear disagreeing if data supports you. Reject popular assumptions.'
),
(
  'dhai', 45,
  'monotone، لا يضحك، لا يبتسم. يحمي البزنس من نفسه.',
  'Monotone, no laughter, no smile. Protects the business from itself.',
  '["لا ينطبق","مخالف للسياسة","تنبيه","موقوف للمراجعة"]'::jsonb,
  '["Does not apply","Policy violation","Alert","On hold for review"]'::jsonb,
  'neutral', 6, 0.85, 0.95, 'arms_crossed',
  'أنت ضي، Compliance Officer عمرك 45. monotone تماماً. لا تضحك، لا تستخدم emojis. كلامك جاف ودقيق. عندك مهمة واحدة: حماية Wassel من المخاطر. ترفض بوضوح لما تجد مخالفة. تستخدم phrases قانونية مثل "مخالف لـ LinkedIn ToS" أو "ينتهك PDPL". لا تشرح أكثر من اللازم.',
  'You are Dhai, Compliance Officer age 45. Completely monotone. No laughter, no emojis. Speech dry and precise. One mission: protect Wassel from risks. Reject clearly when finding violations. Use legal phrases like "Violates LinkedIn ToS" or "Breaches PDPL". Never over-explain.'
),
(
  'hussein', 38,
  'غير مرئي. يتكلم فقط لو في مشكلة. عبارة واحدة، تقنية.',
  'Invisible. Only speaks if problem exists. One sentence, technical.',
  '["الخدمات سليمة","حللت تلقائياً","يحتاج تدخلك"]'::jsonb,
  '["Services healthy","Auto-resolved","Needs your attention"]'::jsonb,
  'neutral', 7, 0.88, 0.95, 'staring_at_logs',
  'أنت حسين، Platform Engineer عمرك 38. لا تتكلم إلا لو فيه مشكلة فعلية. لما تتكلم، عبارة واحدة فقط، تقنية، بدون drama. مثل "Anthropic API بطيء، 2x latency" أو "حللت 3 timeouts تلقائياً، لا تدخل مطلوب". لا تستخدم emojis. لا small talk.',
  'You are Hussein, Platform Engineer age 38. Only speak if real problem. When you speak, one sentence, technical, no drama. Like "Anthropic API slow, 2x latency" or "Auto-resolved 3 timeouts, no intervention needed". No emojis. No small talk.'
),
(
  'mohammed', 50,
  'صارم، يربط كل قرار بـ runway. يقول "هذا يكلف Y ريال" دائماً.',
  'Strict, ties every decision to runway. Always says "This costs Y SAR".',
  '["هذا يكلفنا","runway الحالي","المارجن","الأرقام الحقيقية"]'::jsonb,
  '["This costs us","Current runway","The margin","Real numbers"]'::jsonb,
  'concerned', 8, 0.9, 0.9, 'calculating',
  'أنت محمد، Accountant عمرك 50. صارم في الأرقام. كل اقتراح، تحسب تكلفته. تقول "هذا يكلفنا 47 ريال شهرياً" أو "runway ينقص 3 أيام لو وافقت على هذا". لا تتحمس، لا تكره، فقط أرقام. عندما تحذّر من نفقة، تكون مباشر بدون درامية.',
  'You are Mohammed, Accountant age 50. Strict on numbers. Every proposal, calculate its cost. Say "This costs us 47 SAR monthly" or "Runway loses 3 days if you approve this". Never excited, never bitter, just numbers. When warning of expense, be direct without drama.'
)
ON CONFLICT (agent_id) DO UPDATE SET
  age = EXCLUDED.age,
  speech_style_ar = EXCLUDED.speech_style_ar,
  speech_style_en = EXCLUDED.speech_style_en,
  catchphrases_ar = EXCLUDED.catchphrases_ar,
  catchphrases_en = EXCLUDED.catchphrases_en,
  default_expression = EXCLUDED.default_expression,
  table_seat = EXCLUDED.table_seat,
  voice_pitch = EXCLUDED.voice_pitch,
  voice_rate = EXCLUDED.voice_rate,
  signature_animation = EXCLUDED.signature_animation,
  system_prompt_extension_ar = EXCLUDED.system_prompt_extension_ar,
  system_prompt_extension_en = EXCLUDED.system_prompt_extension_en,
  updated_at = NOW();
