/**
 * /v2/posts — Career Content Hub.
 *
 * Three mode cards (Post 5t / Carousel 25t / Repurpose 15t).
 * Quick Start suggestions cached 24h from career_profile.
 * Recent versions + Archive (collapsed).
 * Legacy posts surface under a "Legacy" banner.
 *
 * Replaces the old Posts Studio (single-shot composer); the legacy
 * /api/trpc/posts.* routes still serve any legacy reads — those rows
 * have been migrated to content_versions with status='legacy'.
 */

import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { FileText, Layers, Repeat, Sparkles, Plus, ChevronRight, Archive, RotateCcw } from 'lucide-react';
import Phone from '@/components/v2/Phone';
import Topbar from '@/components/v2/Topbar';
import BottomNav from '@/components/v2/BottomNav';
import Card from '@/components/v2/Card';
import Eyebrow from '@/components/v2/Eyebrow';
import Skeleton from '@/components/v2/Skeleton';
import EmptyState from '@/components/v2/EmptyState';
import NumDisplay from '@/components/v2/NumDisplay';
import { trpc, type ContentTypeShape, type ContentVersionRow, type TopicSuggestionShape } from '@/lib/trpc';

const COST: Record<ContentTypeShape, number> = {
  post: 5,
  carousel: 25,
  repurpose_bundle: 15,
};

function ModeCard({
  type, cost, title, subtitle, duration, icon, onClick,
}: {
  type: ContentTypeShape;
  cost: number;
  title: string;
  subtitle: string;
  duration: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-start gap-3 rounded-v2-lg border border-v2-line bg-v2-surface p-5 text-start transition-all duration-200 ease-out hover:border-teal-300 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/30"
      data-content-type={type}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-teal-50 text-teal-700 transition-colors duration-200 group-hover:bg-teal-100">
        {icon}
      </div>
      <div className="flex-1">
        <h3 className="font-ar text-[16px] font-bold text-v2-ink">{title}</h3>
        <p className="mt-1 font-ar text-[13px] leading-relaxed text-v2-dim">{subtitle}</p>
      </div>
      <div className="flex w-full items-center justify-between border-t border-v2-line pt-3 text-[12px]">
        <span className="font-ar font-semibold text-teal-700">
          <NumDisplay>{cost}</NumDisplay> tokens
        </span>
        <span className="font-ar text-v2-dim">{duration}</span>
      </div>
    </button>
  );
}

function QuickStartCard({
  suggestion, onClick, isAr,
}: {
  suggestion: TopicSuggestionShape;
  onClick: () => void;
  isAr: boolean;
}) {
  const typeLabel = isAr
    ? (suggestion.recommended_type === 'post' ? 'منشور' : suggestion.recommended_type === 'carousel' ? 'كاروسيل' : 'حزمة')
    : (suggestion.recommended_type === 'post' ? 'Post' : suggestion.recommended_type === 'carousel' ? 'Carousel' : 'Bundle');

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-start gap-2 rounded-v2-md border border-v2-line bg-v2-surface p-4 text-start transition-all duration-200 ease-out hover:border-teal-200 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/30"
    >
      <span className="inline-flex items-center gap-1 rounded-v2-pill bg-teal-50 px-2 py-0.5 font-ar text-[10px] font-semibold text-teal-700">
        <Sparkles size={10} aria-hidden="true" />
        {typeLabel}
      </span>
      <p className="font-ar text-[13px] font-semibold leading-relaxed text-v2-ink line-clamp-2">
        {suggestion.topic}
      </p>
      <p className="font-ar text-[11px] leading-relaxed text-v2-dim line-clamp-2">
        {suggestion.reason}
      </p>
    </button>
  );
}

function VersionRow({
  v, isAr, onClick, onArchive, onRestore,
}: {
  v: ContentVersionRow;
  isAr: boolean;
  onClick: () => void;
  onArchive?: () => void;
  onRestore?: () => void;
}) {
  const typeLabel = isAr
    ? (v.content_type === 'post' ? 'منشور' : v.content_type === 'carousel' ? 'كاروسيل' : 'حزمة')
    : (v.content_type === 'post' ? 'Post' : v.content_type === 'carousel' ? 'Carousel' : 'Bundle');
  const statusLabel = isAr
    ? (v.status === 'active' ? 'نشط' : v.status === 'archived' ? 'مؤرشف' : v.status === 'published_externally' ? 'منشور' : 'قديم')
    : (v.status === 'active' ? 'Active' : v.status === 'archived' ? 'Archived' : v.status === 'published_externally' ? 'Published' : 'Legacy');
  const statusTone =
    v.status === 'published_externally' ? 'bg-v2-indigo-50 text-v2-indigo border-v2-indigo/30'
    : v.status === 'archived' ? 'bg-v2-canvas-2 text-v2-dim border-v2-line'
    : v.status === 'legacy' ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-teal-50 text-teal-700 border-teal-100';

  return (
    <div className="group rounded-v2-lg border border-v2-line bg-v2-surface p-4 transition-shadow duration-200 ease-out hover:shadow-card">
      <button
        type="button"
        onClick={onClick}
        className="block w-full text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/30"
      >
        <div className="mb-1.5 flex items-start justify-between gap-2">
          <span className="font-ar text-[13px] font-semibold text-v2-ink line-clamp-1">{v.display_title}</span>
          <span className={`shrink-0 rounded-full border px-2 py-0.5 font-ar text-[10px] font-semibold ${statusTone}`}>
            {statusLabel}
          </span>
        </div>
        <div className="flex items-center gap-2 font-ar text-[11px] text-v2-dim">
          <span className="font-semibold text-v2-body">{typeLabel}</span>
          <span>·</span>
          <span>{new Date(v.created_at).toLocaleDateString(isAr ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric' })}</span>
          {v.tokens_charged > 0 && (
            <>
              <span>·</span>
              <span><NumDisplay>{v.tokens_charged}</NumDisplay> {isAr ? 'توكن' : 'tokens'}</span>
            </>
          )}
        </div>
      </button>
      {(onArchive || onRestore) && v.status !== 'legacy' && (
        <div className="mt-3 flex flex-wrap gap-2">
          {onArchive && v.status === 'active' && (
            <button
              type="button"
              onClick={onArchive}
              className="inline-flex items-center gap-1 rounded-v2-md border border-v2-line bg-v2-surface px-2.5 py-1 font-ar text-[11px] font-medium text-v2-body hover:bg-v2-canvas-2"
            >
              <Archive size={12} aria-hidden="true" />
              {isAr ? 'أرشفة' : 'Archive'}
            </button>
          )}
          {onRestore && v.status === 'archived' && (
            <button
              type="button"
              onClick={onRestore}
              className="inline-flex items-center gap-1 rounded-v2-md border border-teal-200 bg-teal-50 px-2.5 py-1 font-ar text-[11px] font-medium text-teal-700 hover:bg-teal-100"
            >
              <RotateCcw size={12} aria-hidden="true" />
              {isAr ? 'استعادة' : 'Restore'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function Posts() {
  const { t, i18n } = useTranslation();
  const isAr = (i18n.language || 'ar').startsWith('ar');
  const [, navigate] = useLocation();

  const [suggestions, setSuggestions] = useState<TopicSuggestionShape[]>([]);
  const [versions, setVersions] = useState<ContentVersionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAr]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [versionsRes, suggestionsRes] = await Promise.all([
        trpc.content.listVersions({ limit: 50 }),
        trpc.content.topicSuggestions({ language: isAr ? 'ar' : 'en' }),
      ]);
      setVersions(versionsRes.versions);
      setSuggestions(suggestionsRes.suggestions);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  const active = useMemo(() => versions.filter((v) => v.status === 'active' || v.status === 'published_externally').slice(0, 5), [versions]);
  const archived = useMemo(() => versions.filter((v) => v.status === 'archived'), [versions]);
  const legacy = useMemo(() => versions.filter((v) => v.status === 'legacy'), [versions]);

  function startMode(type: ContentTypeShape) {
    navigate(`/v2/posts/new/${type}`);
  }

  function startSuggestion(s: TopicSuggestionShape) {
    const params = new URLSearchParams({ topic: s.topic });
    navigate(`/v2/posts/new/${s.recommended_type}?${params.toString()}`);
  }

  function openVersion(v: ContentVersionRow) {
    navigate(`/v2/posts/${v.id}`);
  }

  async function archiveVersion(v: ContentVersionRow) {
    try {
      await trpc.content.archive({ versionId: v.id });
      setVersions((cur) => cur.map((x) => x.id === v.id ? { ...x, status: 'archived' as const } : x));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function restoreVersion(v: ContentVersionRow) {
    try {
      await trpc.content.restore({ versionId: v.id });
      setVersions((cur) => cur.map((x) => x.id === v.id ? { ...x, status: 'active' as const } : x));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <Phone>
      <Topbar
        sticky
        bg="canvas"
        leading={<span className="px-2 font-ar text-[15px] font-bold text-v2-ink">{t('content.title', isAr ? 'المحتوى المهني' : 'Career Content')}</span>}
      />

      <div className="flex-1 px-[22px] pb-[110px] lg:px-0 lg:pb-0">
        <div className="mt-5 mb-5 lg:mt-2">
          <Eyebrow className="mb-1.5 block">CONTENT</Eyebrow>
          <h1 className="font-ar text-[26px] font-bold leading-tight text-v2-ink lg:text-[32px]">
            {t('content.subtitle', isAr ? 'ابنِ حضورك المهني' : 'Build your professional presence')}
          </h1>
        </div>

        {error && (
          <Card padding="md" radius="md" className="mb-4 border-rose-200 bg-rose-50">
            <p className="font-ar text-[13px] text-rose-700">{error}</p>
          </Card>
        )}

        {/* 3 mode cards */}
        <section className="mb-7">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-ar text-[15px] font-bold text-v2-ink">
              {t('content.hub.chooseMode', isAr ? 'اختر نوع المحتوى' : 'Choose a mode')}
            </h2>
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            <ModeCard
              type="post"
              cost={COST.post}
              title={t('content.modes.post.name', isAr ? 'منشور' : 'Post')}
              subtitle={t('content.modes.post.desc', isAr ? 'منشور قصير مرتكز على فكرة واحدة' : 'A short post anchored on one idea')}
              duration={isAr ? '~10 ثانية' : '~10 sec'}
              icon={<FileText size={20} aria-hidden="true" />}
              onClick={() => startMode('post')}
            />
            <ModeCard
              type="carousel"
              cost={COST.carousel}
              title={t('content.modes.carousel.name', isAr ? 'كاروسيل' : 'Carousel')}
              subtitle={t('content.modes.carousel.desc', isAr ? '5-8 شرائح تشرح فكرة كاملة' : '5–8 slides that teach one idea')}
              duration={isAr ? '~30 ثانية' : '~30 sec'}
              icon={<Layers size={20} aria-hidden="true" />}
              onClick={() => startMode('carousel')}
            />
            <ModeCard
              type="repurpose_bundle"
              cost={COST.repurpose_bundle}
              title={t('content.modes.repurpose.name', isAr ? 'إعادة توظيف' : 'Repurpose Bundle')}
              subtitle={t('content.modes.repurpose.desc', isAr ? 'حوّل منشورك إلى كاروسيل + فيديو + متابعة' : 'Turn a post into carousel + video + follow-up')}
              duration={isAr ? '~20 ثانية' : '~20 sec'}
              icon={<Repeat size={20} aria-hidden="true" />}
              onClick={() => startMode('repurpose_bundle')}
            />
          </div>
        </section>

        {/* Quick start suggestions */}
        {(loading || suggestions.length > 0) && (
          <section className="mb-7">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-ar text-[15px] font-bold text-v2-ink">
                {t('content.hub.quickStart', isAr ? 'اقتراحات سريعة' : 'Quick start')}
              </h2>
              <span className="font-ar text-[11px] text-v2-dim">
                {t('content.hub.quickStartHint', isAr ? 'مبنية على بروفايلك' : 'Based on your profile')}
              </span>
            </div>
            {loading ? (
              <div className="grid gap-3 lg:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} variant="card" />
                ))}
              </div>
            ) : (
              <div className="grid gap-3 lg:grid-cols-3">
                {suggestions.map((s, i) => (
                  <QuickStartCard key={i} suggestion={s} isAr={isAr} onClick={() => startSuggestion(s)} />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Recent */}
        <section className="mb-7">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-ar text-[15px] font-bold text-v2-ink">
              {t('content.hub.recent', isAr ? 'الأحدث' : 'Recent')}
            </h2>
          </div>
          {loading ? (
            <div className="grid gap-3">
              {[0, 1, 2].map((i) => <Skeleton key={i} variant="card" />)}
            </div>
          ) : active.length === 0 ? (
            <EmptyState
              title={t('content.hub.emptyState', isAr ? 'لم تنشئ محتوى بعد' : 'No content yet')}
              description={isAr ? 'ابدأ بمنشور سريع أو حدد اقتراحاً من الأعلى' : 'Start with a quick post or pick a suggestion above'}
              action={
                <button
                  type="button"
                  onClick={() => startMode('post')}
                  className="inline-flex items-center gap-1 rounded-v2-md border border-teal-600 bg-teal-600 px-4 py-2 font-ar text-[13px] font-semibold text-white hover:bg-teal-700"
                >
                  <Plus size={14} aria-hidden="true" />
                  {isAr ? 'منشور جديد' : 'New Post'}
                </button>
              }
            />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {active.map((v) => (
                <VersionRow
                  key={v.id}
                  v={v}
                  isAr={isAr}
                  onClick={() => openVersion(v)}
                  onArchive={() => archiveVersion(v)}
                />
              ))}
            </div>
          )}
        </section>

        {/* Archive (collapsed) */}
        {archived.length > 0 && (
          <section className="mb-7">
            <button
              type="button"
              onClick={() => setArchiveOpen((x) => !x)}
              className="flex w-full items-center justify-between rounded-v2-md border border-v2-line bg-v2-surface px-4 py-3 text-start hover:bg-v2-canvas-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/30"
            >
              <span className="font-ar text-[14px] font-semibold text-v2-ink">
                {t('content.hub.archived', isAr ? 'المؤرشف' : 'Archived')}
                <span className="ms-2 inline-block rounded-full bg-v2-canvas-2 px-1.5 py-0.5 font-en text-[10px] text-v2-dim">
                  <NumDisplay>{archived.length}</NumDisplay>
                </span>
              </span>
              <ChevronRight size={16} className={`text-v2-mute transition-transform ${archiveOpen ? 'rotate-90' : 'rtl:rotate-180'}`} />
            </button>
            {archiveOpen && (
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                {archived.map((v) => (
                  <VersionRow
                    key={v.id}
                    v={v}
                    isAr={isAr}
                    onClick={() => openVersion(v)}
                    onRestore={() => restoreVersion(v)}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Legacy */}
        {legacy.length > 0 && (
          <section className="mb-7">
            <Card padding="md" radius="md" className="mb-3 border-amber-200 bg-amber-50">
              <p className="font-ar text-[12px] text-amber-800">
                {isAr
                  ? 'هذه محتويات قديمة من النسخة السابقة. للقراءة فقط — ابدأ محتوى جديداً لتفعيل التحسينات.'
                  : 'These are legacy items from the previous version. Read-only — start new content to unlock refinements.'}
              </p>
            </Card>
            <div className="grid gap-3 lg:grid-cols-2">
              {legacy.slice(0, 6).map((v) => (
                <VersionRow key={v.id} v={v} isAr={isAr} onClick={() => openVersion(v)} />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Bottom mobile nav */}
      <BottomNav
        active="posts"
        items={[
          { id: 'home',    label: isAr ? 'الرئيسية' : 'Home',    icon: <span />, onSelect: () => navigate('/v2/home') },
          { id: 'analyze', label: isAr ? 'الرادار'   : 'Radar',   icon: <span />, onSelect: () => navigate('/v2/analyze') },
          { id: 'posts',   label: isAr ? 'المحتوى'   : 'Content', icon: <span />, onSelect: () => navigate('/v2/posts') },
          { id: 'profile', label: isAr ? 'حسابي'     : 'Account', icon: <span />, onSelect: () => navigate('/v2/me') },
        ]}
        fabIcon="check"
        onFabClick={() => startMode('post')}
      />
    </Phone>
  );
}
