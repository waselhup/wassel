import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import Phone from '@/components/v2/Phone';
import Topbar from '@/components/v2/Topbar';
import BottomNav from '@/components/v2/BottomNav';
import Button from '@/components/v2/Button';
import Card from '@/components/v2/Card';
import Eyebrow from '@/components/v2/Eyebrow';
import NumDisplay from '@/components/v2/NumDisplay';
import Pill from '@/components/v2/Pill';
import Sheet from '@/components/v2/Sheet';
import EmptyState from '@/components/v2/EmptyState';
import Skeleton, { useInitialLoading } from '@/components/v2/Skeleton';
import { useIsDesktop } from '@/components/v2/ResponsiveShell';
import { useJobs } from '@/lib/v2/jobs';
import { useToast } from '@/lib/v2/toast';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/contexts/AuthContext';

type Tab = 'drafts' | 'published' | 'templates';
type Status = 'draft' | 'scheduled' | 'posted';
type Tone = 'professional' | 'friendly' | 'motivational' | 'analytical';

const STATUS_LABEL_AR: Record<Status, string> = { draft: 'مسودة', scheduled: 'جاهز للنشر', posted: 'منشور' };
const STATUS_LABEL_EN: Record<Status, string> = { draft: 'Draft', scheduled: 'Scheduled', posted: 'Published' };

const TONE_MAP: Record<Tone, string> = {
  professional: 'professional',
  friendly: 'friendly',
  motivational: 'motivational',
  analytical: 'analytical',
};

const TONE_LABEL_AR: Record<string, string> = {
  professional: 'مهنية',
  friendly: 'ودودة',
  motivational: 'ملهمة',
  analytical: 'تحليلية',
  humorous: 'فكاهي',
  humble: 'متواضع',
  bold: 'جريء',
  storytelling: 'قصصي',
  sarcastic: 'ساخر',
  provocative: 'صادم',
};
const TONE_LABEL_EN: Record<string, string> = {
  professional: 'Professional',
  friendly: 'Friendly',
  motivational: 'Motivational',
  analytical: 'Analytical',
  humorous: 'Humorous',
  humble: 'Humble',
  bold: 'Bold',
  storytelling: 'Storytelling',
  sarcastic: 'Sarcastic',
  provocative: 'Provocative',
};

interface ServerPost {
  id: string;
  user_id: string;
  topic: string | null;
  content: string | null;
  tones: string[] | null;
  status: 'draft' | 'scheduled' | 'posted';
  created_at: string;
  hashtags?: string[] | null;
}

interface UiPost {
  id: string;
  topic: string;
  content: string;
  preview: string;
  status: Status;
  date: string;
  words: number;
  tones: string[];
}

interface Template {
  id: string;
  title: string;
  description: string;
  cost: number;
}

// Every post variant costs 5 tokens (linkedin_post canonical price).
function buildTemplates(isAr: boolean): Template[] {
  return isAr ? [
    { id: 't1', title: 'منشور رأي', description: 'مقدمة جذابة + 3 نقاط + خاتمة', cost: 5 },
    { id: 't2', title: 'دراسة حالة', description: 'تحدّي · حل · نتيجة', cost: 5 },
    { id: 't3', title: 'تأمل أسبوعي', description: 'ماذا تعلّمت هذا الأسبوع', cost: 5 },
    { id: 't4', title: 'إعلان إنجاز', description: 'متواضع لكن واثق', cost: 5 },
    { id: 't5', title: 'منشور سرد قصصي', description: 'لحظة → درس → دعوة', cost: 5 },
  ] : [
    { id: 't1', title: 'Opinion post',  description: 'Hook + 3 points + close', cost: 5 },
    { id: 't2', title: 'Case study',    description: 'Challenge · solution · result', cost: 5 },
    { id: 't3', title: 'Weekly reflection', description: 'What you learned this week', cost: 5 },
    { id: 't4', title: 'Achievement',   description: 'Humble but confident', cost: 5 },
    { id: 't5', title: 'Story post',    description: 'Moment → lesson → CTA', cost: 5 },
  ];
}

function buildTones(isAr: boolean): { id: Tone; label: string }[] {
  const labels = isAr ? TONE_LABEL_AR : TONE_LABEL_EN;
  return [
    { id: 'professional', label: labels.professional },
    { id: 'friendly',     label: labels.friendly },
    { id: 'motivational', label: labels.motivational },
    { id: 'analytical',   label: labels.analytical },
  ];
}

const COMPOSE_COST = 5;

function statusFromServer(s: 'draft' | 'scheduled' | 'posted'): Status {
  return s; // keep server enum as-is; render via STATUS_LABEL_* maps
}

function relativeDate(iso: string, isAr: boolean): string {
  const created = new Date(iso).getTime();
  if (Number.isNaN(created)) return '';
  const diffMs = Date.now() - created;
  const diffMin = Math.floor(diffMs / 60_000);
  if (isAr) {
    if (diffMin < 1) return 'الآن';
    if (diffMin < 60) return `قبل ${diffMin} د`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `قبل ${diffH} س`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `قبل ${diffD} ي`;
    return new Date(iso).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' });
  }
  if (diffMin < 1) return 'now';
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} hr ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD} day${diffD > 1 ? 's' : ''} ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function toUiPost(p: ServerPost, isAr: boolean): UiPost {
  const content = p.content || '';
  const topic = (p.topic || content.slice(0, 60) || (isAr ? 'منشور' : 'Post')).trim();
  const preview = content.replace(/\s+/g, ' ').trim().slice(0, 200);
  return {
    id: p.id,
    topic,
    content,
    preview: preview || '—',
    status: statusFromServer(p.status),
    date: relativeDate(p.created_at, isAr),
    words: content ? content.trim().split(/\s+/).length : 0,
    tones: Array.isArray(p.tones) ? p.tones : [],
  };
}

function StatusPill({ status, isAr }: { status: Status; isAr: boolean }) {
  const tone =
    status === 'scheduled' ? 'bg-teal-50 text-teal-700 border-teal-100' :
    status === 'posted'    ? 'bg-v2-indigo-50 text-v2-indigo border-v2-indigo/30' :
                             'bg-v2-canvas-2 text-v2-dim border-v2-line';
  const label = (isAr ? STATUS_LABEL_AR : STATUS_LABEL_EN)[status];
  return (
    <span className={`shrink-0 rounded-full border px-2 py-0.5 font-ar text-[10px] font-semibold whitespace-nowrap ${tone}`}>
      {label}
    </span>
  );
}

interface PostRowProps {
  post: UiPost;
  onPublish: (p: UiPost) => void;
  onDelete: (p: UiPost) => void;
  onCopy: (p: UiPost) => void;
  onView: (p: UiPost) => void;
  isAr: boolean;
}

function PostRow({ post, onPublish, onDelete, onCopy, onView, isAr }: PostRowProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onView(post)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onView(post); } }}
      className="cursor-pointer border-b border-v2-line py-4 lg:rounded-v2-lg lg:border lg:bg-v2-surface lg:p-5 lg:hover:shadow-card lg:transition-shadow lg:duration-200 lg:ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/30">
      <div className="mb-1.5 flex items-start justify-between gap-2.5">
        <div className="flex-1 font-ar text-[14px] font-semibold text-v2-ink lg:text-[15px]">
          {post.topic}
        </div>
        <StatusPill status={post.status} isAr={isAr} />
      </div>
      <p className="mb-2.5 line-clamp-2 font-ar text-[13px] leading-relaxed text-v2-body lg:line-clamp-3">
        {post.preview}
      </p>
      <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
        {post.tones.slice(0, 3).map((tn) => (
          <span
            key={tn}
            className="rounded-full border border-v2-line bg-v2-canvas-2 px-2 py-0.5 font-ar text-[10px] font-medium text-v2-body"
          >
            {(isAr ? TONE_LABEL_AR : TONE_LABEL_EN)[tn] || tn}
          </span>
        ))}
      </div>
      <div className="flex items-center gap-3.5 text-[11px] text-v2-dim">
        <NumDisplay>{post.words}</NumDisplay>
        <span className="font-ar">{isAr ? 'كلمة' : 'words'}</span>
        <span>·</span>
        <span className="font-ar">{post.date}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {post.status !== 'posted' && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onPublish(post); }}
            className="rounded-v2-md border border-teal-600 bg-teal-600 px-3 py-1.5 font-ar text-[12px] font-semibold text-white hover:bg-teal-700 cursor-pointer transition-colors"
          >
            {isAr ? 'نشر على LinkedIn' : 'Publish to LinkedIn'}
          </button>
        )}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onCopy(post); }}
          className="rounded-v2-md border border-v2-line bg-v2-surface px-3 py-1.5 font-ar text-[12px] font-medium text-v2-ink hover:bg-v2-canvas-2 cursor-pointer transition-colors"
        >
          {isAr ? 'نسخ' : 'Copy'}
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete(post); }}
          className="rounded-v2-md border border-v2-line bg-v2-surface px-3 py-1.5 font-ar text-[12px] font-medium text-red-600 hover:bg-red-50 cursor-pointer transition-colors"
        >
          {isAr ? 'حذف' : 'Delete'}
        </button>
      </div>
    </div>
  );
}

interface ComposerProps {
  topic: string;
  setTopic: (v: string) => void;
  content: string;
  setContent: (v: string) => void;
  tone: Tone;
  setTone: (t: Tone) => void;
  onGenerate: () => void;
  generating?: boolean;
  /** desktop variant uses a larger textarea + tighter spacing inside a card */
  desktop?: boolean;
}

function Composer({ topic, setTopic, content, setContent, tone, setTone, onGenerate, generating = false, desktop = false, isAr }: ComposerProps & { isAr: boolean }) {
  const taMin = desktop ? 'min-h-[260px]' : 'min-h-[180px]';
  const TONES = buildTones(isAr);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Eyebrow className="mb-2 block">{isAr ? 'الموضوع' : 'Topic'}</Eyebrow>
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          className="w-full rounded-v2-md border border-v2-line bg-v2-surface px-3.5 py-3 font-ar text-[14px] text-v2-ink outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
        />
      </div>

      <div>
        <Eyebrow className="mb-2 block">{isAr ? 'المحتوى' : 'Content'}</Eyebrow>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={isAr ? 'ابدأ بفكرتك الأساسية، أو اضغط ولّد وسنبدأ معك…' : 'Start with your main idea, or hit Generate and we will draft with you…'}
          className={`${taMin} w-full resize-none rounded-v2-md border border-v2-line bg-v2-surface px-3.5 py-3.5 font-ar text-[14px] leading-relaxed text-v2-ink outline-none placeholder:text-v2-mute focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30`}
        />
      </div>

      <div>
        <Eyebrow className="mb-2.5 block">{isAr ? 'النبرة' : 'Tone'}</Eyebrow>
        <div className="flex flex-wrap gap-1.5">
          {TONES.map((tn) => (
            <Pill
              key={tn.id}
              size="sm"
              tone="neutral"
              selected={tone === tn.id}
              onClick={() => setTone(tn.id)}
            >
              {tn.label}
            </Pill>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between border-y border-v2-line py-3.5">
        <div>
          <Eyebrow>{isAr ? 'التكلفة' : 'Cost'}</Eyebrow>
          <p className="mt-0.5 font-ar text-[14px] font-semibold text-v2-ink">
            <NumDisplay>{COMPOSE_COST}</NumDisplay> {isAr ? 'توكن · ≈' : 'tokens · ≈'} <NumDisplay>150</NumDisplay> {isAr ? 'كلمة' : 'words'}
          </p>
        </div>
      </div>

      <Button
        variant="primary"
        size="lg"
        fullWidth
        disabled={generating}
        leadingIcon={
          generating ? (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" className="animate-spin">
              <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5" strokeDasharray="28" strokeDashoffset="10" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M7 1 L8.5 5 L13 6.5 L8.5 8 L7 13 L5.5 8 L1 6.5 L5.5 5 Z" fill="currentColor" />
            </svg>
          )
        }
        onClick={onGenerate}
      >
        {generating
          ? (isAr ? 'جارٍ التوليد…' : 'Generating…')
          : (isAr ? 'ولّد بالذكاء الاصطناعي' : 'Generate with AI')}
      </Button>
    </div>
  );
}

function Posts() {
  const [, navigate] = useLocation();
  const { t, i18n } = useTranslation();
  const isAr = (i18n.language || 'ar').startsWith('ar');
  const { addJob } = useJobs();
  const { showToast } = useToast();
  const { refreshProfile } = useAuth();
  const isDesktop = useIsDesktop();
  const initialLoading = useInitialLoading(800);
  const [tab, setTab] = useState<Tab>('drafts');
  const [composerOpen, setComposerOpen] = useState(false);
  const [topic, setTopic] = useState('');
  const [content, setContent] = useState('');
  const [tone, setTone] = useState<Tone>('professional');
  const [generating, setGenerating] = useState(false);

  // Real posts from the server.
  const [posts, setPosts] = useState<ServerPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<UiPost | null>(null);

  async function loadPosts() {
    try {
      const data = await trpc.posts.list();
      setPosts(Array.isArray(data) ? (data as ServerPost[]) : []);
    } catch (e: any) {
      console.error('[v2/posts] list failed:', e?.message || e);
    } finally {
      setPostsLoading(false);
    }
  }

  useEffect(() => {
    loadPosts();
  }, []);

  const drafts = useMemo<UiPost[]>(
    () => posts.filter((p) => p.status === 'draft' || p.status === 'scheduled').map((p) => toUiPost(p, isAr)),
    [posts, isAr]
  );
  const published = useMemo<UiPost[]>(
    () => posts.filter((p) => p.status === 'posted').map((p) => toUiPost(p, isAr)),
    [posts, isAr]
  );

  const generate = async () => {
    const trimmed = topic.trim();
    const fullTopic = content.trim() ? `${trimmed}\n\n${content.trim()}` : trimmed;
    if (fullTopic.length < 10) {
      showToast({ message: isAr ? 'الموضوع قصير جداً — 10 أحرف على الأقل' : 'Topic is too short — 10 chars minimum', tone: 'error' });
      return;
    }
    console.log('[v2/posts] generate STARTING', { topic: trimmed.slice(0, 60), tone });
    setGenerating(true);
    setComposerOpen(false);

    addJob({
      type: 'post-generation',
      title: trimmed || (isAr ? 'منشور جديد' : 'New post'),
      durationMs: 15000,
    });

    try {
      const result = await trpc.posts.generate({
        topic: fullTopic,
        tones: [TONE_MAP[tone]],
        dialect: 'saudi-general',
        length: 'medium',
        extras: { hashtags: true, emojis: false },
      });
      console.log('[v2/posts] generate SUCCESS', { id: result?.id, tokensRemaining: (result as any)?.tokensRemaining });

      // Refresh the drafts list AND the token balance — both must update.
      await loadPosts();
      try { await refreshProfile(); } catch {}

      setTab('drafts');
      if (result?.id) setHighlightId(result.id);
      showToast({
        message: t('posts.studio.generate.success', isAr ? 'تم توليد المنشور بنجاح ✨' : 'Post generated successfully ✨'),
        tone: 'success',
      });
      // Clear inputs so the user is ready for the next one.
      setContent('');
    } catch (err: any) {
      console.error('[v2/posts] generate ERROR', err);
      // Pull a sensible message: tRPC errors expose .message; classifyClaudeError already returns Arabic.
      const code = (err as any)?.data?.code;
      let message: string = err?.message || (isAr ? 'فشل التوليد — حاول مرة أخرى' : 'Generation failed — please try again');
      if (code === 'UNAUTHORIZED') {
        message = isAr ? 'انتهت الجلسة — سجّل دخول من جديد' : 'Session expired — sign in again';
      }
      showToast({ message, tone: 'error', duration: 7000 });
    } finally {
      console.log('[v2/posts] generate SETTLED');
      setGenerating(false);
    }
  };

  async function publishVariation(p: UiPost) {
    const url = `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(p.content)}`;
    try {
      await trpc.posts.update({ id: p.id, patch: { status: 'posted' } });
      await loadPosts();
    } catch (e: any) {
      console.error('[v2/posts] publish update failed:', e?.message);
    }
    window.open(url, '_blank');
  }

  async function deletePost(p: UiPost) {
    if (!confirm(isAr ? 'حذف هذا المنشور؟' : 'Delete this post?')) return;
    try {
      await trpc.posts.delete({ id: p.id });
      setPosts((cur) => cur.filter((x) => x.id !== p.id));
      showToast({ message: isAr ? 'تم الحذف' : 'Deleted', tone: 'success' });
    } catch (e: any) {
      showToast({ message: e?.message || (isAr ? 'فشل الحذف' : 'Delete failed'), tone: 'error' });
    }
  }

  function copyPost(p: UiPost) {
    const text = p.content.trim();
    try {
      navigator.clipboard.writeText(text);
      showToast({ message: isAr ? 'تم النسخ' : 'Copied', tone: 'success' });
    } catch {
      showToast({ message: isAr ? 'تعذر النسخ — انسخ يدوياً' : 'Copy failed — copy manually', tone: 'error' });
    }
  }

  // On desktop the composer is "always visible" in its column — no toggle.
  const desktopComposerVisible = isDesktop;

  const TEMPLATES = buildTemplates(isAr);
  const counts = {
    drafts:    drafts.length,
    published: published.length,
    templates: TEMPLATES.length,
  };

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'drafts',    label: isAr ? 'مسودات' : 'Drafts',    count: counts.drafts },
    { id: 'published', label: isAr ? 'منشورة' : 'Published', count: counts.published },
    { id: 'templates', label: isAr ? 'قوالب'  : 'Templates', count: counts.templates },
  ];

  const showSkeleton = initialLoading || postsLoading;

  const ListBlock: ReactNode = (
    <>
      {showSkeleton ? (
        <div className="flex flex-col gap-4 pt-4 lg:pt-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="border-b border-v2-line pb-4 lg:rounded-v2-lg lg:border lg:p-5">
              <Skeleton variant="text" lines={2} />
              <div className="mt-3 flex gap-3">
                <Skeleton variant="text" width={60} />
                <Skeleton variant="text" width={80} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {tab === 'drafts' && (
            drafts.length === 0 ? (
              <EmptyState
                title={isAr ? 'لا توجد مسودات بعد' : 'No drafts yet'}
                description={isAr ? 'ابدأ بمنشور جديد من زر الأعلى أو من أحد القوالب الجاهزة' : 'Start a new post from the button above, or pick a ready template'}
              />
            ) : (
              <div className="flex flex-col lg:grid lg:grid-cols-2 lg:gap-4 lg:pt-2">
                {drafts.map((p) => (
                  <div
                    key={p.id}
                    className={p.id === highlightId ? 'rounded-v2-lg ring-2 ring-teal-400 transition-all duration-700' : ''}
                  >
                    <PostRow post={p} onPublish={publishVariation} onDelete={deletePost} onCopy={copyPost} onView={setViewing} isAr={isAr} />
                  </div>
                ))}
              </div>
            )
          )}

          {tab === 'published' && (
            published.length === 0 ? (
              <EmptyState
                title={isAr ? 'لا توجد منشورات بعد' : 'No published posts yet'}
                description={isAr ? 'عند نشر مسوداتك، ستظهر هنا' : 'Once you publish your drafts, they appear here'}
              />
            ) : (
              <div className="flex flex-col lg:grid lg:grid-cols-2 lg:gap-4 lg:pt-2">
                {published.map((p) => (
                  <PostRow key={p.id} post={p} onPublish={publishVariation} onDelete={deletePost} onCopy={copyPost} onView={setViewing} isAr={isAr} />
                ))}
              </div>
            )
          )}

          {tab === 'templates' && (
            <div className="flex flex-col lg:grid lg:grid-cols-3 lg:gap-4 lg:pt-2">
              {TEMPLATES.map((tp) => (
                <button
                  key={tp.id}
                  type="button"
                  onClick={() => {
                    setTopic(tp.title);
                    setComposerOpen(true);
                  }}
                  className="grid grid-cols-[1fr_auto_12px] items-center gap-3 border-b border-v2-line py-4 text-start hover:bg-v2-canvas-2 transition-colors duration-200 ease-out cursor-pointer
                    lg:flex lg:flex-col lg:items-start lg:gap-2 lg:rounded-v2-lg lg:border lg:bg-v2-surface lg:p-5 lg:hover:shadow-card lg:[grid-template-columns:none]"
                >
                  <div className="font-ar lg:w-full">
                    <span className="block text-[14px] font-semibold text-v2-ink lg:text-[15px]">{tp.title}</span>
                    <span className="block text-[12px] text-v2-dim lg:mt-1">{tp.description}</span>
                  </div>
                  <NumDisplay className="text-[11px] text-v2-body lg:mt-2 lg:text-[12px] lg:font-semibold lg:text-teal-700">
                    {tp.cost} {isAr ? 'توكن' : 'tokens'}
                  </NumDisplay>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" className="rtl:rotate-180 lg:hidden">
                    <path d="M4 3 L8 6 L4 9" stroke="var(--mute)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );

  return (
    <Phone>
      <Topbar
        back
        onBack={() => navigate('/v2/home')}
        title={t('v2.posts.title', isAr ? 'الاستوديو' : 'Studio')}
        bg="canvas"
        trailing={
          <Button
            variant="primary"
            size="sm"
            onClick={() => setComposerOpen(true)}
            leadingIcon={<span className="text-[14px] leading-none">+</span>}
          >
            {isAr ? 'جديد' : 'New'}
          </Button>
        }
      />

      {/* Tabs row — full width on both. lg:max-w confines to list column */}
      <div className="border-b border-v2-line lg:border-b-0">
        <div role="tablist" aria-label={isAr ? 'مرشحات الاستوديو' : 'Studio filters'} className="flex gap-1 px-[22px] pt-3.5 -mb-px lg:px-0 lg:pt-0">
          {tabs.map((tb) => {
            const active = tab === tb.id;
            return (
              <button
                key={tb.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(tb.id)}
                className={`flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 font-ar text-[13px] cursor-pointer transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/30 ${
                  active
                    ? 'border-teal-700 text-v2-ink font-semibold'
                    : 'border-transparent text-v2-dim hover:text-v2-body font-medium'
                }`}
              >
                {tb.label}
                <span className={`rounded-full px-1.5 py-0.5 font-en text-[10px] tabular-nums ${
                  active ? 'bg-teal-50 text-teal-700' : 'bg-v2-canvas-2 text-v2-mute'
                }`}>
                  {tb.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile: single column. Desktop: 60/40 split — list (col-span-7) + composer (col-span-5). */}
      <div className="flex-1 px-[22px] pb-[110px] pt-2 lg:px-0 lg:pb-0 lg:pt-0 lg:grid lg:grid-cols-12 lg:gap-8">

        {/* List column */}
        <div className="lg:col-span-7 lg:pt-4">
          {ListBlock}
        </div>

        {/* Composer column — desktop only, sticky aside */}
        <aside className="hidden lg:col-span-5 lg:block lg:pt-4" aria-label={isAr ? 'منشئ المحتوى' : 'Content composer'}>
          <div className="sticky top-[88px]">
            <Card padding="lg" radius="lg" elevated>
              <div className="mb-4 flex items-center justify-between">
                <Eyebrow className="!text-teal-700">{isAr ? 'منشور جديد' : 'New post'}</Eyebrow>
                <span className="font-ar text-[11px] text-v2-dim">{isAr ? 'AI · مدعوم بصوتك' : 'AI · powered by your voice'}</span>
              </div>
              <Composer
                isAr={isAr}
                topic={topic}
                setTopic={setTopic}
                content={content}
                setContent={setContent}
                tone={tone}
                setTone={setTone}
                onGenerate={generate}
                generating={generating}
                desktop
              />
            </Card>
          </div>
        </aside>
      </div>

      {/* Mobile-only Sheet composer — never opens on desktop */}
      <Sheet
        open={composerOpen && !desktopComposerVisible}
        onClose={() => setComposerOpen(false)}
        snapPoints={[90]}
        title={isAr ? 'منشور جديد' : 'New post'}
      >
        <Composer
          isAr={isAr}
          topic={topic}
          setTopic={setTopic}
          content={content}
          setContent={setContent}
          tone={tone}
          setTone={setTone}
          onGenerate={generate}
          generating={generating}
        />
      </Sheet>

      <BottomNav
        active="posts"
        items={[
          { id: 'home',    label: isAr ? 'الرئيسية' : 'Home',    icon: <span />, onSelect: () => navigate('/v2/home') },
          { id: 'analyze', label: isAr ? 'الرادار'   : 'Radar',   icon: <span />, onSelect: () => navigate('/v2/analyze') },
          { id: 'posts',   label: isAr ? 'الاستوديو' : 'Studio',  icon: <span />, onSelect: () => navigate('/v2/posts') },
          { id: 'profile', label: isAr ? 'حسابي'     : 'Account', icon: <span />, onSelect: () => navigate('/v2/me') },
        ]}
        fabIcon="check"
        onFabClick={() => setComposerOpen(true)}
      />

      {/* B.6: Post view modal — opens when any post row is clicked */}
      {viewing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => setViewing(null)}
        >
          <div
            className="max-h-[85dvh] w-full max-w-[640px] overflow-y-auto rounded-v2-lg bg-v2-surface p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex-1">
                <Eyebrow>{(isAr ? STATUS_LABEL_AR : STATUS_LABEL_EN)[viewing.status]} · {viewing.date}</Eyebrow>
                <h3 className="mt-1 font-ar text-[17px] font-bold text-v2-ink">{viewing.topic}</h3>
              </div>
              <button
                type="button"
                aria-label={isAr ? 'إغلاق' : 'Close'}
                onClick={() => setViewing(null)}
                className="rounded-full p-1 text-v2-mute hover:bg-v2-canvas-2 hover:text-v2-ink"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="M5 5 L15 15 M15 5 L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <pre className="mb-4 max-h-[50dvh] overflow-y-auto whitespace-pre-wrap rounded-v2-md border border-v2-line bg-v2-canvas p-4 font-ar text-[14px] leading-relaxed text-v2-ink">
              {viewing.content}
            </pre>
            <div className="mb-3 flex items-center gap-3 text-[12px] text-v2-dim">
              <NumDisplay>{viewing.words}</NumDisplay>
              <span className="font-ar">{isAr ? 'كلمة' : 'words'}</span>
              {viewing.tones.length > 0 && <>
                <span>·</span>
                <span className="font-ar">
                  {viewing.tones.map((tn) => (isAr ? TONE_LABEL_AR : TONE_LABEL_EN)[tn] || tn).join(isAr ? '، ' : ', ')}
                </span>
              </>}
            </div>
            <div className="flex flex-wrap gap-2">
              {viewing.status !== 'posted' && (
                <button
                  type="button"
                  onClick={() => { publishVariation(viewing); setViewing(null); }}
                  className="rounded-v2-md border border-teal-600 bg-teal-600 px-3.5 py-2 font-ar text-[13px] font-semibold text-white hover:bg-teal-700 cursor-pointer"
                >
                  {isAr ? 'نشر على LinkedIn' : 'Publish to LinkedIn'}
                </button>
              )}
              <button
                type="button"
                onClick={() => copyPost(viewing)}
                className="rounded-v2-md border border-v2-line bg-v2-surface px-3.5 py-2 font-ar text-[13px] font-medium text-v2-ink hover:bg-v2-canvas-2 cursor-pointer"
              >
                {isAr ? 'نسخ' : 'Copy'}
              </button>
              <button
                type="button"
                onClick={() => { deletePost(viewing); setViewing(null); }}
                className="ms-auto rounded-v2-md border border-v2-line bg-v2-surface px-3.5 py-2 font-ar text-[13px] font-medium text-red-600 hover:bg-red-50 cursor-pointer"
              >
                {isAr ? 'حذف' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Phone>
  );
}

export default Posts;
