import React from 'react';
import { Plus, Inbox, AlertCircle } from 'lucide-react';

interface EmptyStateProps {
  type: 'no-leads' | 'no-campaigns' | 'no-clients' | 'no-data';
  onAction?: () => void;
  actionLabel?: string;
}

const emptyStates = {
  'no-leads': {
    icon: Inbox,
    titleAr: 'لا توجد عملاء بعد',
    descriptionAr: 'ابدأ بإضافة عملاء من LinkedIn باستخدام الإضافة',
    actionLabelAr: 'تثبيت الإضافة',
    color: 'blue',
  },
  'no-campaigns': {
    icon: Plus,
    titleAr: 'لا توجد حملات بعد',
    descriptionAr: 'أنشئ حملتك الأولى لبدء إدارة العملاء',
    actionLabelAr: 'إنشاء حملة',
    color: 'purple',
  },
  'no-clients': {
    icon: AlertCircle,
    titleAr: 'لا توجد عملاء بعد',
    descriptionAr: 'أضف عميل جديد للبدء في إدارة حملاتهم',
    actionLabelAr: 'إضافة عميل',
    color: 'green',
  },
  'no-data': {
    icon: Inbox,
    titleAr: 'لا توجد بيانات',
    descriptionAr: 'ابدأ بإضافة بيانات جديدة',
    actionLabelAr: 'إضافة',
    color: 'gray',
  },
};

export default function EmptyState({
  type,
  onAction,
  actionLabel,
}: EmptyStateProps) {
  const state = emptyStates[type];
  const Icon = state.icon;

  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
    green: 'bg-green-50 text-green-600',
    gray: 'bg-gray-50 text-gray-600',
  };

  const buttonClasses: Record<string, string> = {
    blue: 'bg-blue-600 hover:bg-blue-700',
    purple: 'bg-purple-600 hover:bg-purple-700',
    green: 'bg-green-600 hover:bg-green-700',
    gray: 'bg-gray-600 hover:bg-gray-700',
  };

  const colorClass = colorClasses[state.color] || colorClasses.gray;
  const buttonClass = buttonClasses[state.color] || buttonClasses.gray;

  return (
    <div className={`${colorClass} rounded-lg border-2 border-dashed p-12 text-center`}>
      <div className="flex justify-center mb-4">
        <Icon size={48} className="opacity-50" />
      </div>

      <h3 className="text-lg font-semibold mb-2">{state.titleAr}</h3>
      <p className="text-sm opacity-75 mb-6 max-w-sm mx-auto">
        {state.descriptionAr}
      </p>

      {onAction && (
        <button
          onClick={onAction}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium transition-colors ${buttonClass}`}
        >
          <Plus size={18} />
          {actionLabel || state.actionLabelAr}
        </button>
      )}
    </div>
  );
}
