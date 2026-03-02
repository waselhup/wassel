import React, { useState } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { SkeletonTable } from '@/components/SkeletonLoader';
import { Search, Download, MoreVertical, Plus } from 'lucide-react';
import { trpc } from '@/lib/trpc';

export default function Leads() {
  const [filterStatus, setFilterStatus] = useState<'all' | 'new' | 'contacted' | 'responded'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  // Fetch leads
  const { data: leads = [], isLoading } = trpc.leads.list.useQuery({});

  const statusConfig = {
    new: { label: 'جديد', color: 'bg-blue-100 text-blue-700', description: 'لم يتم التواصل بعد' },
    contacted: { label: 'تم التواصل', color: 'bg-yellow-100 text-yellow-700', description: 'في انتظار الرد' },
    responded: { label: 'رد', color: 'bg-green-100 text-green-700', description: 'استجاب للتواصل' },
  };

  const filteredLeads = leads.filter(lead => {
    const matchesStatus = filterStatus === 'all' || lead.status === filterStatus;
    const matchesSearch = lead.name.includes(searchTerm) || (lead.company?.includes(searchTerm) || false);
    return matchesStatus && matchesSearch;
  });

  return (
    <DashboardLayout>
      <div className="space-y-8" dir="rtl">
        {/* Header */}
        <div className="flex items-start justify-between flex-row-reverse">
          <div className="text-right">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">الجهات المحتملة</h1>
            <p className="text-gray-600">إدارة وتتبع جميع الجهات المحتملة من حملاتك</p>
          </div>
          <div className="flex gap-2">
            <button className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors duration-200">
              <Download size={20} className="text-gray-600" />
            </button>
            <button className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors duration-200">
              <Plus size={20} className="text-gray-600" />
            </button>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="flex gap-4 items-center flex-row-reverse flex-wrap">
          <div className="flex-1 min-w-64 relative">
            <Search size={18} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="ابحث عن جهة محتملة..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-4 pr-10 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
            />
          </div>
          <div className="flex gap-2">
            {['all', 'new', 'contacted', 'responded'].map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status as any)}
                className={`px-4 py-2.5 rounded-lg font-medium transition-all duration-200 whitespace-nowrap text-sm ${
                  filterStatus === status
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {status === 'all' && 'الكل'}
                {status === 'new' && 'جديد'}
                {status === 'contacted' && 'تم التواصل'}
                {status === 'responded' && 'رد'}
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6 text-right hover:shadow-md transition-shadow duration-300">
            <div className="text-gray-600 text-sm font-medium mb-3">إجمالي الجهات</div>
            <div className="text-4xl font-bold text-gray-900 mb-2">{leads.length}</div>
            <p className="text-xs text-gray-500">عبر جميع الحملات</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6 text-right hover:shadow-md transition-shadow duration-300">
            <div className="text-gray-600 text-sm font-medium mb-3">تم التواصل</div>
            <div className="text-4xl font-bold text-yellow-600 mb-2">{leads.filter(l => l.status === 'contacted').length}</div>
            <p className="text-xs text-gray-500">في انتظار الرد</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6 text-right hover:shadow-md transition-shadow duration-300">
            <div className="text-gray-600 text-sm font-medium mb-3">الردود</div>
            <div className="text-4xl font-bold text-green-600 mb-2">{leads.filter(l => l.status === 'responded').length}</div>
            <p className="text-xs text-gray-500">استجابة إيجابية</p>
          </div>
        </div>

        {/* Leads Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300">
          {isLoading ? (
            <SkeletonTable />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900">الاسم</th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900">الشركة</th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900">المنصب</th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900">الحالة</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">الإجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((lead) => (
                    <tr key={lead.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors duration-200">
                      <td className="px-6 py-4 text-right">
                        <div className="font-medium text-gray-900">{lead.name}</div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="text-gray-600 text-sm">{lead.company || '-'}</div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="text-gray-600 text-sm">{lead.position || '-'}</div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${statusConfig[lead.status as keyof typeof statusConfig]?.color || 'bg-gray-100 text-gray-700'}`}>
                          {statusConfig[lead.status as keyof typeof statusConfig]?.label || lead.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button className="p-2 hover:bg-gray-200 rounded-lg transition-colors duration-200">
                          <MoreVertical size={18} className="text-gray-400" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!isLoading && filteredLeads.length === 0 && (
            <div className="p-16 text-center">
              <div className="mb-4 text-gray-300">
                <Search size={48} className="mx-auto" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">لا توجد جهات محتملة</h3>
              <p className="text-gray-600 mb-1">لم نجد جهات محتملة تطابق بحثك.</p>
              <p className="text-sm text-gray-500">جرب تغيير المرشحات أو ابدأ بحملة جديدة</p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
