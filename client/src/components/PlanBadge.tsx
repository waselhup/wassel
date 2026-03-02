import React from 'react';
import { Crown } from 'lucide-react';

interface PlanBadgeProps {
  plan: 'starter' | 'pro' | 'agency';
  size?: 'sm' | 'md' | 'lg';
}

const planConfig = {
  starter: {
    nameAr: 'المبتدئ',
    color: 'bg-blue-100 text-blue-800',
    icon: false,
  },
  pro: {
    nameAr: 'احترافي',
    color: 'bg-purple-100 text-purple-800',
    icon: false,
  },
  agency: {
    nameAr: 'وكالة',
    color: 'bg-amber-100 text-amber-800',
    icon: true,
  },
};

export default function PlanBadge({ plan, size = 'md' }: PlanBadgeProps) {
  const config = planConfig[plan];

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${sizeClasses[size]} ${config.color}`}
    >
      {config.icon && <Crown size={size === 'sm' ? 12 : size === 'md' ? 14 : 16} />}
      {config.nameAr}
    </span>
  );
}
