import React, { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { SkeletonQueueItem } from '@/components/SkeletonLoader';
import { ChevronDown, Check, X, Edit2, MessageSquare, Zap, CheckSquare, Square } from 'lucide-react';
import { trpc } from '@/lib/trpc';

export default function Queue() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'new' | 'approved'>('new');

  // Fetch queue items with filter
  const { data: items = [], isLoading, refetch } = trpc.queue.list.useQuery({ status: filter });

  // Auto-refresh every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 5000);
    return () => clearInterval(interval);
  }, [refetch]);

  // Mutations
  const approveMutation = trpc.queue.approve.useMutation({
    onSuccess: () => refetch(),
  });

  const rejectMutation = trpc.queue.reject.useMutation({
    onSuccess: () => refetch(),
  });

  const bulkApproveMutation = trpc.queue.bulkApprove.useMutation({
    onSuccess: () => {
      setSelectedIds(new Set());
      refetch();
    },
  });

  const bulkRejectMutation = trpc.queue.bulkReject.useMutation({
    onSuccess: () => {
      setSelectedIds(new Set());
      refetch();
    },
  });

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+A or Ctrl+A: Select all
      if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        e.preventDefault();
        const allIds = new Set(items.map((item) => item.id));
        setSelectedIds(allIds);
      }
      // Delete key: Reject selected
      if (e.key === 'Delete' && selectedIds.size > 0) {
        e.preventDefault();
        handleBulkReject();
      }
      // Enter key: Approve selected
      if (e.key === 'Enter' && selectedIds.size > 0 && !expandedId) {
        e.preventDefault();
        handleBulkApprove();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, items, expandedId]);

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkApprove = () => {
    if (selectedIds.size === 0) return;
    bulkApproveMutation.mutate({ itemIds: Array.from(selectedIds) });
  };

  const handleBulkReject = () => {
    if (selectedIds.size === 0) return;
    bulkRejectMutation.mutate({ itemIds: Array.from(selectedIds) });
  };

  const handleApprove = (id: string) => {
    approveMutation.mutate({ itemId: id });
    setShowSuccess(id);
    setTimeout(() => setShowSuccess(null), 2000);
    setTimeout(() => setExpandedId(null), 300);
  };

  const handleReject = (id: string) => {
    rejectMutation.mutate({ itemId: id });
    setExpandedId(null);
  };

  const pendingItems = items.filter(item => item.status === 'pending');
  const approvedCount = items.filter(item => item.status === 'ready').length;
  const rejectedCount = items.filter(item => item.status === 'skipped').length;

  const typeConfig = {
    invitation: { label: 'دعوة', icon: '📧', color: 'bg-blue-50 border-blue-200' },
    message: { label: 'رسالة', icon: '💬', color: 'bg-purple-50 border-purple-200' },
  };

  const getCampaignName = (item: any) => {
    if (item.campaigns && Array.isArray(item.campaigns) && item.campaigns.length > 0) {
      return item.campaigns[0].name || `الحملة #${item.campaign_id?.slice(0, 8)}`;
    }
    return `الحملة #${item.campaign_id?.slice(0, 8)}`;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6" dir="rtl">
        {/* Header */}
        <div className="text-right">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">قائمة الانتظار</h1>
          <p className="text-gray-600">اختر متعدد + Enter = موافقة سريعة | Delete = رفض سريع</p>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            الكل ({items.length})
          </button>
          <button
            onClick={() => setFilter('new')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'new'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            جديد ({pendingItems.length})
          </button>
          <button
            onClick={() => setFilter('approved')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'approved'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            موافق عليه ({approvedCount})
          </button>
        </div>

        {/* Bulk Actions */}
        {selectedIds.size > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
            <div className="text-right">
              <p className="font-semibold text-gray-900">{selectedIds.size} محدد</p>
              <p className="text-sm text-gray-600">Enter = موافقة | Delete = رفض</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleBulkReject}
                disabled={bulkRejectMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 font-medium"
              >
                رفض الكل ({selectedIds.size})
              </button>
              <button
                onClick={handleBulkApprove}
                disabled={bulkApproveMutation.isPending}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
              >
                موافقة على الكل ({selectedIds.size})
              </button>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4 text-right">
            <div className="text-gray-600 text-sm font-medium mb-2">في الانتظار</div>
            <div className="text-3xl font-bold text-amber-600">{pendingItems.length}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4 text-right">
            <div className="text-gray-600 text-sm font-medium mb-2">موافق عليه</div>
            <div className="text-3xl font-bold text-green-600">{approvedCount}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4 text-right">
            <div className="text-gray-600 text-sm font-medium mb-2">مرفوض</div>
            <div className="text-3xl font-bold text-red-600">{rejectedCount}</div>
          </div>
        </div>

        {/* Queue Items */}
        <div className="space-y-2">
          {isLoading ? (
            <>
              <SkeletonQueueItem />
              <SkeletonQueueItem />
              <SkeletonQueueItem />
            </>
          ) : items.length > 0 ? (
            items.map((item) => (
              <div
                key={item.id}
                className={`border-2 rounded-lg overflow-hidden transition-all bg-blue-50 border-blue-200 ${selectedIds.has(item.id) ? 'ring-2 ring-blue-500' : ''}`}
              >
                <button
                  onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                  className="w-full p-4 flex items-center justify-between flex-row-reverse hover:opacity-90 transition-opacity"
                >
                  <div className="flex items-center gap-3 flex-row-reverse flex-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelect(item.id);
                      }}
                      className="p-1 hover:bg-black hover:bg-opacity-10 rounded"
                    >
                      {selectedIds.has(item.id) ? (
                        <CheckSquare size={20} className="text-blue-600" />
                      ) : (
                        <Square size={20} className="text-gray-400" />
                      )}
                    </button>

                    <div className="text-right flex-1">
                      <div className="flex items-center gap-2 justify-end mb-1">
                        <h3 className="font-semibold text-gray-900">#{item.id?.slice(0, 8)}</h3>
                      </div>
                      <div className="flex items-center gap-2 justify-end text-sm">
                        <span className="text-gray-600">{getCampaignName(item)}</span>
                        <span className="px-2 py-0.5 bg-white text-gray-700 rounded text-xs">
                          {item.status === 'pending' ? 'جديد' : item.status === 'ready' ? 'موافق' : 'مرفوض'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <ChevronDown
                    size={20}
                    className={`text-gray-600 transition-transform ${
                      expandedId === item.id ? 'transform rotate-180' : ''
                    }`}
                  />
                </button>

                {/* Expanded Actions */}
                {expandedId === item.id && (
                  <div className="border-t-2 border-current px-4 py-4 bg-white bg-opacity-50 flex gap-2 justify-end">
                    <button
                      onClick={() => handleReject(item.id)}
                      disabled={rejectMutation.isPending}
                      className="px-3 py-2 border-2 border-red-300 text-red-700 rounded hover:bg-red-50 disabled:opacity-50 font-medium text-sm"
                    >
                      <X size={16} className="inline mr-1" />
                      تخطي
                    </button>
                    <button
                      onClick={() => handleApprove(item.id)}
                      disabled={approveMutation.isPending}
                      className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 font-medium text-sm"
                    >
                      <Check size={16} className="inline ml-1" />
                      موافقة
                    </button>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="bg-green-50 rounded-lg border border-green-200 p-12 text-center">
              <MessageSquare size={40} className="mx-auto text-green-300 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">✨ قائمة الانتظار فارغة</h3>
              <p className="text-gray-600">ممتاز! لا توجد عناصر في هذا الفلتر</p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
