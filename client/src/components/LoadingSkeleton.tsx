import React from 'react';

interface LoadingSkeletonProps {
  type: 'card' | 'list' | 'table' | 'text' | 'avatar' | 'button';
  count?: number;
  className?: string;
}

export default function LoadingSkeleton({ type, count = 1, className = '' }: LoadingSkeletonProps) {
  const baseClasses = 'bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 animate-pulse';

  const renderSkeleton = () => {
    switch (type) {
      case 'card':
        return (
          <div className={`${baseClasses} rounded-lg h-48 ${className}`} />
        );

      case 'list':
        return (
          <div className="space-y-3">
            {Array.from({ length: count }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className={`${baseClasses} h-4 rounded w-3/4`} />
                <div className={`${baseClasses} h-3 rounded w-1/2`} />
              </div>
            ))}
          </div>
        );

      case 'table':
        return (
          <div className="space-y-2">
            {Array.from({ length: count }).map((_, i) => (
              <div key={i} className="flex gap-4">
                <div className={`${baseClasses} h-10 rounded w-10`} />
                <div className={`${baseClasses} h-10 rounded flex-1`} />
                <div className={`${baseClasses} h-10 rounded w-20`} />
              </div>
            ))}
          </div>
        );

      case 'text':
        return (
          <div className="space-y-2">
            <div className={`${baseClasses} h-4 rounded w-full`} />
            <div className={`${baseClasses} h-4 rounded w-5/6`} />
            <div className={`${baseClasses} h-4 rounded w-4/6`} />
          </div>
        );

      case 'avatar':
        return (
          <div className={`${baseClasses} h-10 w-10 rounded-full`} />
        );

      case 'button':
        return (
          <div className={`${baseClasses} h-10 rounded-lg w-32`} />
        );

      default:
        return <div className={`${baseClasses} h-4 rounded w-full`} />;
    }
  };

  return <div className={className}>{renderSkeleton()}</div>;
}
