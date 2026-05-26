/**
 * /v2/posts/new/:type — Content preflight.
 *
 * No question is re-asked (R02). The preflight reads career_profile and
 * shows the user the mode + cost prominently, the resolved target role,
 * and either:
 *   - A topic input (with optional suggestions) for post/carousel
 *   - A source post picker for repurpose_bundle
 *
 * If a cache hit exists for the entered topic, the CTA flips to
 * "عرض النسخة الحالية (مجاناً)" / "View cached (free)".
 */

import { useEffect, useMemo, useState } from 'react';
import { useLocation, useRoute, useSearch } from 'wouter';
import { useTranslation } from 'react-i18next';
import { Sparkles, AlertCircle, FileText, Layers, Repeat, Briefcase, Wand2 } from 'lucide-react';
import Phone from '@/components/v2/Phone';
import Topbar from '@/components/v2/Topbar';
import Card from '@/components/v2/Card';
import Button from '@/components/v2/Button';
import Eyebrow from '@/components/v2/Eyebrow';
import Input from '@/components/v2/Input';
import Skeleton from '@/components/v2/Skeleton';
import NumDisplay from '@/components/v2/NumDisplay';
import { trpc, type ContentTypeShape, type TopicSuggestionShape, type ContentVersionRow } from '@/lib/trpc';

type PreflightShape = Awaited<ReturnType<typeof trpc.content.preflight>>;

const VALID_TYPES: ContentTypeShape[] = ['post', 'carousel', 'repurpose_bundle'];

function readQuery(search: string, key: string): string | null {
  try { return new URLSearchParams(search).get(key); } catch { return null; }
}

export default function ContentPreflight() {
  const { t, i18n } = useTranslation();
  const isAr = (i18n.language || 'ar').startsWith('ar');
  const [, navigate] = useLocation();
  const [match, params] = useRoute<{ type: string }>('/v2/posts/new/:type');
  const search = useSearch();

  const rawType = match ? params.type : null;
  const contentType: ContentTypeShape | null = useMemo(
    () => VALID_TYPES.includes(rawType as ContentTypeShape) ? (rawType as ContentTypeShape) : null,
    [rawType],
  );

  const initialTopic = readQuery(search, 'topic') ?? '';
  const [topic, setTopic] = useState(initialTopic);
  const [debouncedTopic, setDebouncedTopic] = useState(initialTopic);
  const [pre, setPre] = useState<PreflightShape | null>(null);
  const [sources, setSources] = useState<ContentVersionRow[]>([]);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce topic input so the preflight cache check only fires when the
  // user pauses typing (300ms).
  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedTopic(topic), 300);
    return () => window.clearTimeout(id);
  }, [topic]);

  useEffect(() => {
    if (!contentType) {
      navigate('/v2/posts', { replace: true });
      return;
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentType, debouncedTopic, sourceId]);

  // Load eligible source posts for repurpose mode
  useEffect(() => {
    if (contentType !== 'repurpose_bundle') return;
    (async () => {
      try {
        const res = await trpc.content.listVersions({ contentType: 'post', limit: 20 });
        const eligible = res.versions.filter((v) => v.status !== 'archived' && v.cache_id);
        setSources(eligible);
        if (!sourceId && eligible.length > 0) setSourceId(eligible[0].id);
      } catch (e) {
        console.warn('[ContentPreflight] sources load failed', e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentType]);

  async function load() {
    if (!contentType) return;
    setLoading(true);
    setError(null);
    try {
      const data = await trpc.content.preflight({
        contentType,
        topic: debouncedTopic.trim() || undefined,
        sourcePostId: contentType === 'repurpose_bundle' ? (sourceId ?? undefined) : undefined,
        language: isAr ? 'ar' : 'en',
      });
      setPre(data);
      if (!data.hasCareerProfile) {
        navigate('/v2/onboarding', { replace: true });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function start() {
    if (!contentType || !pre) return;
    setSubmitting(true);
    setError(null);

    // Cache hit shortcut → straight to editor
    if (pre.hasCacheHit && pre.latestVersionId) {
      navigate(`/v2/posts/${pre.latestVersionId}`);
      return;
    }

    // Otherwise navigate to the generating screen; it kicks off the mutation.
    const qs = new URLSearchParams();
    qs.set('type', contentType);
    if (contentType !== 'repurpose_bundle') {
      qs.set('topic', topic.trim());
    } else if (sourceId) {
      qs.set('sourcePostId', sourceId);
    }
    navigate(`/v2/posts/generating?${qs.toString()}`);
  }

  function pickSuggestion(s: TopicSuggestionShape) {
    setTopic(s.topic);
    if (s.recommended_type !== contentType) {
      // Suggested type differs — navigate to the right preflight
      const qs = new URLSearchParams({ topic: s.topic });
      navigate(`/v2/posts/new/${s.recommended_type}?${qs.toString()}`);
    }
  }

  if (!contentType) return null;

  if (loading && !pre) {
    return (
      <Phone>
        <Topbar back onBack={() => navigate('/v2/posts')} bg="canvas" leading={<span className="px-2 font-ar text-[15px] font-bold text-v2-ink">{t('content.title', isAr ? 'المحتوى المهني' : 'Career Content')}</span>} />
        <div className="flex-1 px-[22px] pt-6">
          <Skeleton variant="text" lines={2} className="mb-6" />
          <Skeleton variant="card" className="mb-4" />
          <Skeleton variant="card" />
        </div>
      </Phone>
    );
  }

  const modeMeta = MODE_META[contentType];
  const Icon = modeMeta.icon;
  const cost = pre?.estimatedCost ?? modeMeta.cost;
  const isCacheHit = !!pre?.hasCacheHit;
  const profile = pre?.profile;

  const ctaDisabled = submitting || !pre
    || (contentType !== 'repurpose_bundle' && topic.trim().length < 3)
    || (contentType === 'repurpose_bundle' && !sourceId);

  return (
    <Phone>
      <Topbar
        back
        onBack={() => navigate('/v2/posts')}
        bg="canvas"
        leading={<span className="px-2 font-ar text-[15px] font-bold text-v2-ink">{t('content.title', isAr ? 'المحتوى المهني' : 'Career Content')}</span>}
      />

      <div className="flex-1 px-[22px] pb-[110px] lg:px-0 lg:pb-0">
        <div className="mt-5 mb-5 lg:mt-2">
          <Eyebrow className="mb-1.5 block">{modeMeta.eyebrow}</Eyebrow>
          <h1 className="font-ar text-[26px] font-bold leading-tight text-v2-ink lg:text-[32px]">
            {isAr ? modeMeta.titleAr : modeMeta.titleEn}
          </h1>
        </div>

        {error && (
          <Card padding="md" radius="md" className="mb-4 border-rose-200 bg-rose-50">
            <div className="flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0 text-rose-600" />
              <p className="font-ar text-[13px] text-rose-700">{error}</p>
            </div>
          </Card>
        )}

        {/* Mode + cost snapshot */}
        <Card padding="lg" radius="lg" elevated className="mb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-50 text-teal-700">
                <Icon size={20} aria-hidden="true" />
              </div>
              <div>
                <p className="font-ar text-[14px] font-bold text-v2-ink">{isAr ? modeMeta.titleAr : modeMeta.titleEn}</p>
                <p className="font-ar text-[11px] text-v2-dim">{isAr ? modeMeta.descAr : modeMeta.descEn}</p>
              </div>
            </div>
            <div className="text-end">
              <p className={`font-ar text-[18px] font-bold ${isCacheHit ? 'text-teal-700 line-through opacity-70' : 'text-v2-ink'}`}>
                <NumDisplay>{modeMeta.cost}</NumDisplay> {isAr ? 'توكن' : 'tokens'}
              </p>
              {isCacheHit && (
                <p className="font-ar text-[12px] font-semibold text-teal-700">
                  {isAr ? 'مخزّن — مجاناً' : 'Cached — free'}
                </p>
              )}
              <p className="font-ar text-[10px] text-v2-dim">{isAr ? modeMeta.durationAr : modeMeta.durationEn}</p>
            </div>
          </div>
        </Card>

        {/* Career profile snapshot — read-only */}
        {profile && (
          <Card padding="md" radius="md" className="mb-4">
            <Eyebrow className="mb-2 block">{isAr ? 'البروفايل المهني' : 'Career profile'}</Eyebrow>
            <div className="flex items-center gap-2 font-ar text-[14px] text-v2-ink">
              <Briefcase size={14} className="shrink-0 text-v2-mute" aria-hidden="true" />
              <span className="font-semibold">{profile.target_role}</span>
              <span className="text-v2-dim">·</span>
              <span className="text-v2-dim">{profile.industry}</span>
            </div>
          </Card>
        )}

        {/* Topic input (post/carousel) OR source picker (repurpose) */}
        {contentType !== 'repurpose_bundle' ? (
          <Card padding="lg" radius="lg" className="mb-4">
            <Eyebrow className="mb-2 block">{t('content.preflight.yourTopic', isAr ? 'موضوعك' : 'Your topic')}</Eyebrow>
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={t('content.preflight.topicPlaceholder', isAr ? 'اكتب موضوعك أو اختر من المقترحات' : 'Write your topic or pick a suggestion')}
              maxLength={500}
            />

            {pre && pre.suggestions.length > 0 && (
              <div className="mt-4">
                <Eyebrow className="mb-2 block">{t('content.preflight.suggestedTopics', isAr ? 'موضوعات مقترحة لك' : 'Suggested topics')}</Eyebrow>
                <div className="flex flex-col gap-2">
                  {pre.suggestions.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => pickSuggestion(s)}
                      className="group flex items-start gap-2 rounded-v2-md border border-v2-line bg-v2-canvas px-3 py-2.5 text-start transition-colors hover:border-teal-200 hover:bg-teal-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/30"
                    >
                      <Sparkles size={14} className="mt-0.5 shrink-0 text-teal-600" aria-hidden="true" />
                      <div className="flex-1">
                        <p className="font-ar text-[13px] font-semibold leading-relaxed text-v2-ink">{s.topic}</p>
                        <p className="font-ar text-[11px] leading-relaxed text-v2-dim">{s.reason}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Card>
        ) : (
          <Card padding="lg" radius="lg" className="mb-4">
            <Eyebrow className="mb-2 block">{isAr ? 'اختر منشوراً للإعادة' : 'Pick a post to repurpose'}</Eyebrow>
            {sources.length === 0 ? (
              <div className="rounded-v2-md border border-amber-200 bg-amber-50 p-3 font-ar text-[13px] text-amber-800">
                {isAr ? 'لا توجد منشورات قابلة لإعادة التوظيف. أنشئ منشوراً أولاً.' : 'No eligible posts to repurpose. Create a post first.'}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {sources.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSourceId(p.id)}
                    aria-pressed={sourceId === p.id}
                    className={`flex flex-col items-start gap-1 rounded-v2-md border px-3 py-2.5 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/30 ${
                      sourceId === p.id
                        ? 'border-teal-500 bg-teal-50'
                        : 'border-v2-line bg-v2-canvas hover:border-teal-200 hover:bg-teal-50/40'
                    }`}
                  >
                    <span className="font-ar text-[13px] font-semibold text-v2-ink line-clamp-1">{p.display_title}</span>
                    <span className="font-ar text-[11px] text-v2-dim">
                      {new Date(p.created_at).toLocaleDateString(isAr ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* CTA */}
        <Button
          variant="primary"
          size="lg"
          fullWidth
          disabled={ctaDisabled}
          leadingIcon={isCacheHit ? <Sparkles size={16} aria-hidden="true" /> : <Wand2 size={16} aria-hidden="true" />}
          onClick={start}
        >
          {isCacheHit
            ? t('content.preflight.viewCached', isAr ? 'عرض النسخة الحالية (مجاناً)' : 'View cached (free)')
            : (isAr
                ? `ابدأ (${cost} توكن)`
                : `Start (${cost} tokens)`)}
        </Button>

        {!isCacheHit && (
          <p className="mt-3 text-center font-ar text-[11px] text-v2-dim">
            {isAr
              ? 'يتم خصم التوكنات بعد نجاح التوليد. لو فشل — يتم استرداد توكناتك تلقائياً.'
              : 'Tokens are deducted on success. If generation fails, your tokens are automatically refunded.'}
          </p>
        )}
      </div>
    </Phone>
  );
}

const MODE_META: Record<ContentTypeShape, {
  cost: number;
  icon: typeof FileText;
  eyebrow: string;
  titleAr: string; titleEn: string;
  descAr: string; descEn: string;
  durationAr: string; durationEn: string;
}> = {
  post: {
    cost: 5,
    icon: FileText,
    eyebrow: 'CONTENT · POST',
    titleAr: 'منشور جديد', titleEn: 'New Post',
    descAr: 'منشور قصير مرتكز على فكرة واحدة', descEn: 'A short post anchored on one idea',
    durationAr: '~10 ثانية', durationEn: '~10 sec',
  },
  carousel: {
    cost: 25,
    icon: Layers,
    eyebrow: 'CONTENT · CAROUSEL',
    titleAr: 'كاروسيل جديد', titleEn: 'New Carousel',
    descAr: '5-8 شرائح تشرح فكرة كاملة', descEn: '5–8 slides that teach one idea',
    durationAr: '~30 ثانية', durationEn: '~30 sec',
  },
  repurpose_bundle: {
    cost: 15,
    icon: Repeat,
    eyebrow: 'CONTENT · REPURPOSE',
    titleAr: 'حزمة إعادة توظيف', titleEn: 'Repurpose Bundle',
    descAr: 'حوّل منشوراً إلى كاروسيل + فيديو + متابعة', descEn: 'Turn a post into a carousel + video + follow-up',
    durationAr: '~20 ثانية', durationEn: '~20 sec',
  },
};
