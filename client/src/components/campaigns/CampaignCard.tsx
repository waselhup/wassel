import React from 'react';
import { MoreVertical, Users, TrendingUp, Clock } from 'lucide-react';

interface CampaignCardProps {
  id: string;
  name: string;
  type: 'invitation' | 'message' | 'sequence';
  status: 'active' | 'draft' | 'paused';
  leadsCount: number;
  messagesCount: number;
  responseRate: number;
  createdAt: string;
}

export default function CampaignCard({
  id,
  name,
  type,
  status,
  leadsCount,
  messagesCount,
  responseRate,
  createdAt,
}: CampaignCardProps) {
  const typeLabels = {
    invitation: 'دعوة',
    message: 'رسالة',
    sequence: 'سلسلة',
  };

  const statusConfig = {
    active: { label: 'نشط', color: 'bg-green-100 text-green-700' },
    draft: { label: 'مسودة', color: 'bg-gray-100 text-gray-700' },
    paused: { label: 'مؤقف', color: 'bg-yellow-100 text-yellow-700' },
  };

  return (
    <div className="bg-[var(--bg-card)] rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow cursor-pointer group">
      <div className="flex items-start justify-between mb-4 flex-row-reverse">
        <div className="text-right flex-1">
          <h3 className="text-lg font-semibold text-gray-900 group-hover:text-[#8B5CF6] transition-colors">
            {name}
          </h3>
          <div className="flex gap-2 mt-2 flex-row-reverse">
            <span className="text-xs font-medium px-2 py-1 bg-[rgba(139,92,246,0.08)] text-[#8B5CF6] rounded">
              {typeLabels[type]}
            </span>
            <span className={`text-xs font-medium px-2 py-1 rounded ${statusConfig[status].color}`}>
              {statusConfig[status].label}
            </span>
          </div>
        </div>
        <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
          <MoreVertical size={18} className="text-gray-400" />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 py-4 border-t border-b border-gray-100">
        <div className="text-right">
          <div className="flex items-center gap-2 justify-end mb-1">
            <Users size={16} className="text-[#8B5CF6]" />
            <span className="text-xs text-gray-600">جهات محتملة</span>
          </div>
          <div className="text-lg font-bold text-gray-900">{leadsCount}</div>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-2 justify-end mb-1">
            <TrendingUp size={16} className="text-green-600" />
            <span className="text-xs text-gray-600">معدل الرد</span>
          </div>
          <div className="text-lg font-bold text-gray-900">{responseRate}%</div>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-2 justify-end mb-1">
            <Clock size={16} className="text-purple-600" />
            <span className="text-xs text-gray-600">رسالة</span>
          </div>
          <div className="text-lg font-bold text-gray-900">{messagesCount}</div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between flex-row-reverse">
        <span className="text-xs text-gray-500">
          {new Date(createdAt).toLocaleDateString('ar-SA')}
        </span>
        <button className="text-sm font-medium text-[#8B5CF6] hover:text-[#7C3AED] transition-colors">
          عرض التفاصيل
        </button>
      </div>
    </div>
  );
}
