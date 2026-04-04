import { useTranslation } from 'react-i18next';

interface ProfileHeroCardProps {
  photoUrl: string | null;
  fullName: string;
  headline: string | null;
  isOnline: boolean;
}

export default function ProfileHeroCard({
  photoUrl,
  fullName,
  headline,
  isOnline,
}: ProfileHeroCardProps) {
  const { t } = useTranslation();

  // Proxy external photos to avoid CORS/referrer blocks
  // Note: googleusercontent.com (Google auth photos) are publicly accessible — no proxy needed
  const needsProxy = photoUrl && (
    photoUrl.includes('licdn.com') ||
    photoUrl.includes('linkedin.com')
  );
  const proxiedPhoto = photoUrl
    ? needsProxy
      ? `/api/proxy-image?url=${encodeURIComponent(photoUrl)}`
      : photoUrl
    : null;

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        borderRadius: 16,
        overflow: 'hidden',
        minHeight: 220,
        maxHeight: 280,
        display: 'flex',
        alignItems: 'flex-end',
        marginBottom: 20,
      }}
    >
      {/* Background — photo or gradient fallback */}
      {proxiedPhoto ? (
        <img
          src={proxiedPhoto}
          alt={fullName}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'top center',
          }}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
            // Show the fallback gradient by making sibling visible
            const fallback = e.currentTarget.parentElement?.querySelector(
              '[data-fallback]'
            ) as HTMLElement;
            if (fallback) fallback.style.display = 'flex';
          }}
        />
      ) : null}

      {/* Fallback gradient with initial — always rendered but hidden when photo loads */}
      <div
        data-fallback
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(135deg, #7c3aed 0%, #6366f1 40%, #ec4899 100%)',
          display: proxiedPhoto ? 'none' : 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            color: 'rgba(255,255,255,0.2)',
            fontSize: 96,
            fontWeight: 800,
            fontFamily: "'Outfit', 'Syne', sans-serif",
            lineHeight: 1,
            userSelect: 'none',
          }}
        >
          {fullName?.charAt(0)?.toUpperCase() || 'W'}
        </span>
      </div>

      {/* Dark gradient overlay for text readability */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(to top, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.25) 50%, transparent 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Content overlay at bottom */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          padding: '20px 22px',
          width: '100%',
        }}
      >
        {/* Online badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 8,
          }}
        >
          <div
            style={{
              width: 9,
              height: 9,
              borderRadius: '50%',
              background: isOnline ? '#4ade80' : '#94a3b8',
              boxShadow: isOnline
                ? '0 0 6px rgba(74, 222, 128, 0.8)'
                : 'none',
              flexShrink: 0,
            }}
          />
          <span
            style={{
              color: isOnline ? '#4ade80' : '#94a3b8',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 0.3,
            }}
          >
            {isOnline
              ? t('dashboard.online')
              : t('dashboard.idle')}
          </span>
        </div>

        {/* Name */}
        <h2
          style={{
            color: 'rgba(255,255,255,1)',
            fontSize: 22,
            fontWeight: 800,
            lineHeight: 1.2,
            fontFamily: "'Outfit', 'Syne', sans-serif",
            textShadow: '0 2px 8px rgba(0,0,0,0.4)',
            margin: 0,
          }}
        >
          {fullName}
        </h2>

        {/* Headline / Title */}
        {headline && (
          <p
            style={{
              color: 'rgba(255,255,255,0.7)',
              fontSize: 13,
              marginTop: 3,
              margin: '3px 0 0',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              textShadow: '0 1px 4px rgba(0,0,0,0.3)',
            }}
          >
            {headline}
          </p>
        )}
      </div>
    </div>
  );
}
