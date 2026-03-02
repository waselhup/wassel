import React from 'react';
import { Users, Zap, TrendingUp, Clock } from 'lucide-react';
import { trpc } from '@/lib/trpc';

interface ClientOverviewCardProps {
  clientId: string | null;
  clientName?: string;
}

export default function ClientOverviewCard({ clientId, clientName }: ClientOverviewCardProps) {
  // Fetch campaigns for this client
  const { data: campaigns = [] } = trpc.campaigns.list.useQuery(
    clientId ? { clientId } : undefined,
    { enabled: !!clientId }
  );

  const activeCampaigns = campaigns.filter(c => c.status === 'active').length;
  const totalLeads = campaigns.reduce((sum, c) => sum + (c.stats?.total_leads || 0), 0);
  const todaysLeads = Math.floor(Math.random() * 50); // Placeholder

  if (!clientId) {
    return (
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-6 text-right">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">اختر عميل للبدء</h3>
        <p className="text-sm text-gray-600">حدد عميل من القائمة أعلاه لعرض إحصائياته وحملاته</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      {/* Header */}
      <div className="mb-6 pb-4 border-b border-gray-200">
        <h3 className="text-2xl font-bold text-gray-900">{clientName}</h3>
        <p className="text-sm text-gray-600 mt-1">نظرة عامة على الأداء</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Active Campaigns */}
        <div className="bg-blue-50 rounded-lg p-4 text-right">
          <div className="flex items-center justify-end gap-2 mb-2">
            <span className="text-2xl font-bold text-blue-600">{activeCampaigns}</span>
            <Zap size={20} className="text-blue-600" />
          </div>
          <p className="text-xs text-gray-600">حملات نشطة</p>
        </div>

        {/* Total Leads */}
        <div className="bg-green-50 rounded-lg p-4 text-right">
          <div className="flex items-center justify-end gap-2 mb-2">
            <span className="text-2xl font-bold text-green-600">{totalLeads}</span>
            <Users size={20} className="text-green-600" />
          </div>
          <p className="text-xs text-gray-600">إجمالي العملاء</p>
        </div>

        {/* Today's Leads */}
        <div className="bg-purple-50 rounded-lg p-4 text-right">
          <div className="flex items-center justify-end gap-2 mb-2">
            <span className="text-2xl font-bold text-purple-600">{todaysLeads}</span>
            <TrendingUp size={20} className="text-purple-600" />
          </div>
          <p className="text-xs text-gray-600">اليوم</p>
        </div>

        {/* Queue Size */}
        <div className="bg-amber-50 rounded-lg p-4 text-right">
          <div className="flex items-center justify-end gap-2 mb-2">
            <span className="text-2xl font-bold text-amber-600">0</span>
            <Clock size={20} className="text-amber-600" />
          </div>
          <p className="text-xs text-gray-600">في الطابور</p>
        </div>
      </div>

      {/* Campaigns List */}
      {campaigns.length > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h4 className="font-semibold text-gray-900 mb-3">الحملات</h4>
          <div className="space-y-2">
            {campaigns.slice(0, 5).map(campaign => (
              <div
                key={campaign.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="text-right flex-1">
                  <p className="font-medium text-gray-900">{campaign.name}</p>
                  <p className="text-xs text-gray-500">
                    {campaign.stats?.total_leads || 0} عميل
                  </p>
                </div>
                <span
                  className={`px-2 py-1 text-xs font-medium rounded ${
                    campaign.status === 'active'
                      ? 'bg-green-100 text-green-800'
                      : campaign.status === 'draft'
                      ? 'bg-gray-100 text-gray-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {campaign.status === 'active'
                    ? 'نشطة'
                    : campaign.status === 'draft'
                    ? 'مسودة'
                    : 'مغلقة'}
                </span>
              </div>
            ))}
            {campaigns.length > 5 && (
              <p className="text-xs text-gray-500 pt-2">
                و {campaigns.length - 5} حملات أخرى
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
