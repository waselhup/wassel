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
type Status = 'مسودة' | 'جاهز للنشر' | 'منشور';
type Tone = 'professional' | 'friendly' | 'motivational' | 'analytical';

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

const TEMPLATES: Template[] = [
  { id: 't1', title: 'منشور رأي', description: 'مقدمة جذابة + 3 نقاط + خاتمة', cost: 15 },
  { id: 't2', title: 'دراسة حالة', description: 'تحدّي · حل · نتيجة', cost: 25 },
  { id: 't3', title: 'تأمل أسبوعي', description: 'ماذا تعلّمت هذا الأسبوع', cost: 12 },
  { id: 't4', title: 'إعلان إنجاز', description: 'متواضع لكن واثق', cost: 10 },
  { id: 't5', title: 'منشور سرد قصصي', description: 'لحظة → درس → دعوة', cost: 18 },
];

const TONES: { id: Tone; label: string }[] = [
  { id: 'professional', label: 'مهنية' },
  { id: 'friendly',     label: 'ودودة' },
  { id: 'motivational', label: 'ملهمة' },
  { id: 'analytical',   label: 'تحليلية' },
];

const COMPOSE_COST = 30;

function statusFromServer(s: 'draft' | 'scheduled' | 'posted'): Status {
  if (s === 'posted') return 'منشور';
  if (s === 'scheduled') return 'جاهز للنشر';
  return 'مسودة';
}

function relativeArDate(iso: string): string {
  const created = new Date(iso).getTime();
  if (Number.isNaN(created)) return '';
  const diffMs = Date.now() - created;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'الآن';
  if (diffMin < 60) return `قبل ${diffMin} د`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `قبل ${diffH} س`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `قبل ${diffD} ي`;
  return new Date(iso).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' });
}

function toUiPost(p: ServerPost): UiPost {
  const content = p.content || '';
  const topic = (p.topic || content.slice(0, 60) || 'منشور').trim();
  const preview = content.replace(/\s+/g, ' ').trim().slice(0, 200);
  return {
    id: p.id,
    topic,
    content,
    preview: preview || '—',
    status: statusFromServer(p.status),
    date: relativeArDate(p.created_at),
    words: content ? content.trim().split(/\s+/).length : 0,
    tones: Array.isArray(p.tones) ? p.tones : [],
  };
}

function StatusPill({ status }: { status: Status }) {
  const tone =
    status === 'جاهز للنشر' ? 'bg-teal-50 text-teal-700 border-teal-100' :
    status === 'منشور'      ? 'bg-v2-indigo-50 text-v2-indigo border-v2-indigo/30' :
                              'bg-v2-canvas-2 text-v2-dim border-v2-line';
  return (
    <span className={`shrink-0 rounded-full border px-2 py-0.5 font-ar text-[10px] font-semibold whitespace-nowrap ${tone}`}>
      {status}
    </span>
  );
}

interface PostRowProps {
  post: UiPost;
  onPublish: (p: UiPost) => void;
  onDelete: (p: UiPost) => void;
  onCopy: (p: UiPost) => void;
}

function PostRow({ post, onPublish, onDelete, onCopy }: PostRowProps) {
  return (
    <div className="border-b border-v2-line py-4 lg:rounded-v2-lg lg:border lg:bg-v2-surface lg:p-5 lg:hover:shadow-card lg:transition-shadow lg:duration-200 lg:ease-out">
      <div className="mb-1.5 flex items-start justify-between gap-2.5">
        <div className="flex-1 font-ar text-[14px] font-semibold text-v2-ink lg:text-[15px]">
          {post.topic}
        </div>
        <StatusPill status={post.status} />
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
            {TONE_LABEL_AR[tn] || tn}
          </span>
        ))}
      </div>
      <div className="flex items-center gap-3.5 text-[11px] text-v2-dim">
        <NumDisplay>{post.words}</NumDisplay>
        <span className="font-ar">كلمة</span>
        <span>·</span>
        <span className="font-ar">{post.date}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {post.status !== 'منشور' && (
          <button
            type="button"
            onClick={() => onPublish(post)}
            className="rounded-v2-md border border-teal-600 bg-teal-600 px-3 py-1.5 font-ar text-[12px] font-semibold text-white hover:bg-teal-700 cursor-pointer transition-colors"
          >
            نشر على LinkedIn
          </button>
        )}
        <button
          type="button"
          onClick={() => onCopy(post)}
          className="rounded-v2-md border border-v2-line bg-v2-surface px-3 py-1.5 font-ar text-[12px] font-medium text-v2-ink hover:bg-v2-canvas-2 cursor-pointer transition-colors"
        >
          نسخ
        </button>
        <button
          type="button"
          onClick={() => onDelete(post)}
          className="rounded-v2-md border border-v2-line bg-v2-surface px-3 py-1.5 font-ar text-[12px] font-medium text-red-600 hover:bg-red-50 cursor-pointer transition-colors"
        >
          حذف
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

function Composer({ topic, setTopic, content, setContent, tone, setTone, onGenerate, generating = false, desktop = false }: ComposerProps) {
  const taMin = desktop ? 'min-h-[260px]' : 'min-h-[180px]';

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Eyebrow className="mb-2 block">الموضوع</Eyebrow>
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          className="w-full rounded-v2-md border border-v2-line bg-v2-surface px-3.5 py-3 font-ar text-[14px] text-v2-ink outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
        />
      </div>

      <div>
        <Eyebrow className="mb-2 block">المحتوى</Eyebrow>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="ابدأ بفكرتك الأساسية، أو اضغط ولّد وسنبدأ معك..."
          className={`${taMin} w-full resize-none rounded-v2-md border border-v2-line bg-v2-surface px-3.5 py-3.5 font-ar text-[14px] leading-relaxed text-v2-ink outline-none placeholder:text-v2-mute focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30`}
        />
      </div>

      <div>
        <Eyebrow className="mb-2.5 block">النبرة</Eyebrow>
        <div className="flex flex-wrap gap-1.5">
          {TONES.map((t) => (
            <Pill
              key={t.id}
              size="sm"
              tone="neutral"
              selected={tone === t.id}
              onClick={() => setTone(t.id)}
            >
              {t.label}
            </Pill>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between border-y border-v2-line py-3.5">
        <div>
          <Eyebrow>التكلفة</Eyebrow>
          <p className="mt-0.5 font-ar text-[14px] font-semibold text-v2-ink">
            <NumDisplay>{COMPOSE_COST}</NumDisplay> توكن · ≈ <NumDisplay>150</NumDisplay> كلمة
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
        {generating ? 'جارٍ التوليد...' : 'ولّد بالذكاء الاصطناعي'}
      </Button>
    </div>
  );
}

function Posts() {
  const [, navigate] = useLocation();
  const { t } = useTranslation();
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
    () => posts.filter((p) => p.status === 'draft' || p.status === 'scheduled').map(toUiPost),
    [posts]
  );
  const published = useMemo<UiPost[]>(
    () => posts.filter((p) => p.status === 'posted').map(toUiPost),
    [posts]
  );

  const generate = async () => {
    const trimmed = topic.trim();
    const fullTopic = content.trim() ? `${trimmed}\n\n${content.trim()}` : trimmed;
    if (fullTopic.length < 10) {
      showToast({ message: 'الموضوع قصير جداً — 10 أحرف على الأقل', tone: 'error' });
      return;
    }
    console.log('[v2/posts] generate STARTING', { topic: trimmed.slice(0, 60), tone });
    setGenerating(true);
    setComposerOpen(false);

    addJob({
      type: 'post-generation',
      title: trimmed || 'منشور جديد',
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
        message: t('posts.studio.generate.success', 'تم توليد المنشور بنجاح ✨'),
        tone: 'success',
      });
      // Clear inputs so the user is ready for the next one.
      setContent('');
    } catch (err: any) {
      console.error('[v2/posts] generate ERROR', err);
      // Pull a sensible message: tRPC errors expose .message; classifyClaudeError already returns Arabic.
      const code = (err as any)?.data?.code;
      let message: string = err?.message || 'فشل التوليد — حاول مرة أخرى';
      if (code === 'UNAUTHORIZED') {
        message = 'انتهت الجلسة — سجّل دخول من جديد';
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
    if (!confirm('حذف هذا المنشور؟')) return;
    try {
      await trpc.posts.delete({ id: p.id });
      setPosts((cur) => cur.filter((x) => x.id !== p.id));
      showToast({ message: 'تم الحذف', tone: 'success' });
    } catch (e: any) {
      showToast({ message: e?.message || 'فشل الحذف', tone: 'error' });
    }
  }

  function copyPost(p: UiPost) {
    const text = p.content.trim();
    try {
      navigator.clipboard.writeText(text);
      showToast({ message: 'تم النسخ', tone: 'success' });
    } catch {
      showToast({ message: 'تعذر النسخ — انسخ يدوياً', tone: 'error' });
    }
  }

  // On desktop the composer is "always visible" in its column — no toggle.
  const desktopComposerVisible = isDesktop;

  const counts = {
    drafts:    drafts.length,
    published: published.length,
    templates: TEMPLATES.length,
  };

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'drafts',    label: 'مسودات',  count: counts.drafts },
    { id: 'published', label: 'منشورة',  count: counts.published },
    { id: 'templates', label: 'قوالب',   count: counts.templates },
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
                title="لا توجد مسودات بعد"
                description="ابدأ بمنشور جديد من زر الأعلى أو من أحد القوالب الجاهزة."
              />
            ) : (
              <div className="flex flex-col lg:grid lg:grid-cols-2 lg:gap-4 lg:pt-2">
                {drafts.map((p) => (
                  <div
                    key={p.id}
                    className={p.id === highlightId ? 'rounded-v2-lg ring-2 ring-teal-400 transition-all duration-700' : ''}
                  >
                    <PostRow post={p} onPublish={publishVariation} onDelete={deletePost} onCopy={copyPost} />
                  </div>
                ))}
              </div>
            )
          )}

          {tab === 'published' && (
            published.length === 0 ? (
              <EmptyState
                title="لا توجد منشورات بعد"
                description="عند نشر مسوداتك، ستظهر هنا."
              />
            ) : (
              <div className="flex flex-col lg:grid lg:grid-cols-2 lg:gap-4 lg:pt-2">
                {published.map((p) => (
                  <PostRow key={p.id} post={p} onPublish={publishVariation} onDelete={deletePost} onCopy={copyPost} />
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
                    {tp.cost} توكن
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
        title={t('v2.posts.title', 'الاستوديو')}
        bg="canvas"
        trailing={
          <Button
            variant="primary"
            size="sm"
            onClick={() => setComposerOpen(true)}
            leadingIcon={<span className="text-[14px] leading-none">+</span>}
          >
            جديد
          </Button>
        }
      />

      {/* Tabs row — full width on both. lg:max-w confines to list column */}
      <div className="border-b border-v2-line lg:border-b-0">
        <div role="tablist" aria-label="مرشحات الاستوديو" className="flex gap-1 px-[22px] pt-3.5 -mb-px lg:px-0 lg:pt-0">
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
        <aside className="hidden lg:col-span-5 lg:block lg:pt-4" aria-label="منشئ المحتوى">
          <div className="sticky top-[88px]">
            <Card padding="lg" radius="lg" elevated>
              <div className="mb-4 flex items-center justify-between">
                <Eyebrow className="!text-teal-700">منشور جديد</Eyebrow>
                <span className="font-ar text-[11px] text-v2-dim">AI · مدعوم بصوتك</span>
              </div>
              <Composer
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
        title="منشور جديد"
      >
        <Composer
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
          { id: 'home',    label: 'الرئيسية', icon: <span />, onSelect: () => navigate('/v2/home') },
          { id: 'analyze', label: 'الرادار',  icon: <span />, onSelect: () => navigate('/v2/analyze') },
          { id: 'posts',   label: 'الاستوديو', icon: <span />, onSelect: () => navigate('/v2/posts') },
          { id: 'profile', label: 'حسابي',    icon: <span />, onSelect: () => navigate('/v2/me') },
        ]}
        fabIcon="check"
        onFabClick={() => setComposerOpen(true)}
      />
    </Phone>
  );
}

export default Posts;
