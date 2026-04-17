import { useState, forwardRef } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import VideoPlaceholder from '../VideoPlaceholder';

const ease = [0.16, 1, 0.3, 1] as const;

interface Chapter {
  key: string;
  labelAr: string;
  labelEn: string;
  time: string;
}

const CHAPTERS: Chapter[] = [
  { key: 'profile', labelAr: 'تحليل البروفايل', labelEn: 'Profile analysis', time: '0:15' },
  { key: 'cv', labelAr: 'السيرة الذاتية', labelEn: 'CV Tailor', time: '0:45' },
  { key: 'posts', labelAr: 'المنشورات', labelEn: 'LinkedIn Posts', time: '1:20' },
  { key: 'outreach', labelAr: 'التواصل المهني', labelEn: 'Smart Outreach', time: '1:50' },
];

interface Props {
  /** Set to a YouTube/Vimeo URL when ready. Leave undefined for "coming soon" state. */
  videoUrl?: string;
}

const ProductDemo = forwardRef<HTMLDivElement, Props>(function ProductDemo({ videoUrl }, ref) {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const [active, setActive] = useState(0);

  return (
    <section
      id="demo"
      ref={ref}
      style={{
        position: 'relative',
        padding: '120px 24px',
        background: 'linear-gradient(180deg, #042F2E 0%, #0B4643 50%, #042F2E 100%)',
        overflow: 'hidden',
      }}
    >
      {/* ambient radial glow */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: '-20%',
          insetInlineStart: '50%',
          transform: 'translateX(-50%)',
          width: 900,
          height: 900,
          background: 'radial-gradient(circle, rgba(20,184,166,0.16) 0%, transparent 60%)',
          pointerEvents: 'none',
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          opacity: 0.6,
          pointerEvents: 'none',
        }}
      />

      <div style={{ position: 'relative', maxWidth: 1200, margin: '0 auto', textAlign: 'center' }}>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.5, ease }}
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: 12,
            fontWeight: 700,
            color: '#5EEAD4',
            letterSpacing: 1.5,
            textTransform: 'uppercase',
            marginBottom: 16,
          }}
        >
          {isAr ? 'العرض التوضيحي' : 'Watch the demo'}
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6, ease, delay: 0.05 }}
          style={{
            fontFamily: isAr ? 'Cairo, sans-serif' : 'Inter, sans-serif',
            fontSize: 'clamp(32px, 4.5vw, 52px)',
            fontWeight: 700,
            letterSpacing: '-0.03em',
            color: '#fff',
            lineHeight: 1.1,
            margin: 0,
          }}
        >
          {isAr ? 'شاهد وصّل في دقيقتين' : 'See Wassel in two minutes'}
        </motion.h2>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.5, ease, delay: 0.1 }}
          style={{
            fontFamily: isAr ? 'Cairo, sans-serif' : 'Inter, sans-serif',
            fontSize: 17,
            color: 'rgba(255,255,255,0.7)',
            marginTop: 16,
            marginBottom: 48,
            maxWidth: 620,
            marginInline: 'auto',
            lineHeight: 1.6,
          }}
        >
          {isAr
            ? 'جولة سريعة في كل خدمة — من تحليل البروفايل إلى حملة تواصل مبنية بعناية.'
            : 'A quick tour through every service — from profile analysis to a thoughtfully-built outreach campaign.'}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-120px' }}
          transition={{ duration: 0.7, ease, delay: 0.15 }}
        >
          <VideoPlaceholder
            videoUrl={videoUrl}
            browserUrl="wassel.sa/demo"
            duration={CHAPTERS[active].time}
            chapter={isAr ? CHAPTERS[active].labelAr : CHAPTERS[active].labelEn}
          />
        </motion.div>

        {/* Chapters */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.5, ease, delay: 0.3 }}
          style={{
            marginTop: 32,
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: 10,
          }}
        >
          {CHAPTERS.map((c, i) => {
            const isActive = i === active;
            return (
              <button
                key={c.key}
                onClick={() => setActive(i)}
                style={{
                  padding: '9px 16px',
                  borderRadius: 999,
                  border: `1px solid ${isActive ? 'rgba(94,234,212,0.6)' : 'rgba(255,255,255,0.12)'}`,
                  background: isActive ? 'rgba(20,184,166,0.18)' : 'rgba(255,255,255,0.04)',
                  color: isActive ? '#99F6E4' : 'rgba(255,255,255,0.7)',
                  fontFamily: isAr ? 'Cairo, sans-serif' : 'Inter, sans-serif',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  backdropFilter: 'blur(8px)',
                  transition: 'all 180ms',
                }}
              >
                <span>{isAr ? c.labelAr : c.labelEn}</span>
                <span
                  style={{
                    fontFamily: 'ui-monospace, monospace',
                    fontSize: 11,
                    color: isActive ? '#99F6E4' : 'rgba(255,255,255,0.5)',
                    direction: 'ltr',
                  }}
                >
                  {c.time}
                </span>
              </button>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
});

export default ProductDemo;
