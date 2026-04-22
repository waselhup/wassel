import React from 'react';

interface WasselLogoProps {
  size?: number;
  variant?: 'default' | 'inverted' | 'teal-bg';
}

export function WasselLogo({ size = 28, variant = 'default' }: WasselLogoProps) {
  const ring = variant === 'inverted' ? '#FFFFFF' : '#14b8a6';
  const letter = variant === 'teal-bg' ? '#14b8a6' : variant === 'inverted' ? '#14b8a6' : '#FFFFFF';
  const coreFill = variant === 'teal-bg' ? '#FFFFFF' : '#14b8a6';

  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <style>{`@keyframes wassel-cw{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}@keyframes wassel-ccw{from{transform:rotate(0deg)}to{transform:rotate(-360deg)}}`}</style>
      <g style={{ transformOrigin: '60px 60px', animation: 'wassel-cw 26s linear infinite' }}>
        <circle cx="60" cy="60" r="52" stroke={ring} strokeWidth="1.2" strokeDasharray="3 7" fill="none" opacity={0.26} />
        <circle cx="60" cy="8" r="5.5" fill="#C9922A" opacity={0.95} />
        <circle cx="60" cy="8" r="9.5" fill="#C9922A" opacity={0.18} />
        <circle cx="112" cy="60" r="3.5" fill={ring} opacity={0.5} />
        <circle cx="60" cy="112" r="3.5" fill={ring} opacity={0.6} />
        <circle cx="8" cy="60" r="3.5" fill={ring} opacity={0.4} />
      </g>
      <g style={{ transformOrigin: '60px 60px', animation: 'wassel-ccw 18s linear infinite' }}>
        <circle cx="60" cy="60" r="34" stroke={ring} strokeWidth="0.7" strokeDasharray="2 5" fill="none" opacity={0.13} />
      </g>
      <circle cx="60" cy="60" fill="none" stroke="#C9922A" strokeWidth="1.3">
        <animate attributeName="r" values="13;54" dur="2.6s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.5;0" dur="2.6s" repeatCount="indefinite" />
      </circle>
      <circle cx="60" cy="60" fill="none" stroke="#C9922A" strokeWidth="0.7">
        <animate attributeName="r" values="13;62" dur="2.6s" repeatCount="indefinite" begin="0.55s" />
        <animate attributeName="opacity" values="0.28;0" dur="2.6s" repeatCount="indefinite" begin="0.55s" />
      </circle>
      <circle cx="60" cy="60" r="18" fill={coreFill} opacity={0.08} />
      <circle cx="60" cy="60" r="13.5" fill={coreFill} />
      <text x="60" y="65.5" textAnchor="middle" fontFamily="Cairo, sans-serif" fontWeight="900" fontSize="16" fill={letter}>{'\u0648'}</text>
    </svg>
  );
}

export default WasselLogo;
