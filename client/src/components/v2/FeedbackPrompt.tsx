import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquarePlus, X, Loader2, CheckCircle } from 'lucide-react';
import { trpcMutation } from '@/lib/trpc';

type Pillar = 'radar' | 'resume' | 'content' | 'dashboard' | 'general';

const SESSION_KEY = 'beta_feedback_shown';

export default function FeedbackPrompt() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [pillar, setPillar] = useState<Pillar>('general');
  const [nps, setNps] = useState<number | null>(null);
  const [whatWorked, setWhatWorked] = useState('');
  const [whatDidnt, setWhatDidnt] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(() => !!sessionStorage.getItem(SESSION_KEY));

  if (done) return null;

  function openModal() {
    setOpen(true);
  }

  async function handleSubmit() {
    if (nps === null) return;
    setLoading(true);
    try {
      await trpcMutation('beta.submitFeedback', {
        pillar,
        nps,
        what_worked: whatWorked || undefined,
        what_didnt: whatDidnt || undefined,
      });
      sessionStorage.setItem(SESSION_KEY, '1');
      setDone(true);
      setOpen(false);
    } catch {
      // swallow — feedback must never break the user flow
    } finally {
      setLoading(false);
    }
  }

  const pillars: { value: Pillar; labelKey: string }[] = [
    { value: 'general',   labelKey: 'beta.feedback.pillars.general' },
    { value: 'radar',     labelKey: 'beta.feedback.pillars.radar' },
    { value: 'resume',    labelKey: 'beta.feedback.pillars.resume' },
    { value: 'content',   labelKey: 'beta.feedback.pillars.content' },
    { value: 'dashboard', labelKey: 'beta.feedback.pillars.dashboard' },
  ];

  const npsEmojis = ['😡','😣','😕','😐','😐','🙂','🙂','😊','😄','😁','🤩'];

  return (
    <>
      {/* Floating button */}
      <button
        onClick={openModal}
        className="fixed bottom-20 end-4 z-50 flex items-center gap-2 rounded-full bg-v2-accent px-4 py-2.5 text-sm font-medium text-white shadow-lg hover:bg-v2-accent/90 transition-all"
      >
        <MessageSquarePlus className="h-4 w-4" />
        {t('beta.feedback.fab')}
      </button>

      {/* Modal overlay */}
      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 sm:items-center"
          onClick={e => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="w-full max-w-lg rounded-t-2xl bg-v2-canvas p-6 shadow-xl sm:rounded-2xl">
            {/* Header */}
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h2 className="text-base font-semibold text-v2-text">{t('beta.feedback.title')}</h2>
                <p className="mt-0.5 text-sm text-v2-muted">{t('beta.feedback.subtitle')}</p>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1 hover:bg-v2-surface">
                <X className="h-4 w-4 text-v2-muted" />
              </button>
            </div>

            {/* Pillar selector */}
            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-medium text-v2-muted uppercase tracking-wide">
                {t('beta.feedback.pillarLabel')}
              </label>
              <div className="flex flex-wrap gap-2">
                {pillars.map(p => (
                  <button
                    key={p.value}
                    onClick={() => setPillar(p.value)}
                    className={`rounded-full px-3 py-1 text-sm transition-colors ${
                      pillar === p.value
                        ? 'bg-v2-accent text-white'
                        : 'bg-v2-surface text-v2-muted hover:text-v2-text'
                    }`}
                  >
                    {t(p.labelKey)}
                  </button>
                ))}
              </div>
            </div>

            {/* NPS */}
            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-v2-text">
                {t('beta.feedback.npsQuestion')}
              </label>
              <div className="flex gap-1 flex-wrap">
                {Array.from({ length: 11 }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => setNps(i)}
                    title={`${i}`}
                    className={`h-9 w-9 rounded-lg text-lg transition-all ${
                      nps === i
                        ? 'bg-v2-accent shadow-md scale-110'
                        : 'bg-v2-surface hover:bg-v2-line'
                    }`}
                  >
                    {npsEmojis[i]}
                  </button>
                ))}
              </div>
              {nps !== null && (
                <p className="mt-1 text-xs text-v2-muted">{t('beta.feedback.npsSelected', { score: nps })}</p>
              )}
            </div>

            {/* What worked */}
            <div className="mb-3">
              <label className="mb-1 block text-sm font-medium text-v2-text">
                {t('beta.feedback.whatWorked')}
              </label>
              <textarea
                value={whatWorked}
                onChange={e => setWhatWorked(e.target.value)}
                rows={2}
                maxLength={2000}
                placeholder={t('beta.feedback.optional')}
                className="w-full resize-none rounded-lg border border-v2-line bg-v2-surface px-3 py-2 text-sm text-v2-text placeholder:text-v2-muted focus:border-v2-accent focus:outline-none"
              />
            </div>

            {/* What didn't */}
            <div className="mb-5">
              <label className="mb-1 block text-sm font-medium text-v2-text">
                {t('beta.feedback.whatDidnt')}
              </label>
              <textarea
                value={whatDidnt}
                onChange={e => setWhatDidnt(e.target.value)}
                rows={2}
                maxLength={2000}
                placeholder={t('beta.feedback.optional')}
                className="w-full resize-none rounded-lg border border-v2-line bg-v2-surface px-3 py-2 text-sm text-v2-text placeholder:text-v2-muted focus:border-v2-accent focus:outline-none"
              />
            </div>

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={nps === null || loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-v2-accent py-2.5 text-sm font-medium text-white hover:bg-v2-accent/90 disabled:opacity-50 transition-colors"
            >
              {loading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <CheckCircle className="h-4 w-4" />}
              {t('beta.feedback.submit')}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
