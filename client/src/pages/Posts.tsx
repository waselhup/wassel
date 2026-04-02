import { useState, useEffect } from 'react';
import ClientNav from '@/components/ClientNav';
import { useAuth } from '@/contexts/AuthContext';
import AISurveyModal, { AIMessageConfig } from '@/components/AISurveyModal';
import { useTranslation } from 'react-i18next';
import ExtensionRequiredModal from '@/components/ExtensionRequiredModal';
import {
  Sparkles, Send, Clock, Save, Loader2, Trash2,
  CheckCircle, XCircle, FileText, RefreshCw,
} from 'lucide-react';

import { toast } from 'sonner';

async function apiFetch(path: string, token: string, options?: RequestInit) {
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(options?.headers || {}) },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || data.message || `API error ${res.status}`);
  }
  return data;
}

type PostStatus = 'all' | 'draft' | 'scheduled' | 'published' | 'failed';

interface Post {
  id: string;
  content: string;
  status: string;
  scheduled_at: string | null;
  published_at: string | null;
  error_message: string | null;
  created_at: string;
}

export default function Posts() {
  const { t, i18n } = useTranslation();
  const { accessToken } = useAuth();
  const token = accessToken || localStorage.getItem('supabase_token') || '';

  const [content, setContent] = useState('');
  const [posts, setPosts] = useState<Post[]>([]);
  const [filter, setFilter] = useState<PostStatus>('all');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [showAI, setShowAI] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [showExtModal, setShowExtModal] = useState(false);

  const maxChars = 3000;

  // Fetch posts
  const fetchPosts = async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`/api/posts?status=${filter}`, token);
      setPosts(data.posts || []);
    } catch (e) {
      console.error('[Posts] fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPosts(); }, [filter]);

  // Save draft
  const saveDraft = async () => {
    if (!content.trim()) return;
    setSaving(true);
    try {
      await apiFetch('/api/posts', token, {
        method: 'POST',
        body: JSON.stringify({ content: content.trim() }),
      });
      setContent('');
      toast.success(t('posts.draftSaved') || 'Draft saved ✅');
      fetchPosts();
    } catch (e: any) {
      console.error('[Posts] save error:', e);
      toast.error(e.message || 'Failed to save draft');
    } finally {
      setSaving(false);
    }
  };

  // Schedule post
  const schedulePost = async () => {
    if (!content.trim() || !scheduleDate) return;
    setSaving(true);
    try {
      await apiFetch('/api/posts', token, {
        method: 'POST',
        body: JSON.stringify({ content: content.trim(), scheduled_at: scheduleDate }),
      });
      setContent('');
      setScheduleDate('');
      toast.success(t('posts.postScheduled') || 'Post scheduled ✅');
      fetchPosts();
    } catch (e: any) {
      console.error('[Posts] schedule error:', e);
      toast.error(e.message || 'Failed to schedule post');
    } finally {
      setSaving(false);
    }
  };

  // Publish now (cloud — via LinkedIn Voyager API, no extension needed)
  const publishNow = async () => {
    if (!content.trim()) return;
    setPublishing(true);
    try {
      // 1. Create the post in database
      const createRes = await apiFetch('/api/posts', token, {
        method: 'POST',
        body: JSON.stringify({ content: content.trim() }),
      });
      const postId = createRes.post?.id;
      if (!postId) throw new Error('Failed to create post');

      // 2. Mark as published in database
      await apiFetch(`/api/posts/${postId}/publish`, token, { method: 'POST' });

      // 3. Execute via cloud API (LinkedIn Voyager API — no extension needed)
      console.log('[Wassel-Posts] Publishing via cloud API');
      const cloudRes = await apiFetch('/api/cloud/execute', token, {
        method: 'POST',
        body: JSON.stringify({
          actionType: 'post',
          message: content.trim(),
        }),
      });

      if (cloudRes.success) {
        setContent('');
        toast.success(t('posts.published') || 'Post published successfully!');
      } else {
        toast.error(cloudRes.error || 'Cloud publish failed');
      }

      fetchPosts();
    } catch (e: any) {
      console.error('[Posts] publish error:', e);
      toast.error(e.message || 'Failed to publish');
    } finally {
      setPublishing(false);
    }
  };

  // Delete post
  const deletePost = async (id: string) => {
    try {
      await apiFetch(`/api/posts/${id}`, token, { method: 'DELETE' });
      setPosts(posts.filter(p => p.id !== id));
      toast.success(t('posts.deleted'));
    } catch (e: any) {
      console.error('[Posts] delete error:', e);
    }
  };

  // AI generate handler — THE CRITICAL FIX
  const handleAIGenerate = async (config: AIMessageConfig) => {
    setAiGenerating(true);
    try {
      const res = await apiFetch('/api/ai/generate-message', token, {
        method: 'POST',
        body: JSON.stringify({
          stepType: 'post',
          purpose: config.purpose,
          tone: config.tone,
          senderContext: config.senderContext,
          specificGoal: config.specificGoal,
          postType: config.postType,
          language: i18n.language,
        }),
      });
      if (res.message) {
        setContent(res.message);
        setShowAI(false);
        toast.success('تم توليد المحتوى ✨');
      } else {
        toast.error('لم يتم إرجاع محتوى من الذكاء الاصطناعي');
      }
    } catch (e: any) {
      console.error('[Posts] AI error:', e);
      toast.error(e.message || 'فشل توليد الرسالة — حاول مرة أخرى');
    } finally {
      setAiGenerating(false);
    }
  };

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString(i18n.language === 'ar' ? 'ar-SA' : 'en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  const statusColor: Record<string, { bg: string; color: string; border: string }> = {
    draft: { bg: 'rgba(148,163,184,0.1)', color: '#94a3b8', border: '1px solid rgba(148,163,184,0.25)' },
    scheduled: { bg: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.25)' },
    published: { bg: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.25)' },
    failed: { bg: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' },
  };

  const card: React.CSSProperties = {
    background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
    borderRadius: 12, padding: 24, marginBottom: 16,
  };

  const filters: { key: PostStatus; label: string }[] = [
    { key: 'all', label: t('posts.all') },
    { key: 'draft', label: t('posts.drafts') },
    { key: 'scheduled', label: t('posts.schedule') },
    { key: 'published', label: t('posts.published') },
    { key: 'failed', label: t('posts.failed') },
  ];

  return (
    <>
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-base)' }}>
      <ClientNav />
      <main className="main-content" style={{ flex: 1, padding: 32, overflowY: 'auto' }}>
        <div style={{ maxWidth: 800 }}>
          {/* Header */}
          <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>
            {t('posts.title')}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>
            {t('posts.writePost')}
          </p>

          {/* Write Section */}
          <div style={card}>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value.slice(0, maxChars))}
              placeholder={t('posts.writePost')}
              rows={6}
              style={{
                width: '100%', padding: '14px 16px', borderRadius: 10,
                border: '1px solid var(--border-subtle)', background: 'rgba(255,255,255,0.04)',
                color: 'var(--text-primary)', fontSize: 14, resize: 'vertical',
                fontFamily: 'inherit', outline: 'none', minHeight: 120,
              }}
            />

            {/* Character counter + AI button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <button
                onClick={() => setShowAI(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'linear-gradient(135deg,rgba(124,58,237,0.12),rgba(236,72,153,0.12))',
                  border: '1px solid rgba(124,58,237,0.25)', borderRadius: 8,
                  padding: '8px 14px', color: '#c4b5fd', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                <Sparkles size={14} /> {t('posts.writeWithAI')}
              </button>
              <span style={{ fontSize: 12, color: content.length > 2800 ? '#ef4444' : 'var(--text-muted)' }}>
                {content.length}/{maxChars} {t('posts.characters')}
              </span>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              {/* Save Draft */}
              <button
                onClick={saveDraft}
                disabled={!content.trim() || saving}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '10px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)', cursor: content.trim() ? 'pointer' : 'not-allowed',
                  opacity: content.trim() ? 1 : 0.5,
                }}
              >
                <Save size={14} /> {t('posts.saveDraft')}
              </button>

              {/* Schedule */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="datetime-local"
                  value={scheduleDate}
                  onChange={e => setScheduleDate(e.target.value)}
                  style={{
                    padding: '8px 12px', borderRadius: 8,
                    border: '1px solid var(--border-subtle)', background: 'rgba(255,255,255,0.04)',
                    color: 'var(--text-primary)', fontSize: 13,
                  }}
                />
                <button
                  onClick={schedulePost}
                  disabled={!content.trim() || !scheduleDate || saving}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                    background: content.trim() && scheduleDate ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(59,130,246,0.3)',
                    color: content.trim() && scheduleDate ? '#3b82f6' : 'var(--text-muted)',
                    cursor: content.trim() && scheduleDate ? 'pointer' : 'not-allowed',
                    opacity: content.trim() && scheduleDate ? 1 : 0.5,
                  }}
                >
                  <Clock size={14} /> {t('posts.schedule')}
                </button>
              </div>

              {/* Post Now */}
              <button
                onClick={publishNow}
                disabled={!content.trim() || publishing}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, marginInlineStart: 'auto',
                  padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                  background: content.trim() && !publishing ? 'var(--gradient-primary)' : 'rgba(255,255,255,0.08)',
                  border: 'none', color: content.trim() ? '#fff' : 'var(--text-muted)',
                  cursor: content.trim() && !publishing ? 'pointer' : 'not-allowed',
                  opacity: content.trim() ? 1 : 0.5,
                }}
              >
                {publishing ? (
                  <><Loader2 size={14} className="animate-spin" /> {t('common.loading')}</>
                ) : (
                  <><Send size={14} /> {t('posts.postNow')}</>
                )}
              </button>
            </div>
          </div>

          {/* Post History */}
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                {t('posts.postHistory')}
              </h2>
              <button
                onClick={fetchPosts}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}
              >
                <RefreshCw size={14} />
              </button>
            </div>

            {/* Filter tabs */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
              {filters.map(f => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  style={{
                    padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                    background: filter === f.key ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.04)',
                    border: filter === f.key ? '1px solid rgba(124,58,237,0.3)' : '1px solid var(--border-subtle)',
                    color: filter === f.key ? 'var(--accent-secondary)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Posts list */}
            {loading ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} />
                {t('common.loading')}
              </div>
            ) : posts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                <FileText size={32} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                <p style={{ fontSize: 14 }}>{t('posts.noPostsYet')}</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {posts.map(post => {
                  const sc = statusColor[post.status] || statusColor.draft;
                  return (
                    <div
                      key={post.id}
                      style={{
                        padding: 14, borderRadius: 10,
                        border: '1px solid var(--border-subtle)',
                        background: 'rgba(255,255,255,0.02)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <span
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                            background: sc.bg, color: sc.color, border: sc.border,
                          }}
                        >
                          {post.status === 'published' && <CheckCircle size={11} />}
                          {post.status === 'failed' && <XCircle size={11} />}
                          {post.status === 'scheduled' && <Clock size={11} />}
                          {post.status}
                        </span>
                        <button
                          onClick={() => deletePost(post.id)}
                          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                      <p style={{ color: 'var(--text-primary)', fontSize: 13, whiteSpace: 'pre-wrap', lineHeight: 1.5, marginBottom: 8, maxHeight: 80, overflow: 'hidden' }}>
                        {post.content}
                      </p>
                      <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-muted)' }}>
                        <span>{t('posts.createdAt')} {formatDate(post.created_at)}</span>
                        {post.scheduled_at && <span>{t('posts.scheduledFor')} {formatDate(post.scheduled_at)}</span>}
                        {post.published_at && <span>{t('posts.publishedAt')} {formatDate(post.published_at)}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* AI Survey Modal */}
      <AISurveyModal
        isOpen={showAI}
        onClose={() => setShowAI(false)}
        onGenerate={handleAIGenerate}
        isGenerating={aiGenerating}
        showPostType={true}
      />
      {showExtModal && (
        <ExtensionRequiredModal reason="post" onClose={() => setShowExtModal(false)} />
      )}
    </div>
    </>
  );
}
