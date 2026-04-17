import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  Sparkles, Copy, Edit, Trash2, Calendar, FileText,
  PenSquare, Check, X, Loader2, Hash, ChevronDown, MoreVertical, Linkedin,
} from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import AIFeedbackWidget from '@/components/AIFeedbackWidget';
import UserAvatar from '@/components/UserAvatar';

type PostStatus = 'draft' | 'scheduled' | 'posted';
type Tone = 'professional' | 'inspirational' | 'educational' | 'casual';
type Lang = 'ar' | 'en' | 'bilingual';

interface Post {
  id: string;
  user_id: string;
  content: string;
  ai_generated: boolean;
  ai_prompt: string | null;
  tone: string;
  language: string;
  hashtags: string[];
  scheduled_for: string | null;
  status: PostStatus;
  created_at: string;
  updated_at: string;
}

// -------------- Helpers --------------

function getAuthToken(): string | null {
  // Fast path: read from localStorage (avoids getSession() hanging)
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        const token = parsed?.access_token || parsed?.currentSession?.access_token;
        if (token) return token;
      }
    }
  } catch (e) {
    console.error('[Posts] localStorage token read failed:', e);
  }
  return null;
}

function relativeTime(iso: string, isAr: boolean): string {
  const d = new Date(iso).getTime();
  const now = Date.now();
  const s = Math.max(1, Math.floor((now - d) / 1000));
  if (isAr) {
    if (s < 60) return 'قبل لحظات';
    const m = Math.floor(s / 60);
    if (m < 60) return m === 1 ? 'منذ دقيقة' : m === 2 ? 'منذ دقيقتين' : `منذ ${m} دقائق`;
    const h = Math.floor(m / 60);
    if (h < 24) return h === 1 ? 'منذ ساعة' : h === 2 ? 'منذ ساعتين' : `منذ ${h} ساعات`;
    const dd = Math.floor(h / 24);
    if (dd < 7) return dd === 1 ? 'منذ يوم' : dd === 2 ? 'منذ يومين' : `منذ ${dd} أيام`;
    const w = Math.floor(dd / 7);
    if (w < 5) return w === 1 ? 'منذ أسبوع' : `منذ ${w} أسابيع`;
    const mo = Math.floor(dd / 30);
    if (mo < 12) return mo === 1 ? 'منذ شهر' : `منذ ${mo} أشهر`;
    const y = Math.floor(dd / 365);
    return y === 1 ? 'منذ سنة' : `منذ ${y} سنوات`;
  }
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const dd = Math.floor(h / 24);
  if (dd < 7) return `${dd}d ago`;
  const w = Math.floor(dd / 7);
  if (w < 5) return `${w}w ago`;
  const mo = Math.floor(dd / 30);
  if (mo < 12) return `${mo}mo ago`;
  const y = Math.floor(dd / 365);
  return `${y}y ago`;
}

// -------------- Toast --------------

interface Toast {
  id: number;
  type: 'success' | 'error';
  message: string;
}

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

// -------------- Badge --------------

function StatusBadge({ status, t }: { status: PostStatus; t: (k: string) => string }) {
  const map: Record<PostStatus, { bg: string; color: string; label: string }> = {
    draft: { bg: '#F3F4F6', color: '#4B5563', label: t('posts.tabs.drafts') },
    scheduled: { bg: '#FEF3C7', color: '#92400E', label: t('posts.tabs.scheduled') },
    posted: { bg: '#D1FAE5', color: '#065F46', label: t('posts.tabs.posted') },
  };
  const s = map[status];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 10px', borderRadius: 999,
      background: s.bg, color: s.color,
      fontSize: 11, fontWeight: 800, fontFamily: 'Cairo, Inter, sans-serif',
    }}>
      {s.label}
    </span>
  );
}

// -------------- Main Page --------------

export default function Posts() {
  const { t, i18n } = useTranslation();
  const { user, profile } = useAuth();
  const isAr = i18n.language === 'ar';
  const toast = useToast();

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'all' | PostStatus>('all');
  const [openGen, setOpenGen] = useState(true);

  // Generator state
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState<Tone>('professional');
  const [lang, setLang] = useState<Lang>('ar');
  const [includeHashtags, setIncludeHashtags] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState<{ content: string; hashtags: string[] } | null>(null);

  // Edit state
  const [editingPreview, setEditingPreview] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  useEffect(() => { void loadPosts(); }, []);

  async function loadPosts() {
    setLoading(true);
    try {
      const token = getAuthToken();
      if (!token) { setLoading(false); return; }
      const res = await fetch('/api/posts', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setPosts(Array.isArray(data) ? data : []);
      }
    } catch { /* noop */ }
    setLoading(false);
  }

  async function generatePost() {
    if (!topic.trim()) return;
    setGenerating(true);
    setPreview(null);
    console.log('[Posts] Generating post, topic:', topic, 'tone:', tone, 'lang:', lang);
    try {
      const token = getAuthToken();
      if (!token) {
        console.error('[Posts] No auth token found');
        toast.push('error', t('posts.errorGenerating'));
        setGenerating(false);
        return;
      }
      console.log('[Posts] Sending fetch to /api/posts/generate');
      const res = await fetch('/api/posts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ topic, tone, language: lang, includeHashtags }),
      });
      console.log('[Posts] Response status:', res.status);
      if (res.status === 402) { toast.push('error', t('posts.notEnoughTokens')); setGenerating(false); return; }
      if (!res.ok) {
        const errBody = await res.text();
        console.error('[Posts] Generate failed:', res.status, errBody);
        toast.push('error', t('posts.errorGenerating'));
        setGenerating(false);
        return;
      }
      const data = await res.json();
      console.log('[Posts] Generated successfully, content length:', data.content?.length || 0);
      setPreview({ content: data.content || '', hashtags: Array.isArray(data.hashtags) ? data.hashtags : [] });
    } catch (err: any) {
      console.error('[Posts] Generate error:', err);
      toast.push('error', err?.message || t('posts.errorGenerating'));
    }
    setGenerating(false);
  }

  async function savePost(status: PostStatus = 'draft') {
    if (!preview) return;
    try {
      const token = getAuthToken();
      if (!token) return;
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          content: preview.content,
          ai_generated: true,
          ai_prompt: topic,
          tone, language: lang,
          hashtags: preview.hashtags,
          status,
        }),
      });
      if (res.ok) {
        toast.push('success', t('posts.saved'));
        setPreview(null); setTopic('');
        void loadPosts();
      }
    } catch { /* noop */ }
  }

  async function deletePost(id: string) {
    if (!confirm(t('posts.confirmDelete'))) return;
    try {
      const token = getAuthToken();
      if (!token) return;
      const res = await fetch(`/api/posts/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast.push('success', t('posts.deleted'));
        setPosts((p) => p.filter((x) => x.id !== id));
      }
    } catch { /* noop */ }
    setMenuOpenId(null);
  }

  function copyToClipboard(text: string) {
    try {
      navigator.clipboard.writeText(text);
      toast.push('success', t('posts.copied'));
    } catch { /* noop */ }
  }

  async function handlePostToLinkedIn(content: string, hashtags: string[]) {
    const fullContent = hashtags.length > 0
      ? `${content}\n\n${hashtags.map((h) => (String(h).startsWith('#') ? h : `#${h}`)).join(' ')}`
      : content;
    const linkedInUrl = `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(fullContent)}`;
    try {
      const token = getAuthToken();
      if (token) {
        await fetch('/api/posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            content: fullContent,
            ai_generated: true,
            status: 'posted',
            posted_to_linkedin: true,
            posted_at: new Date().toISOString(),
          }),
        });
        void loadPosts();
      }
      toast.push('success', t('posts.openingLinkedIn'));
      window.open(linkedInUrl, '_blank');
    } catch {
      window.open(linkedInUrl, '_blank');
    }
  }

  async function handlePostFromCard(post: Post) {
    const fullContent = post.hashtags && post.hashtags.length > 0
      ? `${post.content}\n\n${post.hashtags.map((h) => (String(h).startsWith('#') ? h : `#${h}`)).join(' ')}`
      : post.content;
    const linkedInUrl = `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(fullContent)}`;
    try {
      const token = getAuthToken();
      if (token) {
        await fetch(`/api/posts/${post.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ status: 'posted' }),
        });
        void loadPosts();
      }
      toast.push('success', t('posts.openingLinkedIn'));
    } catch { /* noop */ }
    window.open(linkedInUrl, '_blank');
    setMenuOpenId(null);
  }

  const counts = useMemo(() => ({
    all: posts.length,
    draft: posts.filter((p) => p.status === 'draft').length,
    scheduled: posts.filter((p) => p.status === 'scheduled').length,
    posted: posts.filter((p) => p.status === 'posted').length,
  }), [posts]);

  const filtered = tab === 'all' ? posts : posts.filter((p) => p.status === tab);

  const displayName = profile?.full_name || (user?.email?.split('@')[0] ?? '');
  const displayTitle = (profile as any)?.job_title || (profile as any)?.title || (isAr ? 'مستخدم وصّل' : 'Wassel member');
  const avatar = profile?.avatar_url || '';

  const tabs: { id: typeof tab; labelKey: string; count: number }[] = [
    { id: 'all', labelKey: 'posts.tabs.all', count: counts.all },
    { id: 'draft', labelKey: 'posts.tabs.drafts', count: counts.draft },
    { id: 'scheduled', labelKey: 'posts.tabs.scheduled', count: counts.scheduled },
    { id: 'posted', labelKey: 'posts.tabs.posted', count: counts.posted },
  ];

  return (
    <DashboardLayout pageTitle={t('posts.title')}>
      <toast.View />
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 4px' }}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, marginBottom: 24, flexWrap: 'wrap' }}
        >
          <div style={{ flex: 1, minWidth: 260 }}>
            <h1 style={{
              fontFamily: 'Cairo, Inter, sans-serif', fontWeight: 900,
              fontSize: 30, color: 'var(--wsl-ink)', letterSpacing: '-0.5px', margin: 0,
            }}>
              {t('posts.title')}
            </h1>
            <p style={{
              marginTop: 6, color: 'var(--wsl-ink-3)',
              fontFamily: 'Cairo, Inter, sans-serif', fontSize: 14, lineHeight: 1.6,
            }}>
              {t('posts.subtitle')}
            </p>
          </div>
          <button
            onClick={() => { setOpenGen(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '11px 20px', borderRadius: 12,
              background: 'linear-gradient(135deg, #0A8F84 0%, #0ea5e9 100%)',
              color: '#fff', border: 'none', cursor: 'pointer',
              fontFamily: 'Cairo, Inter, sans-serif', fontWeight: 900, fontSize: 14,
              boxShadow: '0 6px 16px rgba(10,143,132,0.25)',
            }}
          >
            <Sparkles size={16} /> {t('posts.newPost')}
          </button>
        </motion.div>

        {/* Tabs */}
        <div style={{
          display: 'flex', gap: 4, padding: 4, borderRadius: 12,
          background: 'var(--wsl-surf-2, #F3F4F6)', marginBottom: 20, overflowX: 'auto',
        }}>
          {tabs.map((tb) => {
            const active = tab === tb.id;
            return (
              <button
                key={tb.id}
                onClick={() => setTab(tb.id)}
                style={{
                  flex: 1, minWidth: 110, padding: '9px 14px', borderRadius: 9,
                  border: 'none', cursor: 'pointer',
                  background: active ? '#fff' : 'transparent',
                  color: active ? 'var(--wsl-ink)' : 'var(--wsl-ink-3)',
                  fontFamily: 'Cairo, Inter, sans-serif', fontWeight: 900, fontSize: 13,
                  boxShadow: active ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: 'all 150ms ease',
                }}
              >
                {t(tb.labelKey)}
                <span style={{
                  padding: '1px 8px', borderRadius: 999, fontSize: 11, fontWeight: 900,
                  background: active ? 'var(--wsl-teal-bg, #E0F7F5)' : 'rgba(0,0,0,0.06)',
                  color: active ? 'var(--wsl-teal, #0A8F84)' : 'var(--wsl-ink-3)',
                  fontFamily: 'Inter, sans-serif',
                }}>
                  {tb.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* AI Generator */}
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }}
          style={{
            background: '#fff', border: '1px solid var(--wsl-border, #E5E7EB)',
            borderRadius: 16, marginBottom: 24, overflow: 'hidden',
            boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
          }}
        >
          <button
            onClick={() => setOpenGen((o) => !o)}
            style={{
              width: '100%', padding: '16px 20px', display: 'flex',
              alignItems: 'center', gap: 12, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, rgba(10,143,132,0.06) 0%, rgba(14,165,233,0.06) 100%)',
              textAlign: isAr ? 'right' : 'left',
            }}
          >
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: 'linear-gradient(135deg, #0A8F84 0%, #0ea5e9 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Sparkles size={20} color="#fff" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{
                fontFamily: 'Cairo, Inter, sans-serif', fontWeight: 900, fontSize: 16,
                color: 'var(--wsl-ink)',
              }}>
                {isAr ? '🤖 ' : ''}{t('posts.aiAssistant')}
              </div>
            </div>
            <ChevronDown
              size={18}
              style={{ transform: openGen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 200ms', color: 'var(--wsl-ink-3)' }}
            />
          </button>

          <AnimatePresence initial={false}>
            {openGen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                style={{ overflow: 'hidden' }}
              >
                <div style={{ padding: 20 }}>
                  {/* Topic */}
                  <label style={labelStyle}>{t('posts.topic')}</label>
                  <textarea
                    value={topic}
                    onChange={(e) => setTopic(e.target.value.slice(0, 500))}
                    placeholder={t('posts.topicPlaceholder')}
                    rows={3}
                    maxLength={500}
                    style={{
                      width: '100%', padding: '12px 14px', borderRadius: 10,
                      border: '1.5px solid var(--wsl-border, #E5E7EB)',
                      fontFamily: 'Cairo, Inter, sans-serif', fontSize: 14, lineHeight: 1.6,
                      resize: 'vertical', marginBottom: 4, background: '#F9FAFB',
                      outline: 'none', direction: isAr ? 'rtl' : 'ltr',
                    }}
                  />
                  <div style={{
                    textAlign: isAr ? 'left' : 'right',
                    fontSize: 11, fontWeight: 700,
                    color: topic.length > 450 ? '#DC2626' : 'var(--wsl-ink-3)',
                    fontFamily: 'Cairo, Inter, sans-serif',
                    marginBottom: 14,
                  }}>
                    {topic.length} / 500
                  </div>

                  {/* Tone + Language */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                    <div>
                      <label style={labelStyle}>{t('posts.tone')}</label>
                      <select
                        value={tone}
                        onChange={(e) => setTone(e.target.value as Tone)}
                        style={selectStyle}
                      >
                        <option value="professional">{t('posts.tones.professional')}</option>
                        <option value="inspirational">{t('posts.tones.inspirational')}</option>
                        <option value="educational">{t('posts.tones.educational')}</option>
                        <option value="casual">{t('posts.tones.casual')}</option>
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>{t('posts.language')}</label>
                      <select
                        value={lang}
                        onChange={(e) => setLang(e.target.value as Lang)}
                        style={selectStyle}
                      >
                        <option value="ar">{t('posts.langs.ar')}</option>
                        <option value="en">{t('posts.langs.en')}</option>
                        <option value="bilingual">{t('posts.langs.bilingual')}</option>
                      </select>
                    </div>
                  </div>

                  {/* Hashtags checkbox */}
                  <label style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                    fontFamily: 'Cairo, Inter, sans-serif', fontWeight: 700, fontSize: 13,
                    color: 'var(--wsl-ink-2)', marginBottom: 18,
                  }}>
                    <input
                      type="checkbox"
                      checked={includeHashtags}
                      onChange={(e) => setIncludeHashtags(e.target.checked)}
                      style={{ width: 16, height: 16, accentColor: '#0A8F84', cursor: 'pointer' }}
                    />
                    {t('posts.includeHashtags')}
                  </label>

                  {/* Generate button */}
                  <button
                    onClick={generatePost}
                    disabled={generating || !topic.trim()}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 10,
                      padding: '12px 22px', borderRadius: 12, border: 'none',
                      background: generating || !topic.trim()
                        ? 'var(--wsl-border, #E5E7EB)'
                        : 'linear-gradient(135deg, #0A8F84 0%, #0ea5e9 100%)',
                      color: generating || !topic.trim() ? 'var(--wsl-ink-3)' : '#fff',
                      cursor: generating || !topic.trim() ? 'not-allowed' : 'pointer',
                      fontFamily: 'Cairo, Inter, sans-serif', fontWeight: 900, fontSize: 14,
                      boxShadow: generating || !topic.trim() ? 'none' : '0 6px 16px rgba(10,143,132,0.25)',
                    }}
                  >
                    {generating ? (
                      <>
                        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                          <Loader2 size={16} />
                        </motion.div>
                        {t('posts.generating')}
                      </>
                    ) : (
                      <>
                        <Sparkles size={16} />
                        {t('posts.generate')} · {t('posts.tokenCost', { cost: 3 })}
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Generated Preview */}
        <AnimatePresence>
          {preview && (
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              style={{
                background: '#fff', border: '1px solid var(--wsl-border, #E5E7EB)',
                borderRadius: 16, padding: 20, marginBottom: 24,
                boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
              }}
            >
              {/* User row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <UserAvatar
                  avatarUrl={avatar}
                  name={displayName}
                  email={user?.email}
                  size="md"
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'Cairo, Inter, sans-serif', fontWeight: 900, fontSize: 14, color: 'var(--wsl-ink)' }}>
                    {displayName}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--wsl-ink-3)', fontFamily: 'Cairo, Inter, sans-serif' }}>
                    {displayTitle}
                  </div>
                </div>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '3px 10px', borderRadius: 999,
                  background: 'linear-gradient(135deg, rgba(10,143,132,0.1), rgba(14,165,233,0.1))',
                  color: '#0A8F84', fontSize: 11, fontWeight: 800, fontFamily: 'Cairo, Inter, sans-serif',
                }}>
                  <Sparkles size={11} /> {t('posts.aiBadge')}
                </div>
              </div>

              {/* Content */}
              {editingPreview ? (
                <textarea
                  value={preview.content}
                  onChange={(e) => setPreview({ ...preview, content: e.target.value })}
                  rows={10}
                  style={{
                    width: '100%', padding: 14, borderRadius: 10,
                    border: '1.5px solid #0A8F84', fontFamily: 'Cairo, Inter, sans-serif',
                    fontSize: 14, lineHeight: 1.8, resize: 'vertical', outline: 'none',
                    direction: isAr ? 'rtl' : 'ltr', marginBottom: 14, background: '#F9FAFB',
                  }}
                />
              ) : (
                <div style={{
                  fontFamily: 'Cairo, Inter, sans-serif', fontSize: 15, lineHeight: 1.9,
                  color: 'var(--wsl-ink)', whiteSpace: 'pre-wrap',
                  direction: isAr ? 'rtl' : 'ltr', marginBottom: 14,
                }}>
                  {preview.content}
                </div>
              )}

              {/* Hashtags */}
              {preview.hashtags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                  {preview.hashtags.map((h, i) => (
                    <span key={i} style={{
                      padding: '4px 11px', borderRadius: 999,
                      background: 'rgba(10,143,132,0.08)', color: '#0A8F84',
                      fontSize: 12, fontWeight: 800, fontFamily: 'Cairo, Inter, sans-serif',
                      display: 'inline-flex', alignItems: 'center', gap: 3,
                    }}>
                      <Hash size={10} />{String(h).replace(/^#/, '')}
                    </span>
                  ))}
                </div>
              )}

              {/* Action bar */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingTop: 14, borderTop: '1px solid var(--wsl-border, #E5E7EB)' }}>
                <button
                  onClick={() => handlePostToLinkedIn(preview.content, preview.hashtags)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '8px 16px', borderRadius: 9, border: 'none',
                    background: '#0077B5', color: '#fff',
                    fontFamily: 'Cairo, Inter, sans-serif', fontWeight: 900, fontSize: 13,
                    cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,119,181,0.3)',
                  }}
                >
                  <Linkedin size={14} /> {t('posts.postToLinkedIn')}
                </button>
                <button onClick={() => copyToClipboard(
                  preview.content + (preview.hashtags.length ? '\n\n' + preview.hashtags.map((h) => (String(h).startsWith('#') ? h : '#' + h)).join(' ') : '')
                )} style={actionBtn}>
                  <Copy size={14} /> {t('posts.copy')}
                </button>
                <button onClick={() => setEditingPreview((v) => !v)} style={actionBtn}>
                  <Edit size={14} /> {editingPreview ? t('common.save') : t('posts.edit')}
                </button>
                <button onClick={() => savePost('draft')} style={{ ...actionBtn, background: '#F0FDF4', color: '#166534', borderColor: '#BBF7D0' }}>
                  <FileText size={14} /> {t('posts.saveDraft')}
                </button>
                <button onClick={() => savePost('scheduled')} style={{ ...actionBtn, background: '#FEF3C7', color: '#92400E', borderColor: '#FDE68A' }}>
                  <Calendar size={14} /> {t('posts.schedule')}
                </button>
              </div>
              {/* Char counter */}
              <div style={{
                marginTop: 8,
                fontSize: 11, fontWeight: 700,
                color: preview.content.length > 2800 ? '#DC2626' : 'var(--wsl-ink-3)',
                fontFamily: 'Cairo, Inter, sans-serif',
                textAlign: isAr ? 'left' : 'right',
              }}>
                {preview.content.length} / 3000 {isAr ? 'حرف' : 'chars'}
              </div>

              {/* LinkedIn tip banner */}
              <div style={{
                marginTop: 12, padding: '10px 14px', borderRadius: 10,
                background: '#EFF6FF', border: '1px solid #BFDBFE',
                display: 'flex', alignItems: 'center', gap: 8,
                fontSize: 12, color: '#1D4ED8',
                fontFamily: 'Cairo, Inter, sans-serif', fontWeight: 700,
              }}>
                <Linkedin size={14} style={{ flexShrink: 0 }} />
                {t('posts.linkedInTip')}
              </div>

              {/* AI feedback widget */}
              <div style={{ marginTop: 12 }}>
                <AIFeedbackWidget feature="posts" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Posts Grid */}
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} style={{ display: 'inline-block' }}>
              <Loader2 size={24} color="#0A8F84" />
            </motion.div>
          </div>
        ) : filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            style={{
              background: '#fff', border: '2px dashed var(--wsl-border, #E5E7EB)',
              borderRadius: 16, padding: '60px 24px', textAlign: 'center',
            }}
          >
            <div style={{
              width: 72, height: 72, borderRadius: 20, margin: '0 auto 18px',
              background: 'linear-gradient(135deg, rgba(10,143,132,0.1), rgba(14,165,233,0.1))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <FileText size={32} color="#0A8F84" />
            </div>
            <div style={{ fontFamily: 'Cairo, Inter, sans-serif', fontWeight: 900, fontSize: 18, color: 'var(--wsl-ink)', marginBottom: 6 }}>
              {t('posts.empty')}
            </div>
            <div style={{ fontFamily: 'Cairo, Inter, sans-serif', fontSize: 13, color: 'var(--wsl-ink-3)', marginBottom: 20 }}>
              {t('posts.emptyDescription')}
            </div>
            <button onClick={() => { setOpenGen(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '10px 18px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, #0A8F84 0%, #0ea5e9 100%)', color: '#fff',
              fontFamily: 'Cairo, Inter, sans-serif', fontWeight: 900, fontSize: 13,
            }}>
              <Sparkles size={14} /> {t('posts.startWriting')}
            </button>
          </motion.div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
            {filtered.map((p, idx) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.04 }}
                whileHover={{ y: -3 }}
                style={{
                  background: '#fff', border: '1px solid var(--wsl-border, #E5E7EB)',
                  borderRadius: 14, padding: 16, position: 'relative',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  transition: 'box-shadow 200ms',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <StatusBadge status={p.status} t={t} />
                  <div style={{ position: 'relative' }}>
                    <button
                      onClick={() => setMenuOpenId(menuOpenId === p.id ? null : p.id)}
                      style={{
                        width: 28, height: 28, borderRadius: 8, border: 'none',
                        background: 'transparent', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--wsl-ink-3)',
                      }}
                    >
                      <MoreVertical size={16} />
                    </button>
                    {menuOpenId === p.id && (
                      <div style={{
                        position: 'absolute', top: '100%', insetInlineEnd: 0, marginTop: 4,
                        width: 140, background: '#fff',
                        border: '1px solid var(--wsl-border, #E5E7EB)',
                        borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
                        overflow: 'hidden', zIndex: 10,
                      }}>
                        <button onClick={() => handlePostFromCard(p)} style={{ ...menuItem, color: '#0077B5' }}>
                          <Linkedin size={13} /> {t('posts.postToLinkedIn')}
                        </button>
                        <button onClick={() => { copyToClipboard(p.content); setMenuOpenId(null); }} style={menuItem}>
                          <Copy size={13} /> {t('posts.copy')}
                        </button>
                        <button onClick={() => deletePost(p.id)} style={{ ...menuItem, color: '#DC2626' }}>
                          <Trash2 size={13} /> {t('posts.delete')}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{
                  fontFamily: 'Cairo, Inter, sans-serif', fontSize: 13, lineHeight: 1.7,
                  color: 'var(--wsl-ink-2)',
                  direction: p.language === 'en' ? 'ltr' : 'rtl',
                  display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical',
                  overflow: 'hidden', minHeight: 100, marginBottom: 10,
                }}>
                  {p.content.slice(0, 220)}{p.content.length > 220 ? '…' : ''}
                </div>

                {p.hashtags && p.hashtags.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                    {p.hashtags.slice(0, 3).map((h, i) => (
                      <span key={i} style={{
                        padding: '2px 8px', borderRadius: 999,
                        background: 'rgba(10,143,132,0.08)', color: '#0A8F84',
                        fontSize: 10, fontWeight: 800, fontFamily: 'Cairo, Inter, sans-serif',
                      }}>
                        {String(h).startsWith('#') ? h : '#' + h}
                      </span>
                    ))}
                  </div>
                )}

                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  paddingTop: 10, borderTop: '1px solid var(--wsl-border, #E5E7EB)',
                  fontSize: 11, color: 'var(--wsl-ink-3)', fontFamily: 'Cairo, Inter, sans-serif',
                }}>
                  <span>{relativeTime(p.created_at, isAr)}</span>
                  {p.ai_generated && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: '#0A8F84', fontWeight: 800 }}>
                      <Sparkles size={10} /> AI
                    </span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

// -------------- Styles --------------

const labelStyle: React.CSSProperties = {
  display: 'block', marginBottom: 6,
  fontFamily: 'Cairo, Inter, sans-serif', fontWeight: 800, fontSize: 12,
  color: 'var(--wsl-ink-2)',
};

const selectStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 10,
  border: '1.5px solid var(--wsl-border, #E5E7EB)',
  fontFamily: 'Cairo, Inter, sans-serif', fontSize: 13,
  background: '#F9FAFB', outline: 'none', cursor: 'pointer',
};

const actionBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 14px', borderRadius: 9,
  border: '1px solid var(--wsl-border, #E5E7EB)',
  background: '#fff', color: 'var(--wsl-ink-2)',
  fontFamily: 'Cairo, Inter, sans-serif', fontWeight: 800, fontSize: 12,
  cursor: 'pointer',
};

const menuItem: React.CSSProperties = {
  width: '100%', padding: '9px 12px', display: 'flex', alignItems: 'center', gap: 8,
  border: 'none', background: 'transparent', cursor: 'pointer',
  fontFamily: 'Cairo, Inter, sans-serif', fontWeight: 700, fontSize: 12,
  color: 'var(--wsl-ink-2)', textAlign: 'start',
};
