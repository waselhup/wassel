import { useState } from 'react';
import { useLocation } from 'wouter';
import Phone from '@/components/v2/Phone';
import Topbar from '@/components/v2/Topbar';
import BottomNav from '@/components/v2/BottomNav';
import Button from '@/components/v2/Button';
import Eyebrow from '@/components/v2/Eyebrow';
import NumDisplay from '@/components/v2/NumDisplay';
import Pill from '@/components/v2/Pill';
import Sheet from '@/components/v2/Sheet';

type Tab = 'drafts' | 'published' | 'templates';
type Status = 'مسودة' | 'جاهز للنشر' | 'منشور';
type Tone = 'professional' | 'casual' | 'inspiring' | 'analytical';

interface Post {
  id: string;
  title: string;
  preview: string;
  status: Status;
  date: string;
  words: number;
  engagement?: number;
}

interface Template {
  id: string;
  title: string;
  description: string;
  cost: number;
}

const DRAFTS: Post[] = [
  { id: 'd1', title: 'القيادة في عصر الذكاء الاصطناعي', preview: 'في السنة الماضية، تعلّمت أن القيادة الحقيقية ليست في إصدار الأوامر بل في تمكين الفريق من اتخاذ قرارات أفضل.', status: 'مسودة', date: 'اليوم · 14:20', words: 142 },
  { id: 'd2', title: 'كيف غيّرت 3 عادات إنتاجيتي', preview: 'ابدأ يومك بأهم مهمة قبل فتح أي تطبيق. هذا غيّر كل شيء بالنسبة لي.', status: 'جاهز للنشر', date: 'أمس · 09:10', words: 218 },
  { id: 'd3', title: 'دروس من 5 سنوات في تقنية المنتجات', preview: 'بعد 5 سنوات في إدارة المنتجات في السعودية، إليك ما أتمنى لو عرفته في البداية.', status: 'مسودة', date: 'قبل 3 أيام', words: 98 },
];

const PUBLISHED: Post[] = [
  { id: 'p1', title: 'لماذا يفشل معظم مدراء المنتج في أول سنة', preview: 'الفجوة الأكبر ليست تقنية — إنها في فهم كيف يتخذ الناس القرارات.', status: 'منشور', date: 'قبل 5 أيام', words: 312, engagement: 287 },
  { id: 'p2', title: 'كتابة المتطلبات: من 10 صفحات إلى صفحة', preview: 'قالب بسيط استخدمه منذ 3 سنوات. يخفّض النقاش 80%.', status: 'منشور', date: 'قبل أسبوعين', words: 184, engagement: 142 },
  { id: 'p3', title: 'مقابلة مع راعي تقني في NEOM', preview: 'ما الذي يبحث عنه فعلاً صنّاع القرار في الوظائف الجديدة؟', status: 'منشور', date: 'قبل 3 أسابيع', words: 256, engagement: 401 },
];

const TEMPLATES: Template[] = [
  { id: 't1', title: 'منشور رأي', description: 'مقدمة جذابة + 3 نقاط + خاتمة', cost: 15 },
  { id: 't2', title: 'دراسة حالة', description: 'تحدّي · حل · نتيجة', cost: 25 },
  { id: 't3', title: 'تأمل أسبوعي', description: 'ماذا تعلّمت هذا الأسبوع', cost: 12 },
  { id: 't4', title: 'إعلان إنجاز', description: 'متواضع لكن واثق', cost: 10 },
  { id: 't5', title: 'منشور سرد قصصي', description: 'لحظة → درس → دعوة', cost: 18 },
];

const TONES: { id: Tone; label: string }[] = [
  { id: 'professional', label: 'مهنية' },
  { id: 'casual',       label: 'ودودة' },
  { id: 'inspiring',    label: 'ملهمة' },
  { id: 'analytical',   label: 'تحليلية' },
];

const COMPOSE_COST = 20;
const BALANCE = 240;

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

function PostRow({ post }: { post: Post }) {
  return (
    <div className="border-b border-v2-line py-4">
      <div className="mb-1.5 flex items-start justify-between gap-2.5">
        <div className="flex-1 font-ar text-[14px] font-semibold text-v2-ink">{post.title}</div>
        <StatusPill status={post.status} />
      </div>
      <p className="mb-2.5 line-clamp-2 font-ar text-[13px] leading-relaxed text-v2-body">
        {post.preview}
      </p>
      <div className="flex items-center gap-3.5 text-[11px] text-v2-dim">
        <NumDisplay>{post.words}</NumDisplay>
        <span className="font-ar">كلمة</span>
        <span>·</span>
        <span className="font-ar">{post.date}</span>
        {post.engagement != null && (
          <>
            <span>·</span>
            <span className="font-ar">
              <NumDisplay>{post.engagement}</NumDisplay> تفاعل
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function Posts() {
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<Tab>('drafts');
  const [composerOpen, setComposerOpen] = useState(false);
  const [topic, setTopic] = useState('عن القيادة في عصر AI');
  const [content, setContent] = useState('');
  const [tone, setTone] = useState<Tone>('professional');

  const counts = {
    drafts:    DRAFTS.length,
    published: PUBLISHED.length,
    templates: TEMPLATES.length,
  };

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'drafts',    label: 'مسودات',  count: counts.drafts },
    { id: 'published', label: 'منشورة',  count: counts.published },
    { id: 'templates', label: 'قوالب',   count: counts.templates },
  ];

  return (
    <Phone>
      <Topbar
        back
        onBack={() => navigate('/v2/home')}
        title="الاستوديو"
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

      <div className="border-b border-v2-line">
        <div className="flex gap-1 px-[22px] pt-3.5 -mb-px">
          {tabs.map((tb) => {
            const active = tab === tb.id;
            return (
              <button
                key={tb.id}
                type="button"
                onClick={() => setTab(tb.id)}
                className={`flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 font-ar text-[13px] cursor-pointer transition-colors duration-200 ease-out ${
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

      <div className="flex-1 px-[22px] pb-[110px] pt-2">
        {tab === 'drafts' && (
          <>
            {DRAFTS.length === 0 ? (
              <EmptyState message="لا توجد مسودات" hint="ابدأ بمنشور جديد من زر الأعلى" />
            ) : (
              DRAFTS.map((p) => <PostRow key={p.id} post={p} />)
            )}
          </>
        )}

        {tab === 'published' && (
          <>
            {PUBLISHED.length === 0 ? (
              <EmptyState message="لا توجد منشورات بعد" hint="عند نشر مسوداتك، ستظهر هنا" />
            ) : (
              PUBLISHED.map((p) => <PostRow key={p.id} post={p} />)
            )}
          </>
        )}

        {tab === 'templates' && (
          <div className="flex flex-col">
            {TEMPLATES.map((tp) => (
              <button
                key={tp.id}
                type="button"
                onClick={() => setComposerOpen(true)}
                className="grid grid-cols-[1fr_auto_12px] items-center gap-3 border-b border-v2-line py-4 text-start hover:bg-v2-canvas-2 transition-colors duration-200 ease-out cursor-pointer"
              >
                <div className="font-ar">
                  <span className="block text-[14px] font-semibold text-v2-ink">{tp.title}</span>
                  <span className="block text-[12px] text-v2-dim">{tp.description}</span>
                </div>
                <NumDisplay className="text-[11px] text-v2-body">
                  {tp.cost} توكن
                </NumDisplay>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" className="rtl:rotate-180">
                  <path d="M4 3 L8 6 L4 9" stroke="var(--mute)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            ))}
          </div>
        )}
      </div>

      <Sheet
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        snapPoints={[90]}
        title="منشور جديد"
      >
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
              className="min-h-[180px] w-full resize-none rounded-v2-md border border-v2-line bg-v2-surface px-3.5 py-3.5 font-ar text-[14px] leading-relaxed text-v2-ink outline-none placeholder:text-v2-mute focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
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
            <div className="text-end">
              <Eyebrow>الرصيد</Eyebrow>
              <p className="mt-0.5 font-ar text-[14px] font-semibold text-teal-700">
                <NumDisplay>{BALANCE}</NumDisplay> توكن
              </p>
            </div>
          </div>

          <Button
            variant="primary"
            size="lg"
            fullWidth
            leadingIcon={
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M7 1 L8.5 5 L13 6.5 L8.5 8 L7 13 L5.5 8 L1 6.5 L5.5 5 Z" fill="currentColor" />
              </svg>
            }
            onClick={() => setComposerOpen(false)}
          >
            ولّد بالذكاء الاصطناعي
          </Button>
        </div>
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

function EmptyState({ message, hint }: { message: string; hint: string }) {
  return (
    <div className="px-5 py-16 text-center">
      <div className="font-ar text-[14px] font-semibold text-v2-body">{message}</div>
      <div className="mt-1 font-ar text-[12px] text-v2-dim">{hint}</div>
    </div>
  );
}

export default Posts;
