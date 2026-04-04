import React from 'react';
import { AlertCircle, TrendingUp } from 'lucide-react';
import { trpc } from '@/lib/trpc';

interface UsageMeterProps {
  compact?: boolean;
}

export default function UsageMeter({ compact = false }: UsageMeterProps) {
  const { data: usage, isLoading } = trpc.billing.getUsage.useQuery();

  if (isLoading || !usage) {
    return (
      <div className={`${compact ? 'p-2' : 'p-4'} bg-gray-100 rounded-lg animate-pulse`}>
        <div className="h-4 bg-gray-300 rounded w-24"></div>
      </div>
    );
  }

  const isNearLimit = usage.percentageUsed >= 80;
  const isAtLimit = usage.percentageUsed >= 100;

  if (compact) {
    return (
      <div className="flex items-center gap-2 px-3 py-1 bg-[var(--bg-base)] rounded-lg border border-gray-200">
        <TrendingUp size={14} className="text-gray-600" />
        <span className="text-xs font-medium text-gray-700">
          {usage.usedLeads} / {usage.monthlyLimit}
        </span>
        {isNearLimit && (
          <AlertCircle size={14} className="text-amber-600" />
        )}
      </div>
    );
  }

  return (
    <div className="bg-[var(--bg-card)] rounded-lg border border-gray-200 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900">استخدام الخطة</h3>
        <span className={`px-2 py-1 text-xs font-medium rounded ${
          isAtLimit
            ? 'bg-red-100 text-red-800'
            : isNearLimit
            ? 'bg-amber-100 text-amber-800'
            : 'bg-green-100 text-green-800'
        }`}>
          {isAtLimit ? 'تم الوصول للحد' : isNearLimit ? 'قريب من الحد' : 'متاح'}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-gray-600">العملاء المضافون هذا الشهر</span>
          <span className="text-sm font-medium text-gray-900">
            {usage.usedLeads} / {usage.monthlyLimit}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${
              isAtLimit
                ? 'bg-red-600'
                : isNearLimit
                ? 'bg-amber-500'
                : 'bg-green-500'
            }`}
            style={{ width: `${Math.min(usage.percentageUsed, 100)}%` }}
          />
        </div>
      </div>

      {/* Remaining */}
      <div className="text-sm text-gray-600">
        {usage.remainingLeads > 0 ? (
          <span>
            <span className="font-medium text-gray-900">{usage.remainingLeads}</span> عميل متبقي
          </span>
        ) : (
          <span className="text-red-600 font-medium">
            لقد وصلت إلى حد الخطة
          </span>
        )}
      </div>

      {/* Upgrade Prompt */}
      {isNearLimit && (
        <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded">
          <p className="text-xs text-amber-800">
            قم بالترقية للحصول على المزيد من العملاء والميزات المتقدمة
          </p>
        </div>
      )}
    </div>
  );
}
