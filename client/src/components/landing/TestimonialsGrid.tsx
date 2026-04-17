import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Link } from 'wouter';
import { Star, ArrowRight } from 'lucide-react';
import { trpcQuery } from '@/lib/trpc';
import UserAvatar from '@/components/UserAvatar';

const ease = [0.16, 1, 0.3, 1] as const;

interface Review {
  id: string;
  rating: number;
  comment: string;
  user_name?: string | null;
  user_avatar?: string | null;
  created_at: string;
}

export default function TestimonialsGrid() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    trpcQuery<Review[]>('reviews.list')
      .then((d) => setReviews(d || []))
      .catch(() => setReviews([]))
      .finally(() => setLoaded(true));
  }, []);

  const shown = reviews.slice(0, 3);
  const hasReviews = shown.length > 0;

  return (
    <section style={{ padding: '100px 24px', background: 'linear-gradient(180deg, #F8FAFC 0%, #fff 100%)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.5, ease }}
          style={{ textAlign: 'center', marginBottom: 48, maxWidth: 720, marginInline: 'auto' }}
        >
          <div
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: 12,
              fontWeight: 700,
              color: '#0F766E',
              letterSpacing: 1,
              textTransform: 'uppercase',
              marginBottom: 12,
            }}
          >
            {isAr ? 'آراء حقيقية' : 'Real stories'}
          </div>
          <h2
            style={{
              fontFamily: isAr ? 'Cairo, sans-serif' : 'Inter, sans-serif',
              fontSize: 'clamp(30px, 4vw, 44px)',
              fontWeight: 700,
              letterSpacing: '-0.03em',
              color: '#0B1220',
              lineHeight: 1.1,
              margin: 0,
            }}
          >
            {isAr ? 'تجارب من محترفين سعوديين' : 'Voices from the Saudi community'}
          </h2>
        </motion.div>

        {hasReviews ? (
          <div
            className="landing-testimonials"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 20,
            }}
          >
            {shown.map((r, i) => (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-100px' }}
                transition={{ duration: 0.5, ease, delay: i * 0.08 }}
                whileHover={{ y: -3 }}
                style={{
                  background: '#fff',
                  border: '1px solid rgba(15,23,42,0.08)',
                  borderRadius: 20,
                  padding: 28,
                  transition: 'border-color 200ms, box-shadow 200ms',
                  display: 'flex',
                  flexDirection: 'column',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(15,118,110,0.35)';
                  e.currentTarget.style.boxShadow = '0 14px 30px -16px rgba(15,118,110,0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(15,23,42,0.08)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{ display: 'flex', gap: 3, marginBottom: 14 }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      size={14}
                      style={{
                        fill: n <= (r.rating || 5) ? '#D4A22E' : 'transparent',
                        color: n <= (r.rating || 5) ? '#D4A22E' : '#E2E8F0',
                      }}
                    />
                  ))}
                </div>
                <p
                  style={{
                    fontFamily: isAr ? 'Cairo, serif' : 'Georgia, serif',
                    fontSize: 17,
                    fontStyle: 'italic',
                    color: '#0B1220',
                    lineHeight: 1.6,
                    margin: 0,
                    letterSpacing: isAr ? 0 : '-0.01em',
                    flex: 1,
                  }}
                >
                  &ldquo;{r.comment}&rdquo;
                </p>
                <div
                  style={{
                    marginTop: 22,
                    paddingTop: 18,
                    borderTop: '1px solid rgba(15,23,42,0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <UserAvatar avatarUrl={r.user_avatar} name={r.user_name} size="md" />
                  <div>
                    <div
                      style={{
                        fontFamily: isAr ? 'Cairo, sans-serif' : 'Inter, sans-serif',
                        fontSize: 14,
                        fontWeight: 700,
                        color: '#0B1220',
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {r.user_name || (isAr ? 'مستخدم وصّل' : 'Wassel member')}
                    </div>
                    <div
                      style={{
                        fontFamily: isAr ? 'Cairo, sans-serif' : 'Inter, sans-serif',
                        fontSize: 12,
                        color: '#64748B',
                      }}
                    >
                      {new Date(r.created_at).toLocaleDateString(isAr ? 'ar' : 'en', {
                        month: 'short',
                        year: 'numeric',
                      })}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div
            className="landing-testimonials"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 20,
            }}
          >
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.45, ease, delay: i * 0.08 }}
                style={{
                  background: '#fff',
                  border: '1px dashed rgba(15,23,42,0.12)',
                  borderRadius: 20,
                  padding: 28,
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  minHeight: 220,
                }}
              >
                <div style={{ marginBottom: 10, color: '#CBD5E1' }}>
                  <Star size={18} style={{ margin: '0 2px' }} />
                  <Star size={18} style={{ margin: '0 2px' }} />
                  <Star size={18} style={{ margin: '0 2px' }} />
                </div>
                <div
                  style={{
                    fontFamily: isAr ? 'Cairo, sans-serif' : 'Inter, sans-serif',
                    fontSize: 14,
                    color: '#475569',
                    lineHeight: 1.6,
                    marginBottom: 18,
                  }}
                >
                  {loaded
                    ? isAr
                      ? 'كن أول من يشارك تجربته مع وصّل'
                      : 'Be the first to share your Wassel story'
                    : ' '}
                </div>
                {loaded && (
                  <Link
                    href="/signup"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      justifyContent: 'center',
                      fontFamily: isAr ? 'Cairo, sans-serif' : 'Inter, sans-serif',
                      fontSize: 13,
                      fontWeight: 700,
                      color: '#0F766E',
                      textDecoration: 'none',
                    }}
                  >
                    {isAr ? 'ابدأ مجاناً' : 'Start free'}
                    <ArrowRight size={13} style={{ transform: isAr ? 'rotate(180deg)' : undefined }} />
                  </Link>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 768px) {
          .landing-testimonials { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}
