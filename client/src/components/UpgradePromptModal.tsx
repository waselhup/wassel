import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles } from 'lucide-react';
import { trpc } from '@/lib/trpc';

interface UpgradePromptModalProps {
  open: boolean;
  onClose: () => void;
  surface?: string;       // e.g. 'in_app_modal', 'pricing_page'
  trigger?: string;       // e.g. 'insufficient_tokens', 'high_engagement'
}

interface PitchData {
  id: string;
  headline_ar: string;
  headline_en: string;
  body_ar: string;
  body_en: string;
  cta_label_ar?: string | null;
  cta_label_en?: string | null;
  cta_url?: string | null;
  recommended_plan?: string | null;
  recommended_token_pack?: string | null;
}

/**
 * User-facing upgrade prompt. Pulls Hassan's approved pitch matching the user's
 * A/B variant. Falls back to a generic pricing CTA if no pitch is available.
 */
export default function UpgradePromptModal({ open, onClose, surface = 'in_app_modal' }: UpgradePromptModalProps) {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const [, navigate] = useLocation();
  const [pitch, setPitch] = useState<PitchData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    trpc.hassan.servePitch({ surface }).then((p: any) => {
      if (p && p.id) setPitch(p as PitchData);
      else setPitch(null);
    }).catch(() => setPitch(null)).finally(() => setLoading(false));
  }, [open, surface]);

  const handleCtaClick = async () => {
    if (pitch?.id) {
      try { await trpc.hassan.recordPitchClick({ pitchId: pitch.id }); } catch {}
    }
    const url = pitch?.cta_url || '/v2/pricing';
    onClose();
    navigate(url);
  };

  const headline = pitch ? (isAr ? pitch.headline_ar : pitch.headline_en) : (isAr ? 'ارفع مستواك على وصل' : 'Level up on Wassel');
  const body = pitch ? (isAr ? pitch.body_ar : pitch.body_en) : (isAr ? 'استفد من باقات وصل المدفوعة لتسريع رحلتك المهنية.' : 'Unlock Wassel\'s paid plans to accelerate your career journey.');
  const ctaLabel = pitch
    ? (isAr ? (pitch.cta_label_ar || 'ترقية الآن') : (pitch.cta_label_en || 'Upgrade'))
    : (isAr ? 'عرض الباقات' : 'View plans');

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 24, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 24, opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            style={{
              background: 'linear-gradient(160deg, #ffffff 0%, #faf7ff 100%)',
              borderRadius: 24,
              padding: 32,
              maxWidth: 460,
              width: '100%',
              boxShadow: '0 24px 60px rgba(15, 23, 42, 0.20)',
              position: 'relative',
              direction: isAr ? 'rtl' : 'ltr',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              aria-label="close"
              style={{
                position: 'absolute',
                top: 16,
                insetInlineEnd: 16,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: '#9CA3AF',
                padding: 6,
                borderRadius: 8,
              }}
            >
              <X size={18} />
            </button>

            <div style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: 'linear-gradient(135deg, #14b8a6, #0d9488)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 20,
              boxShadow: '0 8px 22px rgba(20, 184, 166, 0.35)',
            }}>
              <Sparkles size={26} color="#fff" />
            </div>

            <h2 style={{
              fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
              fontSize: 24,
              fontWeight: 800,
              color: '#0F172A',
              marginBottom: 12,
              lineHeight: 1.3,
            }}>
              {loading ? '...' : headline}
            </h2>

            <p style={{
              fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
              fontSize: 15,
              color: '#475569',
              lineHeight: 1.6,
              marginBottom: 24,
            }}>
              {loading ? '' : body}
            </p>

            <button
              onClick={handleCtaClick}
              style={{
                background: 'linear-gradient(135deg, #14b8a6, #0d9488)',
                color: '#fff',
                border: 'none',
                padding: '14px 24px',
                borderRadius: 14,
                fontWeight: 700,
                fontSize: 15,
                cursor: 'pointer',
                width: '100%',
                fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                boxShadow: '0 8px 18px rgba(20, 184, 166, 0.35)',
              }}
            >
              {ctaLabel}
            </button>

            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                color: '#94A3B8',
                border: 'none',
                padding: '12px 24px',
                marginTop: 8,
                fontSize: 13,
                cursor: 'pointer',
                width: '100%',
                fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
              }}
            >
              {isAr ? 'ربما لاحقاً' : 'Maybe later'}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
