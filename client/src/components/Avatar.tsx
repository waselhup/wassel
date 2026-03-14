import React from 'react';

// Gradient color pairs for letter avatars
const AVATAR_COLORS: [string, string][] = [
  ['#7c3aed', '#a855f7'], // purple
  ['#ec4899', '#f472b6'], // pink
  ['#3b82f6', '#60a5fa'], // blue
  ['#10b981', '#34d399'], // green
  ['#f59e0b', '#fbbf24'], // amber
  ['#ef4444', '#f87171'], // red
  ['#8b5cf6', '#c084fc'], // violet
  ['#06b6d4', '#22d3ee'], // cyan
];

/** Deterministic color from name (same name → same color always) */
function getAvatarColor(name: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/** Initials from name (max 2 chars) */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(p => p.length > 0);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

type AvatarSize = 'sm' | 'md' | 'lg';

interface AvatarProps {
  name: string;
  size?: AvatarSize;
  imageUrl?: string | null;
}

const SIZES: Record<AvatarSize, { width: number; height: number; fontSize: number }> = {
  sm: { width: 28, height: 28, fontSize: 11 },
  md: { width: 36, height: 36, fontSize: 14 },
  lg: { width: 48, height: 48, fontSize: 18 },
};

export default function Avatar({ name, size = 'md', imageUrl }: AvatarProps) {
  const s = SIZES[size];

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        style={{
          width: s.width, height: s.height,
          borderRadius: '50%', objectFit: 'cover',
          flexShrink: 0,
        }}
      />
    );
  }

  const [c1, c2] = getAvatarColor(name || '?');
  const initials = getInitials(name || '?');

  return (
    <div
      style={{
        width: s.width,
        height: s.height,
        borderRadius: '50%',
        background: `linear-gradient(135deg, ${c1}, ${c2})`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: s.fontSize,
        fontWeight: 700,
        color: 'white',
        fontFamily: "'Syne', sans-serif",
        flexShrink: 0,
        boxShadow: '0 0 0 2px rgba(255,255,255,0.1)',
        letterSpacing: '-0.02em',
      }}
    >
      {initials}
    </div>
  );
}

export { getAvatarColor, getInitials };
