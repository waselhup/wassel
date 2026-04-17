import React, { useState } from 'react';
import { ThumbsUp, ThumbsDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { trpc } from '@/lib/trpc';

interface Props {
  feature: 'profile_analysis' | 'cv_tailor' | 'posts' | 'campaigns' | 'campaign_message';
  outputId?: string;
}

/**
 * AIFeedbackWidget — small thumbs up/down + optional comment
 * for any AI-generated output. Submits to ai_feedback table.
 */
export const AIFeedbackWidget: React.FC<Props> = ({ feature, outputId }) => {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';

  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showComment, setShowComment] = useState(false);

  async function pick(r: number) {
    if (submitting || submitted) return;
    setRating(r);
    if (r >= 4) {
      void submit(r);
    } else {
      setShowComment(true);
    }
  }

  async function submit(r?: number) {
    const finalRating = r ?? rating;
    if (!finalRating || submitting) return;
    setSubmitting(true);
    try {
      await trpc.aiFeedback.submit({
        feature,
        outputId,
        rating: finalRating,
        comment: comment.trim() || undefined,
      });
      setSubmitted(true);
    } catch (e: any) {
      console.error('[AIFeedback] submit failed:', e);
      setRating(null);
      setShowComment(false);
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{
          padding: '10px 14px',
          borderRadius: 10,
          background: '#ECFDF5',
          color: '#065F46',
          fontSize: 12,
          fontWeight: 700,
          fontFamily: 'Cairo, Inter, sans-serif',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <Check size={14} />
        {isAr ? 'شكراً على ملاحظتك!' : 'Thanks for your feedback!'}
      </motion.div>
    );
  }

  return (
    <div
      style={{
        padding: '12px 14px',
        borderRadius: 10,
        background: '#F9FAFB',
        border: '1px solid #E5E7EB',
        fontFamily: 'Cairo, Inter, sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: '#6B7280',
          }}
        >
          {isAr ? 'هل أعجبك المحتوى؟' : 'Was this useful?'}
        </span>
        <button
          onClick={() => pick(5)}
          disabled={submitting}
          aria-label="thumbs up"
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            border: 'none',
            cursor: submitting ? 'wait' : 'pointer',
            background: rating === 5 ? '#10B981' : '#fff',
            color: rating === 5 ? '#fff' : '#6B7280',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 150ms',
            border2: '1px solid #E5E7EB',
          }}
        >
          <ThumbsUp size={14} />
        </button>
        <button
          onClick={() => pick(1)}
          disabled={submitting}
          aria-label="thumbs down"
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            border: 'none',
            cursor: submitting ? 'wait' : 'pointer',
            background: rating === 1 ? '#EF4444' : '#fff',
            color: rating === 1 ? '#fff' : '#6B7280',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 150ms',
          }}
        >
          <ThumbsDown size={14} />
        </button>
      </div>

      <AnimatePresence>
        {showComment && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden', marginTop: 10 }}
          >
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={
                isAr
                  ? 'ما الذي يمكن تحسينه؟ (اختياري)'
                  : 'What could be better? (optional)'
              }
              rows={2}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 8,
                border: '1.5px solid #E5E7EB',
                fontSize: 12,
                fontFamily: 'inherit',
                resize: 'vertical',
                outline: 'none',
                background: '#fff',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8, gap: 8 }}>
              <button
                onClick={() => submit()}
                disabled={submitting}
                style={{
                  padding: '7px 14px',
                  borderRadius: 8,
                  background: '#0A8F84',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 800,
                  fontSize: 12,
                  cursor: submitting ? 'wait' : 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {submitting ? (isAr ? 'جاري الإرسال...' : 'Sending...') : isAr ? 'إرسال' : 'Send'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AIFeedbackWidget;
