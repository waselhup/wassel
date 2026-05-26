import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Globe } from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import { WasselLogo } from '@/components/WasselLogo';
import UserAvatar from '@/components/UserAvatar';
import { trpc } from '@/lib/trpc';

import RoomScene from './components/RoomScene';
import AgentPortrait, { AGENT_COLORS, type Expression } from './components/AgentPortrait';
import SpeechBubble from './components/SpeechBubble';
import ProjectorScreen, { type ProjectorContent } from './components/ProjectorScreen';
import ChatInput from './components/ChatInput';
import MorningBriefSequence, { type MorningBriefItem } from './components/MorningBriefSequence';
import DecisionMemoryBadge from './components/DecisionMemoryBadge';
import WeeklyJournalCard from './components/WeeklyJournalCard';

type Personality = {
  agent_id: string;
  age: number;
  speech_style_ar: string;
  speech_style_en: string;
  catchphrases_ar: string[] | null;
  catchphrases_en: string[] | null;
  expressions: string[];
  default_expression: string;
  table_seat: number;
  voice_pitch: number;
  voice_rate: number;
  signature_animation: string | null;
  system_prompt_extension_ar: string;
  system_prompt_extension_en: string;
};

const AGENT_NAMES_AR: Record<string, string> = {
  faris: 'فارس', sayed: 'سيد', al_mukhadram: 'المخضرم', hassan: 'حسن',
  fatima: 'فاطمة', dhai: 'ضي', hussein: 'حسين', mohammed: 'محمد',
};
const AGENT_NAMES_EN: Record<string, string> = {
  faris: 'Faris', sayed: 'Sayed', al_mukhadram: 'Al-Mukhadram', hassan: 'Hassan',
  fatima: 'Fatima', dhai: 'Dhai', hussein: 'Hussein', mohammed: 'Mohammed',
};

interface ActiveBubble {
  agentId: string;
  message: string;
  expression: Expression;
  timestamp: string;
  // unique id to allow stacking same agent multiple times
  uid: string;
}

export default function WarRoom() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const language = (i18n.language === 'en' ? 'en' : 'ar') as 'ar' | 'en';

  const [personalities, setPersonalities] = useState<Personality[]>([]);
  const [memoryCounts, setMemoryCounts] = useState<Record<string, number>>({});
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const [bubbles, setBubbles] = useState<ActiveBubble[]>([]);
  const [projector, _setProjector] = useState<ProjectorContent | null>(null);
  const [sending, setSending] = useState(false);
  const [briefDone, setBriefDone] = useState(false);

  const bubbleTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Load personalities once + start a session
  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        const [pRes, mRes, sRes] = await Promise.all([
          trpc.warRoom.getPersonalities(),
          trpc.warRoom.agentMemoryStats(),
          trpc.warRoom.startSession({ language }),
        ]);
        if (cancelled) return;
        setPersonalities((pRes?.personalities as any) || []);
        const counts: Record<string, number> = {};
        for (const c of (mRes?.counts || []) as Array<{ agentId: string; count: number }>) {
          counts[c.agentId] = c.count;
        }
        setMemoryCounts(counts);
        setSessionId(sRes?.sessionId || null);
      } catch (err: any) {
        console.error('[war-room] boot failed:', err?.message || err);
      }
    }
    boot();

    return () => {
      cancelled = true;
      // End session on unmount (fire-and-forget)
      if (sessionId) trpc.warRoom.endSession({ sessionId }).catch(() => {});
      // Clear pending bubble timers
      Object.values(bubbleTimers.current).forEach((t) => clearTimeout(t));
      bubbleTimers.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const personalityBySeat = useMemo(() => {
    const m: Record<number, Personality> = {};
    for (const p of personalities) m[p.table_seat] = p;
    return m;
  }, [personalities]);

  const personalityByAgent = useMemo(() => {
    const m: Record<string, Personality> = {};
    for (const p of personalities) m[p.agent_id] = p;
    return m;
  }, [personalities]);

  const activeSeat = activeAgent ? personalityByAgent[activeAgent]?.table_seat ?? null : null;

  function pushBubble(b: { agentId: string; message: string; expression: string }) {
    const uid = `${b.agentId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const bubble: ActiveBubble = {
      agentId: b.agentId,
      message: b.message,
      expression: (b.expression as Expression) || 'neutral',
      timestamp: new Date().toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      uid,
    };
    setBubbles((prev) => [...prev.filter((x) => x.agentId !== b.agentId), bubble]);
    // Auto-dismiss after 14s
    if (bubbleTimers.current[uid]) clearTimeout(bubbleTimers.current[uid]);
    bubbleTimers.current[uid] = setTimeout(() => {
      setBubbles((prev) => prev.filter((x) => x.uid !== uid));
      delete bubbleTimers.current[uid];
    }, 14000);
  }

  function handleBrief(b: MorningBriefItem) {
    pushBubble(b);
  }

  async function handleSend(message: string) {
    if (!sessionId) return;
    if (sending) return;
    setSending(true);
    // Optimistically show Ali's message — we render Ali bubbles in the chat
    // log section (bottom) rather than the room scene.
    try {
      const res = await trpc.warRoom.sendMessage({ sessionId, message, language });
      for (const reply of res?.replies || []) {
        setActiveAgent(reply.agentId);
        pushBubble(reply);
        // Slight stagger so multiple agents don't all glow at once
        await new Promise((r) => setTimeout(r, 600));
      }
      setActiveAgent(null);

      // Refresh memory counts (cheap)
      trpc.warRoom
        .agentMemoryStats()
        .then((m) => {
          const counts: Record<string, number> = {};
          for (const c of (m?.counts || []) as Array<{ agentId: string; count: number }>) {
            counts[c.agentId] = c.count;
          }
          setMemoryCounts(counts);
        })
        .catch(() => {});
    } catch (err: any) {
      console.error('[war-room] send failed:', err?.message || err);
    } finally {
      setSending(false);
    }
  }

  function handleQuick(key: 'morning_brief' | 'approve_safe' | 'show_yesterday') {
    if (key === 'morning_brief') {
      const msg = language === 'ar' ? 'صباح الخير، أعطني brief.' : 'Good morning, give me a brief.';
      handleSend(msg);
    } else if (key === 'show_yesterday') {
      handleSend(language === 'ar' ? 'أرني ماذا حدث أمس.' : 'Show me what happened yesterday.');
    } else {
      handleSend(language === 'ar' ? 'وافق على كل الآمن من قائمة الموافقات.' : 'Approve all safe items in the queue.');
    }
  }

  function toggleLang() {
    const next = language === 'ar' ? 'en' : 'ar';
    i18n.changeLanguage(next);
    document.documentElement.lang = next;
    document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr';
  }

  return (
    <div
      dir={language === 'ar' ? 'rtl' : 'ltr'}
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: '#020617',
        fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
        overflow: 'hidden',
      }}
    >
      {/* Header — sticky, slim */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: 'rgba(2, 6, 23, 0.78)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(148, 163, 184, 0.18)',
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
          <Link href="/v2/home">
            <a style={{ display: 'inline-flex', alignItems: 'center' }} aria-label="Back home">
              <WasselLogo size={24} />
            </a>
          </Link>
          <span style={{ width: 1, height: 22, background: 'rgba(148,163,184,0.3)' }} aria-hidden />
          <div>
            <div style={{ color: '#F8FAFC', fontWeight: 800, fontSize: 14 }}>
              {t('warRoom.title', { defaultValue: language === 'ar' ? 'غرفة القيادة' : 'War Room' })}
            </div>
            <div style={{ color: '#94A3B8', fontSize: 11 }}>
              {t('warRoom.subtitle', { defaultValue: language === 'ar' ? '8 وكلاء جاهزون للعمل' : '8 agents ready to work' })}
            </div>
          </div>
        </div>

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={toggleLang}
            aria-label="toggle language"
            style={{
              padding: '6px 10px',
              borderRadius: 8,
              background: 'rgba(30, 41, 59, 0.7)',
              border: '1px solid rgba(148,163,184,0.25)',
              color: '#E2E8F0',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 12,
            }}
          >
            <Globe size={12} />
            {language === 'ar' ? 'EN' : 'AR'}
          </button>
          <Link href="/v2/home">
            <a
              style={{
                padding: '6px 10px',
                borderRadius: 8,
                background: 'rgba(30, 41, 59, 0.7)',
                border: '1px solid rgba(148,163,184,0.25)',
                color: '#E2E8F0',
                fontSize: 12,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                textDecoration: 'none',
              }}
            >
              <ArrowLeft size={12} style={language === 'ar' ? { transform: 'scaleX(-1)' } : undefined} />
              {language === 'ar' ? 'لوحة المستخدم' : 'User app'}
            </a>
          </Link>
          {user && <UserAvatar />}
        </div>
      </header>

      {/* Room scene — fills remaining height */}
      <div style={{ flex: 1, position: 'relative', minHeight: '70vh' }}>
        <RoomScene
          activeSeat={activeSeat}
          projector={projector ? <ProjectorScreen content={projector} language={language} /> : null}
          renderSeat={(seat) => {
            const p = personalityBySeat[seat];
            if (!p) {
              return (
                <div
                  style={{
                    width: 84,
                    height: 84,
                    borderRadius: '50%',
                    background: 'rgba(30, 41, 59, 0.5)',
                    border: '1px dashed rgba(148, 163, 184, 0.3)',
                  }}
                />
              );
            }
            const isActive = activeAgent === p.agent_id;
            const bubble = bubbles.find((b) => b.agentId === p.agent_id);
            const count = memoryCounts[p.agent_id] || 0;
            return (
              <div style={{ position: 'relative' }}>
                <AnimatePresence>
                  {bubble && (
                    <div
                      key={bubble.uid}
                      style={{
                        position: 'absolute',
                        bottom: 'calc(100% + 12px)',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 50,
                      }}
                    >
                      <SpeechBubble
                        text={bubble.message}
                        language={language}
                        expression={bubble.expression}
                        timestamp={bubble.timestamp}
                        voicePitch={p.voice_pitch}
                        voiceRate={p.voice_rate}
                        anchor="top"
                      />
                    </div>
                  )}
                </AnimatePresence>
                <AgentPortrait
                  agentId={p.agent_id}
                  nameAr={AGENT_NAMES_AR[p.agent_id] || p.agent_id}
                  nameEn={AGENT_NAMES_EN[p.agent_id] || p.agent_id}
                  age={p.age}
                  language={language}
                  expression={
                    (bubble?.expression || p.default_expression || 'neutral') as Expression
                  }
                  status={isActive ? 'speaking' : sending ? 'thinking' : 'idle'}
                  signatureAnimation={p.signature_animation}
                  accentColor={AGENT_COLORS[p.agent_id]}
                />
                <DecisionMemoryBadge
                  agentId={p.agent_id}
                  count={count}
                  language={language}
                  accentColor={AGENT_COLORS[p.agent_id]}
                />
              </div>
            );
          }}
        />

        {/* Weekly journal — floats at left under header */}
        <div
          style={{
            position: 'absolute',
            top: 16,
            insetInlineStart: 16,
            width: 'min(320px, 40vw)',
            zIndex: 20,
          }}
        >
          <WeeklyJournalCard language={language} />
        </div>

        {/* Morning brief driver — invisible */}
        {sessionId && !briefDone && (
          <MorningBriefSequence
            sessionId={sessionId}
            language={language}
            onFocusAgent={setActiveAgent}
            onBrief={handleBrief}
            onComplete={() => setBriefDone(true)}
          />
        )}
      </div>

      {/* Chat input — sticks to bottom */}
      <div style={{ position: 'sticky', bottom: 0, zIndex: 90 }}>
        <ChatInput
          language={language}
          disabled={!sessionId || sending}
          onSend={handleSend}
          onQuickAction={handleQuick}
        />
      </div>

      {/* Subtle "sending" overlay */}
      <AnimatePresence>
        {sending && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              top: 64,
              insetInlineEnd: 16,
              padding: '6px 12px',
              borderRadius: 999,
              background: 'rgba(20, 184, 166, 0.18)',
              color: '#5EEAD4',
              fontSize: 11,
              fontWeight: 700,
              zIndex: 200,
            }}
          >
            {t('warRoom.thinking', { defaultValue: language === 'ar' ? 'الفريق يفكر...' : 'Team is thinking...' })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
