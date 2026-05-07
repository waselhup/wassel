import React, { useState } from 'react';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface Props {
  avatarUrl?: string | null;
  name?: string | null;
  email?: string | null;
  size?: AvatarSize;
  className?: string;
  ring?: boolean;
}

const SIZES: Record<AvatarSize, { px: number; font: number }> = {
  xs: { px: 24, font: 10 },
  sm: { px: 32, font: 12 },
  md: { px: 40, font: 14 },
  lg: { px: 56, font: 18 },
  xl: { px: 80, font: 28 },
};

function getInitials(name?: string | null, email?: string | null): string {
  const source = (name && name.trim()) || (email && email.split('@')[0]) || '?';
  const parts = source
    .replace(/[._-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const PROXIED_HOSTS = [
  'media.licdn.com',
  'static.licdn.com',
  'media-exp1.licdn.com',
  'media-exp2.licdn.com',
  'lh3.googleusercontent.com',
  'lh4.googleusercontent.com',
  'lh5.googleusercontent.com',
  'lh6.googleusercontent.com',
  'avatars.githubusercontent.com',
  'pbs.twimg.com',
];

function resolveAvatarUrl(raw: string): string {
  try {
    const u = new URL(raw);
    if (PROXIED_HOSTS.some((h) => u.hostname === h)) {
      return `/api/avatar-proxy?url=${encodeURIComponent(raw)}`;
    }
    return raw;
  } catch {
    return raw;
  }
}

/**
 * UserAvatar — single source of truth for displaying user photos.
 * Falls back to initials on missing/broken URL.
 * Use everywhere the user's avatar should appear.
 */
export const UserAvatar: React.FC<Props> = ({
  avatarUrl,
  name,
  email,
  size = 'md',
  className = '',
  ring = true,
}) => {
  const [errored, setErrored] = useState(false);
  const dim = SIZES[size];
  const initials = getInitials(name, email);
  const shouldShowImg = !!avatarUrl && !errored;

  const baseStyle: React.CSSProperties = {
    width: dim.px,
    height: dim.px,
    borderRadius: '50%',
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    boxShadow: ring ? '0 0 0 2px #ffffff' : undefined,
  };

  if (shouldShowImg) {
    return (
      <img
        src={resolveAvatarUrl(avatarUrl as string)}
        alt={name || email || 'User'}
        referrerPolicy="no-referrer"
        onError={() => setErrored(true)}
        className={className}
        style={{
          ...baseStyle,
          objectFit: 'cover',
          background: '#14b8a6',
        }}
      />
    );
  }

  return (
    <div
      className={className}
      aria-label={name || email || 'User'}
      style={{
        ...baseStyle,
        background: 'linear-gradient(135deg, #14b8a6, #0EA5E9)',
        color: '#fff',
        fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
        fontWeight: 800,
        fontSize: dim.font,
        letterSpacing: 0.3,
      }}
    >
      {initials}
    </div>
  );
};

export default UserAvatar;
