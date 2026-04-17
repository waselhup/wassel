import React, { useState } from 'react';
import { Play, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface VideoPlaceholderProps {
  title: string;
  duration: string;
  videoUrl?: string;
  thumbnail?: string;
  onClick?: () => void;
}

/**
 * VideoPlaceholder — professional video card. If videoUrl is set, opens it.
 * Otherwise shows "coming soon" overlay.
 *
 * To activate: set videoUrl="https://youtu.be/..." or "https://vimeo.com/..."
 */
export const VideoPlaceholder: React.FC<VideoPlaceholderProps> = ({
  title,
  duration,
  videoUrl,
  thumbnail,
  onClick,
}) => {
  const { t, i18n } = useTranslation();
  const [hovered, setHovered] = useState(false);
  const isAr = i18n.language === 'ar';

  const handleClick = () => {
    if (onClick) return onClick();
    if (videoUrl) {
      window.open(videoUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const comingSoonLabel = isAr ? 'قريباً' : 'Coming soon';

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') handleClick();
      }}
      style={{
        position: 'relative',
        borderRadius: 16,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'transform 200ms ease',
        transform: hovered ? 'scale(1.02)' : 'scale(1)',
        aspectRatio: '16 / 9',
        background: thumbnail
          ? `url(${thumbnail}) center/cover no-repeat`
          : 'linear-gradient(135deg, #0F766E 0%, #164E63 100%)',
        boxShadow: hovered
          ? '0 12px 28px rgba(15,118,110,0.25)'
          : '0 4px 12px rgba(0,0,0,0.08)',
        border: '1px solid rgba(255,255,255,0.1)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: hovered ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background 200ms ease',
        }}
      >
        <div
          style={{
            background: '#fff',
            borderRadius: '50%',
            padding: 18,
            transform: hovered ? 'scale(1.1)' : 'scale(1)',
            transition: 'transform 200ms ease',
            boxShadow: '0 6px 16px rgba(0,0,0,0.15)',
          }}
        >
          <Play
            size={28}
            style={{ fill: '#0A8F84', color: '#0A8F84', marginInlineStart: 3 }}
          />
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 12,
          insetInlineEnd: 12,
          background: 'rgba(0,0,0,0.7)',
          color: '#fff',
          padding: '4px 10px',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          fontFamily: 'Cairo, Inter, sans-serif',
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        <Clock size={12} />
        <span>{duration}</span>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          padding: '20px 16px 14px',
          background:
            'linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0))',
          color: '#fff',
        }}
      >
        <p
          style={{
            margin: 0,
            fontFamily: 'Cairo, Inter, sans-serif',
            fontWeight: 800,
            fontSize: 14,
            lineHeight: 1.4,
            direction: isAr ? 'rtl' : 'ltr',
          }}
        >
          {title}
        </p>
      </div>

      {!videoUrl && (
        <div
          style={{
            position: 'absolute',
            top: 10,
            insetInlineStart: 10,
            background: '#F97316',
            color: '#fff',
            padding: '4px 10px',
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 800,
            fontFamily: 'Cairo, Inter, sans-serif',
          }}
        >
          {comingSoonLabel}
        </div>
      )}
    </div>
  );
};

export default VideoPlaceholder;
