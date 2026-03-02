import React from 'react';

interface ClientBadgeProps {
  clientName?: string;
  clientId?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'outline';
}

const colors = [
  'bg-blue-100 text-blue-800 border-blue-300',
  'bg-green-100 text-green-800 border-green-300',
  'bg-purple-100 text-purple-800 border-purple-300',
  'bg-pink-100 text-pink-800 border-pink-300',
  'bg-amber-100 text-amber-800 border-amber-300',
  'bg-cyan-100 text-cyan-800 border-cyan-300',
];

export default function ClientBadge({
  clientName,
  clientId,
  size = 'md',
  variant = 'default',
}: ClientBadgeProps) {
  if (!clientName && !clientId) return null;

  // Generate consistent color based on clientId
  const colorIndex = clientId
    ? clientId.charCodeAt(0) % colors.length
    : Math.floor(Math.random() * colors.length);
  const colorClass = colors[colorIndex];

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base',
  };

  const displayText = clientName || `عميل #${clientId?.slice(0, 6)}`;

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${sizeClasses[size]} ${
        variant === 'outline' ? `border ${colorClass}` : colorClass
      }`}
    >
      {displayText}
    </span>
  );
}
