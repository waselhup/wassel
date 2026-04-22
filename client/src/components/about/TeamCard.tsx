import type { CSSProperties } from 'react';

interface TeamCardProps {
  photoSrc: string;
  photoAlt: string;
  name: string;
  role: string;
  bio: string;
  linkedinUrl?: string;
  fontFamily: string;
}

export default function TeamCard({
  photoSrc,
  photoAlt,
  name,
  role,
  bio,
  linkedinUrl,
  fontFamily,
}: TeamCardProps) {
  const card: CSSProperties = {
    background: 'white',
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
    transition: 'transform 0.3s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.3s',
    fontFamily,
  };

  const photoWrap: CSSProperties = {
    width: '100%',
    aspectRatio: '1 / 1',
    borderRadius: 14,
    overflow: 'hidden',
    background: 'var(--bg-off)',
    position: 'relative',
  };

  return (
    <div
      style={card}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-3px)';
        e.currentTarget.style.boxShadow = '0 10px 28px rgba(0,0,0,0.06)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.02)';
      }}
    >
      <div style={photoWrap}>
        <img
          src={photoSrc}
          alt={photoAlt}
          loading="lazy"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        <div
          style={{
            fontSize: '1.05rem',
            fontWeight: 600,
            color: 'var(--text)',
            letterSpacing: '-0.01em',
            lineHeight: 1.2,
          }}
        >
          {name}
        </div>
        <div
          style={{
            fontSize: '0.78rem',
            fontWeight: 500,
            color: 'var(--brand-deep)',
            letterSpacing: 0,
          }}
        >
          {role}
        </div>
      </div>

      <p
        style={{
          fontSize: '0.9rem',
          color: 'var(--text-body)',
          lineHeight: 1.7,
          margin: 0,
        }}
      >
        {bio}
      </p>

      {linkedinUrl && (
        <a
          href={linkedinUrl}
          target="_blank"
          rel="noreferrer noopener"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            alignSelf: 'flex-start',
            marginTop: '0.2rem',
            padding: '0.3rem 0.65rem',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'white',
            color: 'var(--text-dim)',
            fontSize: '0.75rem',
            fontWeight: 500,
            textDecoration: 'none',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--brand-deep)';
            e.currentTarget.style.borderColor = 'var(--brand-soft)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-dim)';
            e.currentTarget.style.borderColor = 'var(--border)';
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.063 2.063 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
          </svg>
          LinkedIn
        </a>
      )}
    </div>
  );
}
