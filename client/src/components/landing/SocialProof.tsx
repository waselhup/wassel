import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

const COMPANIES: Array<{ name: string; weight: number }> = [
  { name: 'STC', weight: 900 },
  { name: 'Aramco', weight: 800 },
  { name: 'Careem', weight: 700 },
  { name: 'Tamara', weight: 700 },
  { name: 'Jahez', weight: 900 },
  { name: 'Unifonic', weight: 800 },
];

export default function SocialProof() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';

  return (
    <section style={{ padding: '40px 24px 0' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          style={{
            textAlign: 'center',
            fontFamily: isAr ? 'Cairo, sans-serif' : 'Inter, sans-serif',
            fontSize: 12,
            color: '#94A3B8',
            fontWeight: 600,
            letterSpacing: isAr ? 0 : 0.5,
            textTransform: isAr ? undefined : 'uppercase',
            marginBottom: 22,
          }}
        >
          {isAr ? 'يثق به محترفون من' : 'Trusted by professionals at'}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5, delay: 0.1 }}
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '28px 52px',
            filter: 'grayscale(100%)',
            opacity: 0.55,
          }}
        >
          {COMPANIES.map((c) => (
            <span
              key={c.name}
              style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: c.weight as any,
                fontSize: 20,
                color: '#0B1220',
                letterSpacing: '-0.02em',
                transition: 'filter 200ms, opacity 200ms',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.parentElement!.style.filter = 'grayscale(0%)';
                e.currentTarget.parentElement!.style.opacity = '1';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.parentElement!.style.filter = 'grayscale(100%)';
                e.currentTarget.parentElement!.style.opacity = '0.55';
              }}
            >
              {c.name}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
