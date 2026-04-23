import React, { useEffect, useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  Sparkles, Copy, Trash2, FileText, Mic,
  Check, X, Loader2, Hash, ChevronDown, ChevronUp, Linkedin,
  Star, Plus, Wand2, Shield, Zap, Target, Users, Clock,
  Award, Eye, RefreshCw,
} from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import AIFeedbackWidget from '@/components/AIFeedbackWidget';
import UserAvatar from '@/components/UserAvatar';
import { trpc } from '@/lib/trpc';

// ===== Types =====
type PostStatus = 'draft' | 'scheduled' | 'posted';
type VariationId = 'safe' | 'balanced' | 'bold';
type LengthPref = 'short' | 'medium' | 'long';

type Tone =
  | 'professional' | 'friendly' | 'humorous' | 'humble' | 'bold'
  | 'analytical' | 'storytelling' | 'motivational' | 'sarcastic' | 'provocative';

type Dialect =
  | 'msa' | 'saudi-general'
  | 'saudi-najdi' | 'saudi-hijazi' | 'saudi-southern'
  | 'english' | 'mixed';

type Audience =
  | 'entrepreneurs' | 'employees' | 'hr-recruiters'
  | 'developers' | 'executives' | 'investors' | 'general';

type Goal =
  | 'thought-leadership' | 'lead-generation' | 'product-launch'
  | 'followers-growth' | 'share-experience' | 'announcement';

interface Variation {
  id: VariationId;
  label: string;
  content: string;
  charCount: number;
  hook: string;
  hashtags: string[];
}

interface GenerationResult {
  id: string;
  dna: {
    topic: string;
    tones: string[];
    dialect: string;
    language: string;
    audience: string;
    goal: string;
    length: string;
    dnaScore: number;
  };
  variations: Variation[];
  tips: string[];
  tokensUsed: number;
}

interface StyleSample {
  id: string;
  content: string;
  style_analysis: any;
  created_at: string;
}

interface Post {
  id: string;
  user_id: string;
  content: string;
  ai_generated: boolean;
  tone: string;
  language: string;
  hashtags: string[];
  status: PostStatus;
  created_at: string;
  tones?: string[];
  dialect?: string;
  topic?: string;
  variations?: Variation[];
  selected_variation?: VariationId;
}

// ===== Constants =====
const ALL_TONES: Tone[] = [
  'professional', 'friendly', 'humorous', 'humble', 'bold',
  'analytical', 'storytelling', 'motivational', 'sarcastic', 'provocative',
];

const ALL_DIALECTS: Dialect[] = [
  'msa', 'saudi-general',
  'saudi-najdi', 'saudi-hijazi', 'saudi-southern',
  'english', 'mixed',
];

const ALL_AUDIENCES: Audience[] = [
  'entrepreneurs', 'employees', 'hr-recruiters',
  'developers', 'executives', 'investors', 'general',
];

const ALL_GOALS: Goal[] = [
  'thought-leadership', 'lead-generation', 'product-launch',
  'followers-growth', 'share-experience', 'announcement',
];

const LENGTHS: LengthPref[] = ['short', 'medium', 'long'];
const TOKEN_COST = 30;

// ===== Toast =====
interface Toast { id: number; type: 'success' | 'error'; message: string; }

function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = (type: Toast['type'], message: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, type, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000);
  };
  const View = () => (
    <div style={{ position: 'fixed', top: 20, insetInlineEnd: 20, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40 }}
            style={{
              padding: '12px 18px', borderRadius: 12, minWidth: 260,
              background: t.type === 'success' ? '#ECFDF5' : '#FEF2F2',
              color: t.type === 'success' ? '#065F46' : '#991B1B',
              border: `1px solid ${t.type === 'success' ? '#A7F3D0' : '#FECACA'}`,
              boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
              fontFamily: 'Cairo, Inter, sans-serif', fontWeight: 700, fontSize: 13,
              display: 'flex', alignItems: 'center', gap: 10,
            }}
          >
            {t.type === 'success' ? <Check size={16} /> : <X size={16} />}
            {t.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
  return { push, View };
}

function relativeTime(iso: string, isAr: boolean): string {
  const d = new Date(iso).getTime();
  const now = Date.now();
  const s = Math.max(1, Math.floor((now - d) / 1000));
  if (isAr) {
    if (s < 60) return 'قبل لحظات';
    const m = Math.floor(s / 60); if (m < 60) return `منذ ${m} د`;
    const h = Math.floor(m / 60); if (h < 24) return `منذ ${h} س`;
    const dd = Math.floor(h / 24); if (dd < 7) return `منذ ${dd} يوم`;
    return new Date(iso).toLocaleDateString('ar-SA');
  }
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const dd = Math.floor(h / 24); if (dd < 7) return `${dd}d ago`;
  return new Date(iso).toLocaleDateString('en-US');
}

// ===== Main Page =====
export default function Posts() {
  const { t, i18n } = useTranslation();
  const { user, profile } = useAuth();
  const isAr = i18n.language === 'ar';
  const toast = useToast();

  // Studio state
  const [topic, setTopic] = useState('');
  const [selectedTones, setSelectedTones] = useState<Tone[]>(['professional']);
  const [dialect, setDialect] = useState<Dialect>('msa');
  const [language, setLanguage] = useState<'ar' | 'en' | 'mixed'>('ar');
  const [audience, setAudience] = useState<Audience | ''>('');
  const [goal, setGoal] = useState<Goal | ''>('');
  const [length, setLength] = useState<LengthPref>('medium');
  const [extras, setExtras] = useState({
    hashtags: true,
    callToAction: false,
    emojis: false,
    endingQuestion: false,
    personalStory: false,
  });
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Style samples
  const [useStyleSamples, setUseStyleSamples] = useState(false);
  const [showStyleDialog, setShowStyleDialog] = useState(false);
  const [styleSamples, setStyleSamples] = useState<StyleSample[]>([]);
  const [newSampleText, setNewSampleText] = useState('');
  const [addingSample, setAddingSample] = useState(false);

  // Inspiration
  const [inspirationUrl, setInspirationUrl] = useState('');
  const [inspirationPreview, setInspirationPreview] = useState<{
    title: string; source: string; preview: string;
  } | null>(null);
  const [previewingInspiration, setPreviewingInspiration] = useState(false);

  // Generation
  const [generating, setGenerating] = useState(false);
  const [generationResult, setGenerationResult] = useState<GenerationResult | null>(null);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [selectedVariation, setSelectedVariation] = useState<VariationId>('balanced');
  const [copiedId, setCopiedId] = useState<VariationId | null>(null);

  // Posts history
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);

  const loadingIntervalRef = useRef<number | null>(null);

  // ===== Effects =====
  useEffect(() => { void loadPosts(); void loadStyleSamples(); }, []);

  useEffect(() => {
    if (generating) {
      const messages = [
        t('posts.studio.generate.loading1'),
        t('posts.studio.generate.loading2'),
        t('posts.studio.generate.loading3'),
        t('posts.studio.generate.loading4'),
        t('posts.studio.generate.loading5'),
        t('posts.studio.generate.loading6'),
        t('posts.studio.generate.loading7'),
      ];
      setLoadingMsgIdx(0);
      loadingIntervalRef.current = window.setInterval(() => {
        setLoadingMsgIdx((i) => Math.min(i + 1, messages.length - 1));
      }, 6000);
      return () => {
        if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current);
      };
    }
    return undefined;
  }, [generating, t]);

  async function loadPosts() {
    setLoadingPosts(true);
    try {
      const data = await trpc.posts.list();
      setPosts(Array.isArray(data) ? (data as Post[]) : []);
    } catch (e: any) {
      console.error('[Posts] loadPosts error:', e?.message);
    }
    setLoadingPosts(false);
  }

  async function loadStyleSamples() {
    try {
      const data = await trpc.posts.listStyleSamples();
      setStyleSamples(Array.isArray(data) ? data : []);
    } catch (e: any) {
      console.error('[Posts] loadStyleSamples:', e?.message);
    }
  }

  // ===== Tone selection (1-3) =====
  function toggleTone(tone: Tone) {
    setSelectedTones((cur) => {
      if (cur.includes(tone)) {
        const next = cur.filter((x) => x !== tone);
        return next.length === 0 ? [tone] : next;
      }
      if (cur.length >= 3) {
        toast.push('error', t('posts.studio.tones.limit'));
        return cur;
      }
      return [...cur, tone];
    });
  }

  // ===== Style samples =====
  async function addStyleSample() {
    if (newSampleText.trim().length < 50) {
      toast.push('error', t('posts.studio.advanced.styleSamples.minChars'));
      return;
    }
    setAddingSample(true);
    try {
      await trpc.posts.addStyleSample({ content: newSampleText.trim() });
      toast.push('success', t('posts.studio.advanced.styleSamples.saved'));
      setNewSampleText('');
      await loadStyleSamples();
    } catch (e: any) {
      toast.push('error', e?.message || 'Error');
    }
    setAddingSample(false);
  }

  async function deleteStyleSample(id: string) {
    if (!confirm(t('posts.studio.advanced.styleSamples.confirmDelete'))) return;
    try {
      await trpc.posts.deleteStyleSample({ id });
      await loadStyleSamples();
    } catch (e: any) {
      toast.push('error', e?.message || 'Error');
    }
  }

  // ===== Inspiration preview =====
  async function previewInspiration() {
    if (!inspirationUrl.trim()) return;
    setPreviewingInspiration(true);
    setInspirationPreview(null);
    try {
      const data = await trpc.posts.previewInspiration({ url: inspirationUrl.trim() });
      setInspirationPreview(data);
      toast.push('success', t('posts.studio.advanced.inspiration.loaded'));
    } catch (e: any) {
      toast.push('error', e?.message || t('posts.studio.advanced.inspiration.failed'));
    }
    setPreviewingInspiration(false);
  }

  function clearInspiration() {
    setInspirationUrl('');
    setInspirationPreview(null);
  }

  // ===== DNA score (client-side pre-generation) =====
  const dnaScore = useMemo(() => {
    let score = 50;
    if (topic.length >= 30) score += 10;
    if (topic.length >= 80) score += 5;
    if (selectedTones.length >= 2 && selectedTones.length <= 3) score += 10;
    if (dialect !== 'msa' || language === 'ar') score += 5;
    if (audience) score += 8;
    if (goal) score += 7;
    if (useStyleSamples && styleSamples.length > 0) score += 5;
    return Math.min(100, score);
  }, [topic, selectedTones, dialect, language, audience, goal, useStyleSamples, styleSamples.length]);

  const canGenerate = topic.trim().length >= 10 && selectedTones.length >= 1 && !generating;

  // ===== Generate =====
  async function generate() {
    if (!canGenerate) return;
    setGenerating(true);
    setGenerationResult(null);
    try {
      const result = await trpc.posts.generate({
        topic: topic.trim(),
        tones: selectedTones,
        dialect,
        audience: audience || undefined,
        goal: goal || undefined,
        length,
        extras,
        useStyleSamples: useStyleSamples && styleSamples.length > 0,
        inspirationUrl: inspirationUrl.trim() || undefined,
      });
      setGenerationResult(result);
      setSelectedVariation('balanced');
      await loadPosts();
      // scroll to result
      setTimeout(() => {
        document.getElementById('generation-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (e: any) {
      toast.push('error', e?.message || t('posts.studio.generate.error'));
    }
    setGenerating(false);
  }

  async function selectVariationOnServer(vid: VariationId) {
    if (!generationResult) return;
    setSelectedVariation(vid);
    try {
      await trpc.posts.selectVariation({ postId: generationResult.id, variationId: vid });
      await loadPosts();
    } catch {}
  }

  function copyVariation(v: Variation) {
    const text = v.hashtags && v.hashtags.length > 0
      ? `${v.content}\n\n${v.hashtags.map((h) => (String(h).startsWith('#') ? h : `#${h}`)).join(' ')}`
      : v.content;
    try {
      navigator.clipboard.writeText(text);
      setCopiedId(v.id);
      setTimeout(() => setCopiedId(null), 2000);
      toast.push('success', t('posts.studio.variations.actions.copied'));
    } catch {}
  }

  async function publishVariation(v: Variation) {
    if (!generationResult) return;
    await selectVariationOnServer(v.id);
    const text = v.hashtags && v.hashtags.length > 0
      ? `${v.content}\n\n${v.hashtags.map((h) => (String(h).startsWith('#') ? h : `#${h}`)).join(' ')}`
      : v.content;
    const url = `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(text)}`;
    try {
      await trpc.posts.update({ id: generationResult.id, patch: { status: 'posted' } });
      await loadPosts();
    } catch {}
    window.open(url, '_blank');
  }

  async function deletePost(id: string) {
    if (!confirm(t('posts.confirmDelete'))) return;
    try {
      await trpc.posts.delete({ id });
      setPosts((p) => p.filter((x) => x.id !== id));
      toast.push('success', t('posts.deleted'));
    } catch {}
  }

  const displayName = profile?.full_name || (user?.email?.split('@')[0] ?? '');
  const avatar = profile?.avatar_url || '';

  const currentVariation = generationResult?.variations.find((v) => v.id === selectedVariation);

  // ===== Render =====
  return (
    <DashboardLayout pageTitle={t('posts.studio.title')}>
      <toast.View />
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 4px' }}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          style={{ marginBottom: 24 }}
        >
          <h1 style={{
            fontFamily: 'Cairo, Inter, sans-serif', fontWeight: 900,
            fontSize: 30, color: 'var(--wsl-ink)', letterSpacing: '-0.5px', margin: 0,
          }}>
            {t('posts.studio.title')}
          </h1>
          <p style={{
            marginTop: 6, color: 'var(--wsl-ink-3)',
            fontFamily: 'Cairo, Inter, sans-serif', fontSize: 14, lineHeight: 1.6,
          }}>
            {t('posts.studio.subtitle')}
          </p>
        </motion.div>

        {/* === TOPIC CARD === */}
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
          style={cardStyle}
        >
          {/* Voice placeholder */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{
              fontFamily: 'Cairo, Inter, sans-serif', fontWeight: 800, fontSize: 13,
              color: 'var(--wsl-ink-2)',
            }}>
              {t('posts.studio.topic.label')}
            </div>
            <VoicePlaceholder />
          </div>

          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value.slice(0, 2000))}
            placeholder={t('posts.studio.topic.placeholder')}
            rows={3}
            maxLength={2000}
            style={{
              width: '100%', padding: '12px 14px', borderRadius: 10,
              border: '1.5px solid var(--wsl-border, #E5E7EB)',
              fontFamily: 'Cairo, Inter, sans-serif', fontSize: 14, lineHeight: 1.6,
              resize: 'vertical', background: '#F9FAFB',
              outline: 'none', direction: isAr ? 'rtl' : 'ltr',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--wsl-ink-3)', fontFamily: 'Cairo, Inter, sans-serif' }}>
              {t('posts.studio.topic.hint')}
            </span>
            <span style={{
              fontSize: 11, fontWeight: 700,
              color: topic.length > 1800 ? '#DC2626' : 'var(--wsl-ink-3)',
              fontFamily: 'Cairo, Inter, sans-serif',
            }}>
              {topic.length} / 2000
            </span>
          </div>
        </motion.div>

        {/* === TONES === */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.05 }} style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
            <div style={labelStyle}>{t('posts.studio.tones.label')}</div>
            <span style={{ fontSize: 11, color: 'var(--wsl-ink-3)', fontFamily: 'Cairo, Inter, sans-serif' }}>
              {t('posts.studio.tones.hint')}
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {ALL_TONES.map((tone) => {
              const active = selectedTones.includes(tone);
              return (
                <button
                  key={tone}
                  onClick={() => toggleTone(tone)}
                  style={pillStyle(active)}
                >
                  {active && <Check size={13} />}
                  {t(`posts.studio.tones.${tone}`)}
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* === LANGUAGE + DIALECT === */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.1 }} style={cardStyle}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14 }}>
            {/* Language */}
            <div>
              <div style={labelStyle}>{t('posts.studio.language.label')}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['ar', 'en', 'mixed'] as const).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setLanguage(lang)}
                    style={segmentStyle(language === lang)}
                  >
                    {t(`posts.studio.language.${lang}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* Dialect */}
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
                <div style={labelStyle}>{t('posts.studio.dialect.label')}</div>
                <span style={{ fontSize: 11, color: 'var(--wsl-ink-3)', fontFamily: 'Cairo, Inter, sans-serif' }}>
                  {t('posts.studio.dialect.hint')}
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {ALL_DIALECTS.map((d) => {
                  const active = dialect === d;
                  return (
                    <button
                      key={d}
                      onClick={() => setDialect(d)}
                      style={pillStyle(active)}
                    >
                      {t(`posts.studio.dialect.${d}`)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </motion.div>

        {/* === ADVANCED OPTIONS === */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.15 }} style={{ ...cardStyle, padding: 0 }}>
          <button
            onClick={() => setShowAdvanced((s) => !s)}
            style={{
              width: '100%', padding: '14px 20px', display: 'flex',
              alignItems: 'center', justifyContent: 'space-between', gap: 10,
              border: 'none', cursor: 'pointer', background: 'transparent',
              fontFamily: 'Cairo, Inter, sans-serif', fontWeight: 800, fontSize: 14,
              color: 'var(--wsl-ink)', textAlign: isAr ? 'right' : 'left',
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Wand2 size={16} color="#14b8a6" />
              {showAdvanced ? t('posts.studio.advanced.collapse') : t('posts.studio.advanced.toggle')}
            </span>
            {showAdvanced ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>

          <AnimatePresence initial={false}>
            {showAdvanced && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                style={{ overflow: 'hidden' }}
              >
                <div style={{ padding: '4px 20px 20px', borderTop: '1px solid var(--wsl-border, #E5E7EB)' }}>
                  {/* Audience */}
                  <div style={{ marginTop: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
                      <div style={labelStyle}>
                        <Users size={13} style={{ marginInlineEnd: 6, verticalAlign: -2 }} />
                        {t('posts.studio.advanced.audience.label')}
                      </div>
                      <span style={chipOptionalStyle}>{t('posts.studio.advanced.audience.optional')}</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {ALL_AUDIENCES.map((a) => {
                        const active = audience === a;
                        return (
                          <button key={a} onClick={() => setAudience(active ? '' : a)} style={pillStyleSmall(active)}>
                            {t(`posts.studio.advanced.audience.${a}`)}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Goal */}
                  <div style={{ marginTop: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
                      <div style={labelStyle}>
                        <Target size={13} style={{ marginInlineEnd: 6, verticalAlign: -2 }} />
                        {t('posts.studio.advanced.goal.label')}
                      </div>
                      <span style={chipOptionalStyle}>{t('posts.studio.advanced.goal.optional')}</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {ALL_GOALS.map((g) => {
                        const active = goal === g;
                        return (
                          <button key={g} onClick={() => setGoal(active ? '' : g)} style={pillStyleSmall(active)}>
                            {t(`posts.studio.advanced.goal.${g}`)}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Length */}
                  <div style={{ marginTop: 16 }}>
                    <div style={labelStyle}>
                      <Clock size={13} style={{ marginInlineEnd: 6, verticalAlign: -2 }} />
                      {t('posts.studio.advanced.length.label')}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                      {LENGTHS.map((l) => (
                        <button
                          key={l}
                          onClick={() => setLength(l)}
                          style={{
                            ...segmentStyle(length === l),
                            flexDirection: 'column',
                            padding: '10px 14px',
                            gap: 2,
                          }}
                        >
                          <span>{t(`posts.studio.advanced.length.${l}`)}</span>
                          <span style={{ fontSize: 10, opacity: 0.7, fontWeight: 600 }}>
                            {t(`posts.studio.advanced.length.${l}Hint`)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Extras */}
                  <div style={{ marginTop: 16 }}>
                    <div style={labelStyle}>{t('posts.studio.advanced.extras.label')}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginTop: 6 }}>
                      {(Object.keys(extras) as Array<keyof typeof extras>).map((k) => (
                        <label key={k} style={checkboxLabelStyle}>
                          <input
                            type="checkbox"
                            checked={extras[k]}
                            onChange={(e) => setExtras({ ...extras, [k]: e.target.checked })}
                            style={{ width: 15, height: 15, accentColor: '#14b8a6', cursor: 'pointer' }}
                          />
                          {t(`posts.studio.advanced.extras.${k}`)}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Style Samples */}
                  <div style={{ marginTop: 20, padding: 14, borderRadius: 12, background: '#F0FDFA', border: '1px solid #CCFBF1' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontFamily: 'Cairo, Inter, sans-serif', fontWeight: 800, fontSize: 14, color: '#134E4A' }}>
                          ✍️ {t('posts.studio.advanced.styleSamples.label')}
                        </div>
                        <div style={{ fontSize: 12, color: '#0F766E', marginTop: 2, fontFamily: 'Cairo, Inter, sans-serif' }}>
                          {t('posts.studio.advanced.styleSamples.description')}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => setUseStyleSamples((s) => !s)}
                          disabled={styleSamples.length === 0}
                          style={{
                            ...btnSmallStyle,
                            background: useStyleSamples ? '#14b8a6' : '#fff',
                            color: useStyleSamples ? '#fff' : '#134E4A',
                            border: `1.5px solid ${useStyleSamples ? '#14b8a6' : '#CCFBF1'}`,
                            opacity: styleSamples.length === 0 ? 0.5 : 1,
                            cursor: styleSamples.length === 0 ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {useStyleSamples
                            ? t('posts.studio.advanced.styleSamples.disable')
                            : t('posts.studio.advanced.styleSamples.enable')}
                        </button>
                        <button onClick={() => setShowStyleDialog(true)} style={{ ...btnSmallStyle, background: '#fff', color: '#134E4A', border: '1.5px solid #CCFBF1' }}>
                          {t('posts.studio.advanced.styleSamples.manage')} · {t('posts.studio.advanced.styleSamples.count', { count: styleSamples.length })}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Inspiration */}
                  <div style={{ marginTop: 14, padding: 14, borderRadius: 12, background: '#FEF3C7', border: '1px solid #FDE68A' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontFamily: 'Cairo, Inter, sans-serif', fontWeight: 800, fontSize: 14, color: '#78350F' }}>
                          💡 {t('posts.studio.advanced.inspiration.label')}
                        </div>
                        <div style={{ fontSize: 12, color: '#92400E', marginTop: 2, fontFamily: 'Cairo, Inter, sans-serif' }}>
                          {t('posts.studio.advanced.inspiration.description')}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <input
                        type="url"
                        value={inspirationUrl}
                        onChange={(e) => setInspirationUrl(e.target.value)}
                        placeholder={t('posts.studio.advanced.inspiration.placeholder')}
                        style={{
                          flex: 1, minWidth: 200, padding: '9px 12px', borderRadius: 9,
                          border: '1.5px solid #FDE68A', background: '#fff',
                          fontFamily: 'Cairo, Inter, sans-serif', fontSize: 13,
                          outline: 'none', direction: 'ltr',
                        }}
                      />
                      <button
                        onClick={previewInspiration}
                        disabled={!inspirationUrl.trim() || previewingInspiration}
                        style={{
                          ...btnSmallStyle, background: '#F59E0B', color: '#fff', border: 'none',
                          opacity: !inspirationUrl.trim() || previewingInspiration ? 0.6 : 1,
                        }}
                      >
                        {previewingInspiration ? (
                          <><Loader2 size={13} className="spin" /> {t('posts.studio.advanced.inspiration.previewing')}</>
                        ) : (
                          <><Eye size={13} /> {t('posts.studio.advanced.inspiration.preview')}</>
                        )}
                      </button>
                      {inspirationPreview && (
                        <button onClick={clearInspiration} style={{ ...btnSmallStyle, background: '#fff', color: '#78350F', border: '1.5px solid #FDE68A' }}>
                          <X size={13} /> {t('posts.studio.advanced.inspiration.clear')}
                        </button>
                      )}
                    </div>
                    {inspirationPreview && (
                      <div style={{ marginTop: 10, padding: 10, borderRadius: 9, background: '#fff', border: '1px solid #FDE68A' }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: '#78350F', fontFamily: 'Cairo, Inter, sans-serif', marginBottom: 4 }}>
                          {t('posts.studio.advanced.inspiration.loadedTitle')} {inspirationPreview.title}
                        </div>
                        <div style={{ fontSize: 12, color: '#92400E', fontFamily: 'Cairo, Inter, sans-serif', lineHeight: 1.6 }}>
                          {inspirationPreview.preview.slice(0, 300)}…
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* === POST DNA CARD === */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.2 }}
          style={{
            background: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)',
            border: '1.5px solid #FDE68A',
            borderRadius: 16, padding: 18, marginBottom: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontFamily: 'Cairo, Inter, sans-serif', fontWeight: 900, fontSize: 15, color: '#78350F' }}>
                🧬 {t('posts.studio.dna.title')}
              </div>
              <div style={{ fontSize: 12, color: '#92400E', fontFamily: 'Cairo, Inter, sans-serif', marginTop: 2 }}>
                {t('posts.studio.dna.subtitle')}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Award size={16} color={dnaScore >= 80 ? '#16A34A' : dnaScore >= 60 ? '#F59E0B' : '#DC2626'} />
              <div style={{ fontFamily: 'Cairo, Inter, sans-serif', fontWeight: 900, fontSize: 22, color: dnaScore >= 80 ? '#16A34A' : dnaScore >= 60 ? '#F59E0B' : '#DC2626' }}>
                {dnaScore}%
              </div>
            </div>
          </div>
          {/* DNA score bar */}
          <div style={{ height: 6, background: 'rgba(255,255,255,0.6)', borderRadius: 999, overflow: 'hidden', marginBottom: 14 }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${dnaScore}%` }}
              transition={{ duration: 0.5 }}
              style={{
                height: '100%',
                background: dnaScore >= 80
                  ? 'linear-gradient(90deg, #34D399 0%, #16A34A 100%)'
                  : dnaScore >= 60
                  ? 'linear-gradient(90deg, #FBBF24 0%, #F59E0B 100%)'
                  : 'linear-gradient(90deg, #F87171 0%, #DC2626 100%)',
              }}
            />
          </div>
          {/* Summary chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <DnaChip label={t('posts.studio.dna.tones')} value={selectedTones.map((x) => t(`posts.studio.tones.${x}`)).join(' + ')} />
            <DnaChip label={t('posts.studio.dna.dialect')} value={t(`posts.studio.dialect.${dialect}`)} />
            <DnaChip label={t('posts.studio.dna.length')} value={t(`posts.studio.advanced.length.${length}`)} />
            {audience && <DnaChip label={t('posts.studio.dna.audience')} value={t(`posts.studio.advanced.audience.${audience}`)} />}
            {goal && <DnaChip label={t('posts.studio.dna.goal')} value={t(`posts.studio.advanced.goal.${goal}`)} />}
          </div>

          {/* Generate button */}
          <button
            onClick={generate}
            disabled={!canGenerate}
            style={{
              marginTop: 14, width: '100%', padding: '14px 22px', borderRadius: 12, border: 'none',
              background: canGenerate
                ? 'linear-gradient(135deg, #14b8a6 0%, #0ea5e9 100%)'
                : 'var(--wsl-border, #E5E7EB)',
              color: canGenerate ? '#fff' : 'var(--wsl-ink-3)',
              cursor: canGenerate ? 'pointer' : 'not-allowed',
              fontFamily: 'Cairo, Inter, sans-serif', fontWeight: 900, fontSize: 15,
              boxShadow: canGenerate ? '0 6px 20px rgba(10,143,132,0.3)' : 'none',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            }}
          >
            {generating ? (
              <>
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                  <Loader2 size={18} />
                </motion.div>
                {[t('posts.studio.generate.loading1'), t('posts.studio.generate.loading2'), t('posts.studio.generate.loading3'), t('posts.studio.generate.loading4'), t('posts.studio.generate.loading5'), t('posts.studio.generate.loading6'), t('posts.studio.generate.loading7')][loadingMsgIdx]}
              </>
            ) : (
              <>
                <Sparkles size={18} />
                🚀 {t('posts.studio.generate.buttonTokens', { tokens: TOKEN_COST })}
              </>
            )}
          </button>
        </motion.div>

        {/* === GENERATION RESULT === */}
        <AnimatePresence>
          {generationResult && (
            <motion.div
              id="generation-result"
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35 }}
              style={{ ...cardStyle, marginBottom: 24 }}
            >
              {/* Variation tabs */}
              <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 12, background: '#F3F4F6', marginBottom: 14 }}>
                {(generationResult.variations || []).map((v) => {
                  const active = selectedVariation === v.id;
                  const isBalanced = v.id === 'balanced';
                  return (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVariation(v.id)}
                      style={{
                        flex: 1, padding: '10px 14px', borderRadius: 9,
                        border: 'none', cursor: 'pointer',
                        background: active ? '#fff' : 'transparent',
                        color: active ? 'var(--wsl-ink)' : 'var(--wsl-ink-3)',
                        fontFamily: 'Cairo, Inter, sans-serif', fontWeight: 900, fontSize: 13,
                        boxShadow: active ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        transition: 'all 150ms ease',
                      }}
                    >
                      {v.id === 'safe' && <Shield size={13} color={active ? '#6B7280' : undefined} />}
                      {v.id === 'balanced' && <Star size={13} color={active ? '#14b8a6' : undefined} fill={active ? '#14b8a6' : 'none'} />}
                      {v.id === 'bold' && <Zap size={13} color={active ? '#F59E0B' : undefined} />}
                      {t(`posts.studio.variations.${v.id}`)}
                      {isBalanced && (
                        <span style={{
                          marginInlineStart: 4, padding: '1px 6px', borderRadius: 999,
                          background: '#14b8a6', color: '#fff', fontSize: 9, fontWeight: 900,
                          fontFamily: 'Cairo, Inter, sans-serif',
                        }}>
                          ★
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Current variation content */}
              {currentVariation && (
                <motion.div
                  key={currentVariation.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {/* User row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <UserAvatar avatarUrl={avatar} name={displayName} email={user?.email} size="md" />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: 'Cairo, Inter, sans-serif', fontWeight: 900, fontSize: 13 }}>
                        {displayName}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--wsl-ink-3)', fontFamily: 'Cairo, Inter, sans-serif' }}>
                        {t(`posts.studio.variations.${currentVariation.id}Hint`)}
                      </div>
                    </div>
                  </div>

                  {/* Hint badge */}
                  <div style={{ marginBottom: 10 }}>
                    <span style={{
                      padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 800,
                      background: currentVariation.id === 'safe' ? '#F3F4F6'
                        : currentVariation.id === 'balanced' ? '#E0F7F5'
                        : '#FEF3C7',
                      color: currentVariation.id === 'safe' ? '#4B5563'
                        : currentVariation.id === 'balanced' ? '#14b8a6'
                        : '#92400E',
                      fontFamily: 'Cairo, Inter, sans-serif',
                    }}>
                      {t(`posts.studio.variations.${currentVariation.id}Hint`)}
                    </span>
                  </div>

                  {/* Content */}
                  <div style={{
                    fontFamily: 'Cairo, Inter, sans-serif', fontSize: 15, lineHeight: 1.9,
                    color: 'var(--wsl-ink)', whiteSpace: 'pre-wrap',
                    direction: ['english'].includes(String(generationResult.dna.dialect)) ? 'ltr' : 'rtl',
                    marginBottom: 12, padding: 14, background: '#F9FAFB', borderRadius: 10, border: '1px solid #E5E7EB',
                  }}>
                    {currentVariation.content}
                  </div>

                  {/* Hashtags */}
                  {currentVariation.hashtags && currentVariation.hashtags.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                      {currentVariation.hashtags.map((h, i) => (
                        <span key={i} style={{
                          padding: '4px 10px', borderRadius: 999,
                          background: 'rgba(10,143,132,0.08)', color: '#14b8a6',
                          fontSize: 11, fontWeight: 800, fontFamily: 'Cairo, Inter, sans-serif',
                          display: 'inline-flex', alignItems: 'center', gap: 3,
                        }}>
                          <Hash size={10} />{String(h).replace(/^#/, '')}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Char count */}
                  <div style={{ fontSize: 11, color: 'var(--wsl-ink-3)', textAlign: isAr ? 'left' : 'right', marginBottom: 10, fontFamily: 'Cairo, Inter, sans-serif' }}>
                    {t('posts.studio.variations.charCount', { count: currentVariation.content.length })}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingTop: 12, borderTop: '1px solid #E5E7EB' }}>
                    <button onClick={() => publishVariation(currentVariation)} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '9px 16px', borderRadius: 9, border: 'none',
                      background: '#0077B5', color: '#fff',
                      fontFamily: 'Cairo, Inter, sans-serif', fontWeight: 900, fontSize: 13,
                      cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,119,181,0.3)',
                    }}>
                      <Linkedin size={14} /> {t('posts.studio.variations.actions.publish')}
                    </button>
                    <button onClick={() => copyVariation(currentVariation)} style={actionBtn}>
                      {copiedId === currentVariation.id ? <><Check size={14} /> {t('posts.studio.variations.actions.copied')}</> : <><Copy size={14} /> {t('posts.studio.variations.actions.copy')}</>}
                    </button>
                    <button onClick={() => selectVariationOnServer(currentVariation.id)} style={{ ...actionBtn, background: '#F0FDF4', color: '#166534', borderColor: '#BBF7D0' }}>
                      <FileText size={14} /> {t('posts.studio.variations.actions.save')}
                    </button>
                    <button onClick={generate} style={{ ...actionBtn, background: '#F0F9FF', color: '#0369A1', borderColor: '#BAE6FD' }} disabled={generating}>
                      <RefreshCw size={14} /> {t('posts.studio.variations.actions.regenerate')}
                    </button>
                  </div>

                  {/* Tips */}
                  {generationResult.tips && generationResult.tips.length > 0 && (
                    <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                      <div style={{ fontFamily: 'Cairo, Inter, sans-serif', fontWeight: 900, fontSize: 12, color: '#1E40AF', marginBottom: 6 }}>
                        💡 {t('posts.studio.variations.tipsTitle')}
                      </div>
                      <ul style={{ margin: 0, paddingInlineStart: 18, fontSize: 12, color: '#1E40AF', fontFamily: 'Cairo, Inter, sans-serif', lineHeight: 1.7 }}>
                        {generationResult.tips.map((tip, i) => <li key={i}>{tip}</li>)}
                      </ul>
                    </div>
                  )}

                  {/* AI feedback */}
                  <div style={{ marginTop: 12 }}>
                    <AIFeedbackWidget feature="posts" />
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* === HISTORY === */}
        <div style={{ marginTop: 28 }}>
          <div style={{ fontFamily: 'Cairo, Inter, sans-serif', fontWeight: 900, fontSize: 18, color: 'var(--wsl-ink)', marginBottom: 12 }}>
            {t('posts.studio.history.title')}
          </div>
          {loadingPosts ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} style={{ display: 'inline-block' }}>
                <Loader2 size={22} color="#14b8a6" />
              </motion.div>
            </div>
          ) : posts.length === 0 ? (
            <div style={{
              background: '#fff', border: '2px dashed var(--wsl-border, #E5E7EB)',
              borderRadius: 16, padding: '40px 24px', textAlign: 'center',
            }}>
              <FileText size={28} color="#14b8a6" />
              <div style={{ fontFamily: 'Cairo, Inter, sans-serif', fontWeight: 900, fontSize: 15, color: 'var(--wsl-ink)', marginTop: 10 }}>
                {t('posts.studio.history.empty')}
              </div>
              <div style={{ fontFamily: 'Cairo, Inter, sans-serif', fontSize: 12, color: 'var(--wsl-ink-3)' }}>
                {t('posts.studio.history.emptyHint')}
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {posts.map((p) => (
                <div key={p.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 800,
                      background: p.status === 'posted' ? '#D1FAE5' : p.status === 'scheduled' ? '#FEF3C7' : '#F3F4F6',
                      color: p.status === 'posted' ? '#065F46' : p.status === 'scheduled' ? '#92400E' : '#4B5563',
                      fontFamily: 'Cairo, Inter, sans-serif',
                    }}>
                      {t(`posts.studio.history.${p.status === 'posted' ? 'published' : p.status}`)}
                    </span>
                    <button onClick={() => deletePost(p.id)} style={{
                      width: 24, height: 24, border: 'none', background: 'transparent',
                      cursor: 'pointer', color: '#9CA3AF', borderRadius: 6,
                    }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <div style={{
                    fontFamily: 'Cairo, Inter, sans-serif', fontSize: 12, lineHeight: 1.6,
                    color: 'var(--wsl-ink-2)', minHeight: 60, marginBottom: 6,
                    display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    direction: p.language === 'en' ? 'ltr' : 'rtl',
                  }}>
                    {(p.content || p.topic || '').slice(0, 200)}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--wsl-ink-3)', fontFamily: 'Cairo, Inter, sans-serif' }}>
                    {relativeTime(p.created_at, isAr)}
                    {p.dialect && <> · {t(`posts.studio.dialect.${p.dialect}`, { defaultValue: p.dialect })}</>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* === STYLE SAMPLES DIALOG === */}
      <AnimatePresence>
        {showStyleDialog && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowStyleDialog(false)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
              zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: '#fff', borderRadius: 16, width: '100%', maxWidth: 640,
                maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
                boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
              }}
            >
              <div style={{ padding: 20, borderBottom: '1px solid #E5E7EB' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontFamily: 'Cairo, Inter, sans-serif', fontWeight: 900, fontSize: 18, color: 'var(--wsl-ink)' }}>
                      ✍️ {t('posts.studio.advanced.styleSamples.dialogTitle')}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--wsl-ink-3)', fontFamily: 'Cairo, Inter, sans-serif', marginTop: 4 }}>
                      {t('posts.studio.advanced.styleSamples.dialogSubtitle')}
                    </div>
                  </div>
                  <button onClick={() => setShowStyleDialog(false)} style={{ width: 32, height: 32, border: 'none', background: '#F3F4F6', borderRadius: 8, cursor: 'pointer' }}>
                    <X size={16} />
                  </button>
                </div>
              </div>
              <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
                {/* Add sample */}
                <textarea
                  value={newSampleText}
                  onChange={(e) => setNewSampleText(e.target.value.slice(0, 5000))}
                  placeholder={t('posts.studio.advanced.styleSamples.placeholder')}
                  rows={5}
                  style={{
                    width: '100%', padding: 12, borderRadius: 10, border: '1.5px solid #E5E7EB',
                    fontFamily: 'Cairo, Inter, sans-serif', fontSize: 13, lineHeight: 1.7,
                    resize: 'vertical', outline: 'none', background: '#F9FAFB',
                    direction: isAr ? 'rtl' : 'ltr',
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                  <span style={{ fontSize: 11, color: newSampleText.length < 50 ? '#DC2626' : 'var(--wsl-ink-3)', fontFamily: 'Cairo, Inter, sans-serif' }}>
                    {newSampleText.length < 50 ? t('posts.studio.advanced.styleSamples.minChars') : `${newSampleText.length}/5000`}
                  </span>
                  <button
                    onClick={addStyleSample}
                    disabled={newSampleText.trim().length < 50 || addingSample}
                    style={{
                      ...btnSmallStyle,
                      background: '#14b8a6', color: '#fff', border: 'none',
                      opacity: newSampleText.trim().length < 50 || addingSample ? 0.5 : 1,
                    }}
                  >
                    {addingSample ? (
                      <><Loader2 size={13} className="spin" /> {t('posts.studio.advanced.styleSamples.analyzing')}</>
                    ) : (
                      <><Plus size={13} /> {t('posts.studio.advanced.styleSamples.add')}</>
                    )}
                  </button>
                </div>

                {/* List */}
                <div style={{ marginTop: 20 }}>
                  {styleSamples.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 30, color: 'var(--wsl-ink-3)', fontFamily: 'Cairo, Inter, sans-serif', fontSize: 13 }}>
                      {t('posts.studio.advanced.styleSamples.empty')}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {styleSamples.map((s) => (
                        <div key={s.id} style={{ padding: 12, borderRadius: 10, border: '1px solid #E5E7EB', background: '#F9FAFB' }}>
                          <div style={{ fontSize: 12, color: 'var(--wsl-ink-2)', fontFamily: 'Cairo, Inter, sans-serif', lineHeight: 1.6, marginBottom: 6, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', direction: isAr ? 'rtl' : 'ltr' }}>
                            {s.content}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 10, color: 'var(--wsl-ink-3)', fontFamily: 'Cairo, Inter, sans-serif' }}>
                              {relativeTime(s.created_at, isAr)}
                            </span>
                            <button onClick={() => deleteStyleSample(s.id)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#DC2626', fontSize: 11, fontFamily: 'Cairo, Inter, sans-serif', fontWeight: 700 }}>
                              <Trash2 size={12} /> {t('posts.studio.advanced.styleSamples.delete')}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ padding: 16, borderTop: '1px solid #E5E7EB', display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={() => setShowStyleDialog(false)} style={{ ...btnSmallStyle, background: '#fff', color: 'var(--wsl-ink-2)', border: '1.5px solid #E5E7EB' }}>
                  {t('posts.studio.advanced.styleSamples.close')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </DashboardLayout>
  );
}

// ===== Voice Placeholder =====
function VoicePlaceholder() {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      disabled
      title={t('posts.studio.voice.comingSoonTooltip')}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '5px 10px', borderRadius: 8,
        background: '#FEF3C7', border: '1px solid #FDE68A',
        color: '#92400E', fontSize: 11, fontWeight: 800,
        cursor: 'not-allowed', opacity: 0.95,
        fontFamily: 'Cairo, Inter, sans-serif',
      }}
    >
      <Mic size={12} />
      {t('posts.studio.voice.label')}
      <span style={{
        background: '#F59E0B', color: '#fff', padding: '1px 6px',
        borderRadius: 999, fontSize: 9, fontWeight: 900,
      }}>
        {t('common.comingSoon')}
      </span>
    </button>
  );
}

// ===== DNA Chip =====
function DnaChip({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '5px 10px', borderRadius: 10,
      background: highlight ? '#F59E0B' : 'rgba(255,255,255,0.7)',
      color: highlight ? '#fff' : '#78350F',
      fontSize: 11, fontWeight: 800, fontFamily: 'Cairo, Inter, sans-serif',
      border: highlight ? 'none' : '1px solid #FDE68A',
    }}>
      <span style={{ opacity: highlight ? 0.9 : 0.6 }}>{label}:</span>
      <span>{value}</span>
    </div>
  );
}

// ===== Styles =====
const cardStyle: React.CSSProperties = {
  background: '#fff', border: '1px solid var(--wsl-border, #E5E7EB)',
  borderRadius: 16, padding: 18, marginBottom: 14,
  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontFamily: 'Cairo, Inter, sans-serif', fontWeight: 800, fontSize: 13,
  color: 'var(--wsl-ink-2)',
};

const chipOptionalStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: 'var(--wsl-ink-3)',
  fontFamily: 'Cairo, Inter, sans-serif',
  padding: '1px 6px', borderRadius: 6, background: '#F3F4F6',
};

const checkboxLabelStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer',
  fontFamily: 'Cairo, Inter, sans-serif', fontWeight: 700, fontSize: 12,
  color: 'var(--wsl-ink-2)', padding: '6px 10px', borderRadius: 8,
  background: '#F9FAFB', border: '1px solid #E5E7EB',
};

const actionBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 14px', borderRadius: 9,
  border: '1px solid var(--wsl-border, #E5E7EB)',
  background: '#fff', color: 'var(--wsl-ink-2)',
  fontFamily: 'Cairo, Inter, sans-serif', fontWeight: 800, fontSize: 12,
  cursor: 'pointer',
};

const btnSmallStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5,
  padding: '7px 12px', borderRadius: 8,
  fontFamily: 'Cairo, Inter, sans-serif', fontWeight: 800, fontSize: 12,
  cursor: 'pointer',
};

function pillStyle(active: boolean): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '7px 12px', borderRadius: 999,
    border: `1.5px solid ${active ? '#14b8a6' : '#E5E7EB'}`,
    background: active ? '#14b8a6' : '#fff',
    color: active ? '#fff' : 'var(--wsl-ink-2)',
    fontFamily: 'Cairo, Inter, sans-serif', fontWeight: 800, fontSize: 12,
    cursor: 'pointer',
    transition: 'all 150ms ease',
  };
}

function pillStyleSmall(active: boolean): React.CSSProperties {
  return {
    ...pillStyle(active),
    padding: '5px 10px',
    fontSize: 11,
    borderRadius: 999,
  };
}

function segmentStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: '9px 14px', borderRadius: 9,
    border: `1.5px solid ${active ? '#14b8a6' : '#E5E7EB'}`,
    background: active ? '#14b8a6' : '#fff',
    color: active ? '#fff' : 'var(--wsl-ink-2)',
    fontFamily: 'Cairo, Inter, sans-serif', fontWeight: 800, fontSize: 13,
    cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 150ms ease',
  };
}
