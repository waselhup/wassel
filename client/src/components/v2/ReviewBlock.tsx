import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { trpc } from '@/lib/trpc';
import Button from './Button';

/**
 * ReviewBlock — lets a logged-in user submit a 1-5 star review with a
 * comment. Submitted reviews go to status='pending' and are not shown
 * publicly until an admin approves them via the admin dashboard.
 *
 * Shows a "thank you" state once submitted in the current session, and
 * a "your review is awaiting approval / approved / rejected" status if
 * the user already has one. The user is allowed to submit at most one
 * review at a time — if they already have a pending or approved one,
 * we hide the form.
 */
function ReviewBlock() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const t = (ar: string, en: string) => isAr ? ar : en;

  const [loading, setLoading] = useState(true);
  const [existing, setExisting] = useState<any | null>(null);
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSubmitted, setJustSubmitted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    trpc.reviews.myReviews()
      .then((rows) => {
        if (cancelled) return;
        // Take the most recent non-rejected review (if any)
        const open = (rows || []).find((r: any) => r.status !== 'rejected');
        setExisting(open || null);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const submit = async () => {
    if (rating < 1) {
      setError(t('اختر تقييماً من 1 إلى 5 نجوم', 'Pick a rating from 1 to 5 stars.'));
      return;
    }
    if (comment.trim().length < 5) {
      setError(t('اكتب تعليقاً قصيراً (5 أحرف على الأقل)', 'Write a short comment (5+ characters).'));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const saved = await trpc.reviews.submit({ rating, comment: comment.trim() });
      setExisting(saved);
      setJustSubmitted(true);
      setRating(0);
      setComment('');
    } catch (e: any) {
      setError(e?.message || t('فشل الإرسال', 'Submit failed'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return null;

  // Already submitted — show status, not the form
  if (existing) {
    const statusLabel =
      existing.status === 'approved'
        ? t('تم نشر مراجعتك. شكراً!', 'Your review is live. Thank you!')
        : existing.status === 'pending'
          ? t('مراجعتك قيد المراجعة من الإدارة قبل النشر', 'Your review is awaiting admin approval before going public.')
          : t('مراجعتك بانتظار', 'Review pending');

    const tone =
      existing.status === 'approved'
        ? 'border-teal-200 bg-teal-50 text-teal-800'
        : 'border-amber-200 bg-amber-50 text-amber-800';

    return (
      <div className={`rounded-v2-md border p-4 ${tone}`}>
        <div className="font-ar text-[14px] font-semibold mb-1">
          {justSubmitted
            ? t('شكراً لمشاركة رأيك!', 'Thanks for sharing your feedback!')
            : t('مراجعتك', 'Your review')}
        </div>
        <div className="font-ar text-[12px] mb-2">{statusLabel}</div>
        <div className="flex gap-0.5 mb-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <span
              key={i}
              aria-hidden="true"
              className={i < (existing.rating || 0) ? 'text-amber-500' : 'text-v2-line'}
            >
              ★
            </span>
          ))}
        </div>
        <p className="font-ar text-[12px] leading-relaxed text-v2-body">
          «{existing.comment}»
        </p>
      </div>
    );
  }

  // Form
  return (
    <div className="rounded-v2-md border border-v2-line bg-v2-canvas-2 p-4">
      <h3 className="font-ar text-[14px] font-semibold text-v2-ink mb-1">
        {t('شاركنا رأيك', 'Share your feedback')}
      </h3>
      <p className="font-ar text-[12px] text-v2-dim mb-3">
        {t(
          'كيف كانت تجربتك مع وصل؟ مراجعتك ستظهر للعموم بعد موافقة الإدارة',
          'How was your Wassel experience? Your review will appear publicly after admin approval.'
        )}
      </p>

      {/* Star picker */}
      <div className="flex gap-1 mb-3" onMouseLeave={() => setHoverRating(0)}>
        {[1, 2, 3, 4, 5].map((n) => {
          const active = (hoverRating || rating) >= n;
          return (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              onMouseEnter={() => setHoverRating(n)}
              aria-label={t(`${n} نجوم`, `${n} stars`)}
              className={`text-[28px] leading-none cursor-pointer transition-colors duration-150 ${
                active ? 'text-amber-500' : 'text-v2-line hover:text-amber-300'
              }`}
            >
              ★
            </button>
          );
        })}
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        maxLength={1000}
        placeholder={t(
          'مثال: ساعدني وصل في تحسين بروفايل لينكد إن خلال أسبوع',
          'Example: Wassel helped me improve my LinkedIn profile within a week.'
        )}
        className="w-full rounded-v2-md border border-v2-line bg-v2-surface px-3 py-2 font-ar text-[13px] text-v2-ink focus:border-teal-500 focus:outline-none resize-none"
      />
      <div className="mt-1 mb-3 text-end font-ar text-[10px] text-v2-mute">
        {comment.length}/1000
      </div>

      {error && (
        <div className="mb-2 rounded-v2-md border border-red-200 bg-red-50 px-3 py-2 font-ar text-[12px] text-red-700">
          {error}
        </div>
      )}

      <Button
        variant="primary"
        size="md"
        fullWidth
        onClick={submit}
        disabled={submitting}
      >
        {submitting ? t('جارٍ الإرسال…', 'Submitting…') : t('إرسال المراجعة', 'Submit review')}
      </Button>
    </div>
  );
}

export default ReviewBlock;
