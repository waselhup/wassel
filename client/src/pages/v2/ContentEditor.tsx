/**
 * /v2/posts/:id — Content editor.
 *
 * Split view per type:
 *   - Post: preview + hashtags + copy + refinement chips
 *   - Carousel: 5-8 slides preview (swipeable) + caption + PDF export + chips
 *   - Repurpose: 3 tabs (Carousel | Video Script | Follow-up Post) + chips per tab
 *
 * Actions:
 *   - Copy to clipboard
 *   - Mark as published (writes status='published_externally')
 *   - Set reminder (in-app/email at a chosen time)
 *   - Archive / restore
 *   - Export carousel as PDF (0 tokens)
 *
 * Refinement chips: first 5 per version free (A12). Counter shown.
 */

import { useEffect, useMemo, useState } from 'react';
import { useLocation, useRoute } from 'wouter';
import { useTranslation } from 'react-i18next';
import {
  ChevronLeft, ChevronRight, Copy, Check, Send, BellRing, Archive,
  RotateCcw, FileDown, AlertCircle, Sparkles, Hash, Film, FileText, Layers, Repeat, X,
} from 'lucide-react';
import Phone from '@/components/v2/Phone';
import Topbar from '@/components/v2/Topbar';
import Card from '@/components/v2/Card';
import Button from '@/components/v2/Button';
import Eyebrow from '@/components/v2/Eyebrow';
import Skeleton from '@/components/v2/Skeleton';
import NumDisplay from '@/components/v2/NumDisplay';
import {
  trpc,
  type ContentResultShape,
  type ContentTypeShape,
  type PostShape,
  type CarouselShape,
  type RepurposeBundleShape,
} from '@/lib/trpc';

type VersionData = Awaited<ReturnType<typeof trpc.content.getVersion>>;

const CHIPS: Array<{ chipType: string; arLabel: string; enLabel: string }> = [
  { chipType: 'shorter',           arLabel: 'اجعله أقصر',         enLabel: 'Make shorter' },
  { chipType: 'longer',            arLabel: 'اجعله أطول',         enLabel: 'Make longer' },
  { chipType: 'more_professional', arLabel: 'أكثر احترافية',      enLabel: 'More professional' },
  { chipType: 'more_personal',     arLabel: 'أكثر شخصية',         enLabel: 'More personal' },
  { chipType: 'different_hook',    arLabel: 'افتتاحية مختلفة',    enLabel: 'Different hook' },
  { chipType: 'different_cta',     arLabel: 'دعوة مختلفة',        enLabel: 'Different CTA' },
  { chipType: 'rephrase',          arLabel: 'إعادة صياغة',        enLabel: 'Rephrase' },
];

const REMINDER_PRESETS: Array<{
  key: string;
  arLabel: string;
  enLabel: string;
  fromNow: (now: Date) => Date;
}> = [
  { key: 'in_1h',     arLabel: 'بعد ساعة',     enLabel: 'In 1 hour',     fromNow: (n) => new Date(n.getTime() + 60 * 60 * 1000) },
  { key: 'in_3h',     arLabel: 'بعد 3 ساعات',  enLabel: 'In 3 hours',    fromNow: (n) => new Date(n.getTime() + 3 * 60 * 60 * 1000) },
  { key: 'tomorrow_9am', arLabel: 'غداً 9 صباحاً', enLabel: 'Tomorrow 9 AM',
    fromNow: (n) => { const d = new Date(n); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d; } },
  { key: 'tomorrow_7pm', arLabel: 'غداً 7 مساءً', enLabel: 'Tomorrow 7 PM',
    fromNow: (n) => { const d = new Date(n); d.setDate(d.getDate() + 1); d.setHours(19, 0, 0, 0); return d; } },
];

export default function ContentEditor() {
  const { i18n } = useTranslation();
  const isAr = (i18n.language || 'ar').startsWith('ar');
  const [, navigate] = useLocation();
  const [match, params] = useRoute<{ id: string }>('/v2/posts/:id');
  const versionId = match ? params.id : null;

  const [data, setData] = useState<VersionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [result, setResult] = useState<ContentResultShape | null>(null);
  const [refinementsUsed, setRefinementsUsed] = useState(0);
  const [refining, setRefining] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderSubmitting, setReminderSubmitting] = useState(false);

  const [activeSlide, setActiveSlide] = useState(0);
  const [activeRepurposeTab, setActiveRepurposeTab] = useState<'carousel' | 'video' | 'follow_up'>('carousel');

  const [justBuiltInfo, setJustBuiltInfo] = useState<{ isCacheHit: boolean; tokensCharged: number; toneViolations: string[] } | null>(null);

  useEffect(() => {
    if (!versionId) return;
    try {
      const raw = sessionStorage.getItem(`content.justBuilt.${versionId}`);
      if (raw) {
        setJustBuiltInfo(JSON.parse(raw));
        sessionStorage.removeItem(`content.justBuilt.${versionId}`);
      }
    } catch { /* ignore */ }
  }, [versionId]);

  useEffect(() => {
    if (!versionId) {
      navigate('/v2/posts', { replace: true });
      return;
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versionId]);

  async function load() {
    if (!versionId) return;
    setLoading(true);
    setError(null);
    try {
      const d = await trpc.content.getVersion({ versionId });
      setData(d);
      setRefinementsUsed(d.refinementsUsed ?? 0);
      if (d.cache?.result) setResult(d.cache.result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  const contentType: ContentTypeShape | null = data?.version?.content_type ?? null;
  const isLegacy = data?.version?.status === 'legacy';
  const remainingFree = Math.max(0, (data?.freeRefinementsPerVersion ?? 5) - refinementsUsed);

  const visibleText = useMemo(() => {
    if (!result) return '';
    if (contentType === 'post') {
      const p = result as PostShape;
      return `${p.body}\n\n${(p.hashtags ?? []).map((h) => h.startsWith('#') ? h : `#${h}`).join(' ')}`.trim();
    }
    if (contentType === 'carousel') {
      const c = result as CarouselShape;
      const slides = c.slides.map((s, i) => `--- Slide ${i + 1} ---\n${s.title}\n\n${s.body}`).join('\n\n');
      const tags = (c.hashtags ?? []).map((h) => h.startsWith('#') ? h : `#${h}`).join(' ');
      return `${c.caption}\n\n${slides}\n\n${tags}`.trim();
    }
    if (contentType === 'repurpose_bundle') {
      const r = result as RepurposeBundleShape;
      if (activeRepurposeTab === 'video') {
        return `Hook: ${r.short_video_script.hook}\n\n${r.short_video_script.beats.map((b) => `- ${b}`).join('\n')}\n\nCTA: ${r.short_video_script.cta}`;
      }
      if (activeRepurposeTab === 'follow_up') {
        const tags = (r.follow_up_post.hashtags ?? []).map((h) => h.startsWith('#') ? h : `#${h}`).join(' ');
        return `${r.follow_up_post.body}\n\n${tags}`.trim();
      }
      // carousel tab
      const slides = r.carousel.slides.map((s, i) => `--- Slide ${i + 1} ---\n${s.title}\n\n${s.body}`).join('\n\n');
      const tags = (r.carousel.hashtags ?? []).map((h) => h.startsWith('#') ? h : `#${h}`).join(' ');
      return `${r.carousel.caption}\n\n${slides}\n\n${tags}`.trim();
    }
    return '';
  }, [result, contentType, activeRepurposeTab]);

  async function handleRefine(chipType: string) {
    if (!versionId) return;
    setRefining(chipType);
    setError(null);
    try {
      const out = await trpc.content.refine({
        versionId,
        chipType,
        language: isAr ? 'ar' : 'en',
      });
      setResult(out.result);
      setRefinementsUsed(out.refinementIndex);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRefining(null);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(visibleText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError(isAr ? 'تعذر النسخ' : 'Copy failed');
    }
  }

  async function handleExport() {
    if (!versionId || contentType !== 'carousel') return;
    setExporting(true);
    try {
      const out = await trpc.content.exportCarouselPdf({ versionId });
      const bytes = Uint8Array.from(atob(out.base64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: out.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = out.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(false);
    }
  }

  async function handlePublish() {
    if (!versionId) return;
    setPublishing(true);
    try {
      await trpc.content.markPublished({ versionId });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPublishing(false);
    }
  }

  async function handleArchive() {
    if (!versionId) return;
    setArchiving(true);
    try {
      await trpc.content.archive({ versionId });
      navigate('/v2/posts');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setArchiving(false);
    }
  }

  async function handleRestore() {
    if (!versionId) return;
    try {
      await trpc.content.restore({ versionId });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleSetReminder(remindAt: Date) {
    if (!versionId) return;
    setReminderSubmitting(true);
    try {
      await trpc.content.setReminder({
        versionId,
        remindAt: remindAt.toISOString(),
        channels: ['in_app'],
      });
      setReminderOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setReminderSubmitting(false);
    }
  }

  if (loading) {
    return (
      <Phone>
        <Topbar back onBack={() => navigate('/v2/posts')} bg="canvas" leading={<span className="px-2 font-ar text-[15px] font-bold text-v2-ink">{isAr ? 'محتواك' : 'Your content'}</span>} />
        <div className="flex-1 px-[22px] pt-6">
          <Skeleton variant="text" lines={2} className="mb-6" />
          <Skeleton variant="card" className="mb-4" />
          <Skeleton variant="card" />
        </div>
      </Phone>
    );
  }

  if (!data || !result) {
    return (
      <Phone>
        <Topbar back onBack={() => navigate('/v2/posts')} bg="canvas" />
        <div className="flex-1 px-[22px] pt-10">
          <Card padding="lg" radius="lg" className="text-center">
            <Eyebrow className="mb-2 block">CONTENT</Eyebrow>
            <h2 className="font-ar text-[18px] font-bold text-v2-ink">{isAr ? 'لم نجد المحتوى' : 'Content not found'}</h2>
            {error && <p className="mt-2 font-ar text-[13px] text-rose-700">{error}</p>}
            <Button variant="primary" className="mt-5" onClick={() => navigate('/v2/posts')}>
              {isAr ? 'العودة للمحتوى' : 'Back to content'}
            </Button>
          </Card>
        </div>
      </Phone>
    );
  }

  const TypeIcon = contentType === 'carousel' ? Layers : contentType === 'repurpose_bundle' ? Repeat : FileText;
  const typeLabelAr = contentType === 'post' ? 'منشور' : contentType === 'carousel' ? 'كاروسيل' : 'حزمة إعادة توظيف';
  const typeLabelEn = contentType === 'post' ? 'Post' : contentType === 'carousel' ? 'Carousel' : 'Repurpose Bundle';

  return (
    <Phone>
      <Topbar
        back
        onBack={() => navigate('/v2/posts')}
        bg="canvas"
        leading={<span className="px-2 font-ar text-[15px] font-bold text-v2-ink">{isAr ? typeLabelAr : typeLabelEn}</span>}
        trailing={
          <button
            type="button"
            aria-label={isAr ? 'إغلاق' : 'Close'}
            onClick={() => navigate('/v2/posts')}
            className="rounded-full p-1 text-v2-mute hover:bg-v2-canvas-2 hover:text-v2-ink"
          >
            <X size={18} aria-hidden="true" />
          </button>
        }
      />

      <div className="flex-1 px-[22px] pb-[120px] lg:px-0 lg:pb-6">
        {/* Header strip */}
        <div className="mt-4 mb-4 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-50 text-teal-700">
            <TypeIcon size={16} aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-ar text-[14px] font-bold text-v2-ink line-clamp-1">{data.version.display_title}</h2>
            <p className="font-ar text-[11px] text-v2-dim">
              {new Date(data.version.created_at).toLocaleDateString(isAr ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              {' · '}
              <span dir="ltr">{data.version.language.toUpperCase()}</span>
            </p>
          </div>
          {justBuiltInfo && justBuiltInfo.isCacheHit && (
            <span className="rounded-full bg-teal-50 px-2 py-0.5 font-ar text-[10px] font-semibold text-teal-700">
              {isAr ? 'مخزّن — 0 توكن' : 'Cached — 0 tokens'}
            </span>
          )}
        </div>

        {error && (
          <Card padding="md" radius="md" className="mb-4 border-rose-200 bg-rose-50">
            <div className="flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0 text-rose-600" />
              <p className="font-ar text-[13px] text-rose-700">{error}</p>
            </div>
          </Card>
        )}

        {justBuiltInfo && justBuiltInfo.toneViolations.length > 0 && (
          <Card padding="md" radius="md" className="mb-4 border-amber-200 bg-amber-50">
            <p className="font-ar text-[12px] text-amber-800">
              {isAr
                ? 'لاحظ المحرر بعض الأنماط غير المُفضّلة في النص. يمكنك تحسينها عبر التحسينات السريعة.'
                : 'The editor flagged a few unwelcome patterns. You can polish them with the quick refinements.'}
            </p>
          </Card>
        )}

        {/* Split view per type */}
        <div className="lg:grid lg:grid-cols-12 lg:gap-6">
          {/* Main preview */}
          <div className="lg:col-span-8">
            {contentType === 'post' && <PostPreview post={result as PostShape} isAr={isAr} />}
            {contentType === 'carousel' && (
              <CarouselSlider
                carousel={result as CarouselShape}
                activeIdx={activeSlide}
                onChange={setActiveSlide}
                isAr={isAr}
              />
            )}
            {contentType === 'repurpose_bundle' && (
              <RepurposeTabs
                bundle={result as RepurposeBundleShape}
                activeTab={activeRepurposeTab}
                onChange={setActiveRepurposeTab}
                isAr={isAr}
              />
            )}
          </div>

          {/* Actions panel */}
          <aside className="mt-5 lg:col-span-4 lg:mt-0">
            {/* Refinements */}
            {!isLegacy && (
              <Card padding="md" radius="lg" className="mb-4">
                <div className="mb-2 flex items-center justify-between">
                  <Eyebrow>{isAr ? 'تحسينات سريعة' : 'Quick refinements'}</Eyebrow>
                  <span className="font-ar text-[11px] text-v2-dim">
                    {remainingFree > 0
                      ? (isAr ? `${remainingFree} من 5 مشمولة` : `${remainingFree} of 5 included`)
                      : (isAr ? '5 توكنات/تحسين' : '5 tokens / refinement')}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {CHIPS.map((c) => (
                    <button
                      key={c.chipType}
                      type="button"
                      disabled={!!refining}
                      onClick={() => handleRefine(c.chipType)}
                      className="inline-flex items-center gap-1 rounded-v2-pill border border-v2-line bg-v2-surface px-3 py-1 font-ar text-[12px] text-v2-body hover:border-teal-300 hover:bg-teal-50/40 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/30"
                    >
                      {refining === c.chipType
                        ? <span className="inline-block h-3 w-3 animate-spin rounded-full border border-teal-600 border-t-transparent" />
                        : <Sparkles size={11} aria-hidden="true" />}
                      {isAr ? c.arLabel : c.enLabel}
                    </button>
                  ))}
                </div>
              </Card>
            )}

            {isLegacy && (
              <Card padding="md" radius="md" className="mb-4 border-amber-200 bg-amber-50">
                <p className="font-ar text-[12px] text-amber-800">
                  {isAr
                    ? 'هذا محتوى قديم للقراءة فقط. ابدأ محتوى جديداً لتفعيل التحسينات.'
                    : 'This is legacy content (read-only). Start new content to refine.'}
                </p>
              </Card>
            )}

            {/* Primary actions */}
            <Card padding="md" radius="lg" className="mb-4">
              <Eyebrow className="mb-2 block">{isAr ? 'إجراءات' : 'Actions'}</Eyebrow>
              <div className="flex flex-col gap-2">
                <Button
                  variant="primary"
                  size="md"
                  fullWidth
                  leadingIcon={copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                  onClick={handleCopy}
                >
                  {copied ? (isAr ? 'تم النسخ ✓' : 'Copied ✓') : (isAr ? 'نسخ' : 'Copy')}
                </Button>

                {contentType === 'carousel' && (
                  <Button
                    variant="secondary"
                    size="md"
                    fullWidth
                    disabled={exporting}
                    leadingIcon={<FileDown size={14} aria-hidden="true" />}
                    onClick={handleExport}
                  >
                    {exporting ? (isAr ? 'جارٍ التصدير…' : 'Exporting…') : (isAr ? 'تصدير PDF' : 'Export PDF')}
                  </Button>
                )}

                {data.version.status !== 'published_externally' && !isLegacy && (
                  <Button
                    variant="secondary"
                    size="md"
                    fullWidth
                    disabled={publishing}
                    leadingIcon={<Send size={14} aria-hidden="true" />}
                    onClick={handlePublish}
                  >
                    {publishing ? (isAr ? 'جارٍ التحديث…' : 'Updating…') : (isAr ? 'تم النشر على LinkedIn' : 'Mark as published')}
                  </Button>
                )}

                {!isLegacy && (
                  <Button
                    variant="secondary"
                    size="md"
                    fullWidth
                    leadingIcon={<BellRing size={14} aria-hidden="true" />}
                    onClick={() => setReminderOpen((x) => !x)}
                  >
                    {data.pendingReminder
                      ? (isAr ? 'تعديل التذكير' : 'Edit reminder')
                      : (isAr ? 'تذكير لاحقاً' : 'Remind me later')}
                  </Button>
                )}

                {reminderOpen && (
                  <div className="mt-1 rounded-v2-md border border-teal-200 bg-teal-50 p-3">
                    <Eyebrow className="mb-2 block">{isAr ? 'تذكّرني بالنشر' : 'Remind me to post'}</Eyebrow>
                    <div className="flex flex-col gap-2">
                      {REMINDER_PRESETS.map((p) => (
                        <button
                          key={p.key}
                          type="button"
                          disabled={reminderSubmitting}
                          onClick={() => handleSetReminder(p.fromNow(new Date()))}
                          className="rounded-v2-md border border-teal-100 bg-v2-surface px-3 py-2 text-start font-ar text-[13px] text-v2-ink hover:bg-teal-100/40 disabled:opacity-50"
                        >
                          {isAr ? p.arLabel : p.enLabel}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {data.version.status === 'archived' ? (
                  <Button
                    variant="secondary"
                    size="md"
                    fullWidth
                    leadingIcon={<RotateCcw size={14} aria-hidden="true" />}
                    onClick={handleRestore}
                  >
                    {isAr ? 'استعادة' : 'Restore'}
                  </Button>
                ) : !isLegacy && (
                  <Button
                    variant="ghost"
                    size="md"
                    fullWidth
                    disabled={archiving}
                    leadingIcon={<Archive size={14} aria-hidden="true" />}
                    onClick={handleArchive}
                  >
                    {archiving ? (isAr ? 'جارٍ الأرشفة…' : 'Archiving…') : (isAr ? 'أرشفة' : 'Archive')}
                  </Button>
                )}
              </div>
            </Card>

            {/* Cache + token info */}
            {data.cache && (
              <div className="rounded-v2-md border border-v2-line bg-v2-canvas-2/60 p-3 font-ar text-[11px] text-v2-dim">
                <div className="flex items-center justify-between">
                  <span>{isAr ? 'يستخدم النسخة المخزّنة' : 'Using cached version'}</span>
                  <span><NumDisplay>{data.cache.hit_count}</NumDisplay>x</span>
                </div>
                {data.version.tokens_charged > 0 && (
                  <div className="mt-1 flex items-center justify-between">
                    <span>{isAr ? 'التوكنات المستهلكة' : 'Tokens used'}</span>
                    <span className="font-semibold text-v2-body"><NumDisplay>{data.version.tokens_charged}</NumDisplay></span>
                  </div>
                )}
              </div>
            )}
          </aside>
        </div>
      </div>
    </Phone>
  );
}

/* ── Sub-components (inline per Sprint 3+4 minimal-touch principle) ── */

function HashtagRow({ tags, isAr }: { tags: string[]; isAr: boolean }) {
  if (!tags || tags.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      <Hash size={11} className="text-v2-mute" aria-hidden="true" />
      {tags.map((h, i) => (
        <span
          key={i}
          dir="ltr"
          className="rounded-full bg-teal-50 px-2 py-0.5 font-en text-[11px] font-medium text-teal-700"
        >
          {h.startsWith('#') ? h : `#${h}`}
        </span>
      ))}
      <span className="ms-auto font-ar text-[10px] text-v2-dim">
        <NumDisplay>{tags.length}</NumDisplay>{isAr ? ' هاشتاج' : ' tags'}
      </span>
    </div>
  );
}

function PostPreview({ post, isAr }: { post: PostShape; isAr: boolean }) {
  return (
    <Card padding="lg" radius="lg" elevated>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <Eyebrow>{isAr ? 'المنشور' : 'Post'}</Eyebrow>
        <span className="font-ar text-[11px] text-v2-dim">
          <NumDisplay>{post.body.length}</NumDisplay> {isAr ? 'حرف' : 'chars'}
        </span>
      </div>
      <div
        dir={isAr ? 'rtl' : 'ltr'}
        className="whitespace-pre-wrap font-ar text-[14px] leading-relaxed text-v2-ink"
      >
        {post.body}
      </div>
      <HashtagRow tags={post.hashtags ?? []} isAr={isAr} />
    </Card>
  );
}

function CarouselSlider({
  carousel, activeIdx, onChange, isAr,
}: {
  carousel: CarouselShape;
  activeIdx: number;
  onChange: (i: number) => void;
  isAr: boolean;
}) {
  const slide = carousel.slides[activeIdx] ?? carousel.slides[0];
  const total = carousel.slides.length;

  return (
    <div className="flex flex-col gap-3">
      <Card padding="lg" radius="lg" elevated className="relative">
        <div className="mb-2 flex items-center justify-between">
          <Eyebrow>{isAr ? 'الشريحة' : 'Slide'} <NumDisplay>{activeIdx + 1}</NumDisplay> / <NumDisplay>{total}</NumDisplay></Eyebrow>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={activeIdx === 0}
              onClick={() => onChange(Math.max(0, activeIdx - 1))}
              aria-label={isAr ? 'الشريحة السابقة' : 'Previous slide'}
              className="rounded-full p-1.5 text-v2-mute hover:bg-v2-canvas-2 hover:text-v2-ink disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {isAr ? <ChevronRight size={16} aria-hidden="true" /> : <ChevronLeft size={16} aria-hidden="true" />}
            </button>
            <button
              type="button"
              disabled={activeIdx >= total - 1}
              onClick={() => onChange(Math.min(total - 1, activeIdx + 1))}
              aria-label={isAr ? 'الشريحة التالية' : 'Next slide'}
              className="rounded-full p-1.5 text-v2-mute hover:bg-v2-canvas-2 hover:text-v2-ink disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {isAr ? <ChevronLeft size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
            </button>
          </div>
        </div>
        <div className="min-h-[200px] rounded-v2-md border border-v2-line bg-v2-canvas-2/50 p-5">
          <h3 dir={isAr ? 'rtl' : 'ltr'} className="font-ar text-[18px] font-bold leading-snug text-v2-ink">{slide?.title || ''}</h3>
          <p dir={isAr ? 'rtl' : 'ltr'} className="mt-3 whitespace-pre-wrap font-ar text-[13px] leading-relaxed text-v2-body">{slide?.body || ''}</p>
          {slide?.image_prompt && (
            <div className="mt-4 rounded-v2-md border border-dashed border-v2-line bg-v2-surface p-3">
              <Eyebrow className="mb-1 block">{isAr ? 'وصف الصورة (اختياري)' : 'Image prompt (optional)'}</Eyebrow>
              <p dir="ltr" className="font-en text-[11px] text-v2-dim">{slide.image_prompt}</p>
            </div>
          )}
        </div>
        <div className="mt-3 flex items-center justify-center gap-1.5">
          {carousel.slides.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onChange(i)}
              aria-label={`${isAr ? 'الشريحة' : 'Slide'} ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${i === activeIdx ? 'w-6 bg-teal-600' : 'w-1.5 bg-v2-line hover:bg-v2-mute'}`}
            />
          ))}
        </div>
      </Card>

      <Card padding="md" radius="md">
        <Eyebrow className="mb-2 block">{isAr ? 'الوصف' : 'Caption'}</Eyebrow>
        <p dir={isAr ? 'rtl' : 'ltr'} className="whitespace-pre-wrap font-ar text-[13px] leading-relaxed text-v2-body">{carousel.caption}</p>
        <HashtagRow tags={carousel.hashtags ?? []} isAr={isAr} />
      </Card>
    </div>
  );
}

function RepurposeTabs({
  bundle, activeTab, onChange, isAr,
}: {
  bundle: RepurposeBundleShape;
  activeTab: 'carousel' | 'video' | 'follow_up';
  onChange: (t: 'carousel' | 'video' | 'follow_up') => void;
  isAr: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div role="tablist" className="flex gap-1 border-b border-v2-line">
        {(['carousel', 'video', 'follow_up'] as const).map((tab) => {
          const active = activeTab === tab;
          const arLabel = tab === 'carousel' ? 'الكاروسيل' : tab === 'video' ? 'نص الفيديو' : 'المنشور التالي';
          const enLabel = tab === 'carousel' ? 'Carousel' : tab === 'video' ? 'Video script' : 'Follow-up';
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(tab)}
              className={`flex items-center gap-1.5 border-b-2 px-3 py-2 font-ar text-[13px] transition-colors ${
                active ? 'border-teal-700 font-semibold text-v2-ink' : 'border-transparent text-v2-dim hover:text-v2-body'
              }`}
            >
              {tab === 'video' ? <Film size={13} aria-hidden="true" />
                : tab === 'follow_up' ? <FileText size={13} aria-hidden="true" />
                : <Layers size={13} aria-hidden="true" />}
              {isAr ? arLabel : enLabel}
            </button>
          );
        })}
      </div>

      {activeTab === 'carousel' && (
        <Card padding="lg" radius="lg" elevated>
          <Eyebrow className="mb-2 block">{isAr ? 'الكاروسيل' : 'Carousel'}</Eyebrow>
          <p dir={isAr ? 'rtl' : 'ltr'} className="mb-4 whitespace-pre-wrap font-ar text-[13px] leading-relaxed text-v2-body">{bundle.carousel.caption}</p>
          <div className="flex flex-col gap-3">
            {bundle.carousel.slides.map((s, i) => (
              <div key={i} className="rounded-v2-md border border-v2-line bg-v2-canvas-2/40 p-3">
                <p className="mb-1 font-en text-[10px] font-bold uppercase tracking-wider text-teal-700">
                  Slide <NumDisplay>{i + 1}</NumDisplay>
                </p>
                <h4 dir={isAr ? 'rtl' : 'ltr'} className="font-ar text-[14px] font-bold text-v2-ink">{s.title}</h4>
                <p dir={isAr ? 'rtl' : 'ltr'} className="mt-1 whitespace-pre-wrap font-ar text-[12px] leading-relaxed text-v2-body">{s.body}</p>
              </div>
            ))}
          </div>
          <HashtagRow tags={bundle.carousel.hashtags ?? []} isAr={isAr} />
        </Card>
      )}

      {activeTab === 'video' && (
        <Card padding="lg" radius="lg" elevated>
          <Eyebrow className="mb-2 block">{isAr ? 'نص الفيديو (60 ثانية)' : 'Video script (60 sec)'}</Eyebrow>
          <div className="space-y-3 font-ar text-[14px] text-v2-ink">
            <div>
              <p className="mb-1 font-en text-[10px] font-bold uppercase tracking-wider text-teal-700">Hook · 0:00–0:03</p>
              <p dir={isAr ? 'rtl' : 'ltr'} className="leading-relaxed">{bundle.short_video_script.hook}</p>
            </div>
            <div>
              <p className="mb-1 font-en text-[10px] font-bold uppercase tracking-wider text-teal-700">Beats</p>
              <ol className="list-decimal space-y-1 ps-5 font-ar text-[13px] text-v2-body">
                {bundle.short_video_script.beats.map((b, i) => (
                  <li key={i} dir={isAr ? 'rtl' : 'ltr'}>{b}</li>
                ))}
              </ol>
            </div>
            <div>
              <p className="mb-1 font-en text-[10px] font-bold uppercase tracking-wider text-teal-700">CTA</p>
              <p dir={isAr ? 'rtl' : 'ltr'} className="leading-relaxed">{bundle.short_video_script.cta}</p>
            </div>
          </div>
        </Card>
      )}

      {activeTab === 'follow_up' && (
        <Card padding="lg" radius="lg" elevated>
          <Eyebrow className="mb-2 block">{isAr ? 'المنشور التالي' : 'Follow-up post'}</Eyebrow>
          <p dir={isAr ? 'rtl' : 'ltr'} className="whitespace-pre-wrap font-ar text-[14px] leading-relaxed text-v2-ink">{bundle.follow_up_post.body}</p>
          <HashtagRow tags={bundle.follow_up_post.hashtags ?? []} isAr={isAr} />
        </Card>
      )}
    </div>
  );
}
