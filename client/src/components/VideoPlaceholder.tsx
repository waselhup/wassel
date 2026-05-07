import React, { useState, useEffect } from 'react';
import { Play, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';

export interface VideoPlaceholderProps {
  /** When set, clicking play opens an embed. When undefined, shows a "coming soon" state. */
  videoUrl?: string;
  /** Background image shown behind the play button. Can be a dashboard screenshot. */
  thumbnailSrc?: string;
  title?: string;
  duration?: string;
  /** Optional chapter label shown in the bottom-left badge */
  chapter?: string;
  /** Fake URL shown in the browser frame. Default: wassel.sa/demo */
  browserUrl?: string;
  /** Override click handler. If unset: opens embed modal (videoUrl) or does nothing. */
  onClick?: () => void;
  className?: string;
}

/**
 * VideoPlaceholder — professional video card with a realistic browser frame,
 * a prominent play button with pulse-ring animation, and a duration badge.
 *
 * Three modes:
 *  1. videoUrl provided → click opens modal with YouTube/Vimeo iframe
 *  2. videoUrl undefined → shows a "coming soon" overlay but keeps the UI
 *     interactive (click shows toast-like inline message)
 *  3. onClick provided → overrides everything; caller controls behavior
 */
export const VideoPlaceholder: React.FC<VideoPlaceholderProps> = ({
  videoUrl,
  thumbnailSrc,
  title,
  duration = '2:14',
  chapter,
  browserUrl = 'wassel.sa/demo',
  onClick,
  className,
}) => {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const [open, setOpen] = useState(false);
  const [prefersReduced, setPrefersReduced] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReduced(mq.matches);
    const h = () => setPrefersReduced(mq.matches);
    mq.addEventListener?.('change', h);
    return () => mq.removeEventListener?.('change', h);
  }, []);

  // Convert youtu.be / youtube watch URLs → embed URL
  function toEmbed(url: string): string {
    try {
      const u = new URL(url);
      if (u.hostname.includes('youtu.be')) {
        return `https://www.youtube.com/embed/${u.pathname.slice(1)}?autoplay=1`;
      }
      if (u.hostname.includes('youtube.com') && u.searchParams.get('v')) {
        return `https://www.youtube.com/embed/${u.searchParams.get('v')}?autoplay=1`;
      }
      if (u.hostname.includes('vimeo.com')) {
        return `https://player.vimeo.com/video/${u.pathname.slice(1)}?autoplay=1`;
      }
      return url;
    } catch {
      return url;
    }
  }

  function handlePlay() {
    if (onClick) return onClick();
    setOpen(true);
  }

  const comingSoon = isAr
    ? 'الفيديو قريباً — سيتم إضافته من لوحة الإدارة'
    : 'Video coming soon — will be added from the admin panel';

  return (
    <>
      <div
        className={className}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 1080,
          margin: '0 auto',
          borderRadius: 20,
          overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 24px 60px -12px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.04)',
          background: '#0B1220',
        }}
      >
        {/* Browser chrome */}
        <div
          style={{
            background: 'linear-gradient(180deg, #1A2235 0%, #0F172A 100%)',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div style={{ display: 'flex', gap: 6 }}>
            <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#FF5F57' }} />
            <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#FEBC2E' }} />
            <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#28C840' }} />
          </div>
          <div
            style={{
              flex: 1,
              background: 'rgba(255,255,255,0.06)',
              color: 'rgba(255,255,255,0.5)',
              fontSize: 11,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              padding: '5px 12px',
              borderRadius: 6,
              textAlign: 'center',
              letterSpacing: 0.1,
              direction: 'ltr',
              userSelect: 'none',
            }}
          >
            🔒 {browserUrl}
          </div>
          <div style={{ width: 34 }} />
        </div>

        {/* Video area */}
        <div
          onClick={handlePlay}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handlePlay()}
          style={{
            position: 'relative',
            aspectRatio: '16 / 9',
            cursor: 'pointer',
            background: thumbnailSrc
              ? `url(${thumbnailSrc}) center/cover no-repeat`
              : 'radial-gradient(ellipse at 30% 20%, rgba(15,118,110,0.3) 0%, transparent 55%), radial-gradient(ellipse at 75% 80%, rgba(212,162,46,0.15) 0%, transparent 55%), linear-gradient(135deg, #0F172A 0%, #134E4A 100%)',
          }}
        >
          {/* Dim overlay */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.4) 100%)',
            }}
          />

          {/* Faint grid */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage:
                'radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px)',
              backgroundSize: '24px 24px',
              opacity: 0.5,
              pointerEvents: 'none',
            }}
          />

          {/* Duration badge */}
          <div
            style={{
              position: 'absolute',
              top: 16,
              insetInlineEnd: 16,
              background: 'rgba(0,0,0,0.7)',
              color: '#fff',
              padding: '5px 12px',
              borderRadius: 8,
              fontFamily: 'ui-monospace, monospace',
              fontSize: 12,
              fontWeight: 700,
              backdropFilter: 'blur(10px)',
              letterSpacing: 0.3,
            }}
          >
            {duration}
          </div>

          {/* Chapter badge (optional) */}
          {chapter && (
            <div
              style={{
                position: 'absolute',
                top: 16,
                insetInlineStart: 16,
                background: 'rgba(15,118,110,0.9)',
                color: '#fff',
                padding: '5px 12px',
                borderRadius: 8,
                fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                fontSize: 11,
                fontWeight: 800,
                backdropFilter: 'blur(10px)',
              }}
            >
              {chapter}
            </div>
          )}

          {/* Coming-soon ribbon */}
          {!videoUrl && (
            <div
              style={{
                position: 'absolute',
                bottom: 16,
                insetInlineStart: 16,
                background: 'rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.85)',
                border: '1px solid rgba(255,255,255,0.2)',
                padding: '5px 12px',
                borderRadius: 999,
                fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                fontSize: 11,
                fontWeight: 700,
                backdropFilter: 'blur(10px)',
                letterSpacing: 0.3,
              }}
            >
              {isAr ? 'قريباً' : 'Coming soon'}
            </div>
          )}

          {/* Title (optional) */}
          {title && (
            <div
              style={{
                position: 'absolute',
                bottom: 48,
                insetInlineStart: 20,
                insetInlineEnd: 20,
                color: '#fff',
                fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                fontWeight: 800,
                fontSize: 16,
                textShadow: '0 2px 10px rgba(0,0,0,0.5)',
              }}
            >
              {title}
            </div>
          )}

          {/* Play button with pulse rings */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div style={{ position: 'relative', width: 96, height: 96 }}>
              {!prefersReduced && (
                <>
                  <motion.span
                    aria-hidden
                    initial={{ scale: 1, opacity: 0.55 }}
                    animate={{ scale: 1.6, opacity: 0 }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut' }}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: '50%',
                      background: 'rgba(255,255,255,0.35)',
                    }}
                  />
                  <motion.span
                    aria-hidden
                    initial={{ scale: 1, opacity: 0.35 }}
                    animate={{ scale: 1.9, opacity: 0 }}
                    transition={{ duration: 2.2, delay: 1.1, repeat: Infinity, ease: 'easeOut' }}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: '50%',
                      background: 'rgba(255,255,255,0.2)',
                    }}
                  />
                </>
              )}
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.95 }}
                onClick={(e) => {
                  e.stopPropagation();
                  handlePlay();
                }}
                aria-label={isAr ? 'تشغيل العرض' : 'Play demo'}
                style={{
                  position: 'relative',
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.88)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Play
                  size={36}
                  style={{ fill: '#0F766E', color: '#0F766E', marginInlineStart: 4 }}
                />
              </motion.button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.85)',
              backdropFilter: 'blur(8px)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
            }}
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'relative',
                width: '100%',
                maxWidth: 1100,
                aspectRatio: '16 / 9',
                background: '#000',
                borderRadius: 16,
                overflow: 'hidden',
                boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
              }}
            >
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                style={{
                  position: 'absolute',
                  top: 12,
                  insetInlineEnd: 12,
                  zIndex: 2,
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: 'rgba(0,0,0,0.6)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backdropFilter: 'blur(10px)',
                }}
              >
                <X size={18} />
              </button>
              {videoUrl ? (
                <iframe
                  src={toEmbed(videoUrl)}
                  title={title || 'Demo'}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  style={{ width: '100%', height: '100%', border: 0 }}
                />
              ) : (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 16,
                    color: '#fff',
                    fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                    textAlign: 'center',
                    padding: 24,
                    background:
                      'radial-gradient(ellipse at 50% 20%, rgba(15,118,110,0.4) 0%, transparent 55%), #0F172A',
                  }}
                >
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 16,
                      background: 'rgba(15,118,110,0.2)',
                      border: '1px solid rgba(15,118,110,0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Play size={28} style={{ color: '#14B8A6' }} />
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{comingSoon}</div>
                  <div style={{ fontSize: 13, opacity: 0.6, maxWidth: 420 }}>
                    {isAr
                      ? 'فريق وصل يحضّر عرضاً احترافياً الآن. سيظهر هنا فور جاهزيته.'
                      : 'The Wassel team is preparing a polished demo. It will appear here once ready.'}
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default VideoPlaceholder;
