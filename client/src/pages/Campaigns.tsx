import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2, Plus, Target, Trash2, Zap } from 'lucide-react';
import { trpc } from '@/lib/trpc';

export default function Campaigns() {
  const { user } = useAuth();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'invitation_message' as const,
  });

  // Fetch campaigns
  const { data: campaigns, isLoading, refetch } = trpc.campaigns.list.useQuery();

  // Create campaign mutation
  const createCampaign = trpc.campaigns.create.useMutation({
    onSuccess: () => {
      setFormData({ name: '', description: '', type: 'invitation_message' });
      setShowCreateForm(false);
      refetch();
    },
  });

  // Delete campaign mutation
  const deleteCampaign = trpc.campaigns.delete.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    await createCampaign.mutateAsync({
      name: formData.name,
      description: formData.description || undefined,
      type: formData.type,
    });
  };

  const handleDeleteCampaign = async (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذه الحملة؟')) {
      await deleteCampaign.mutateAsync({ id });
    }
  };

  const campaignTypes = {
    invitation: 'دعوات',
    message: 'رسائل',
    invitation_message: 'دعوات + رسائل',
    visit: 'زيارات',
    email_finder: 'البحث عن البريد',
    combined: 'متقدم',
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">جاري تحميل الحملات...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Target className="w-8 h-8 text-blue-600" />
              الحملات
            </h1>
            <p className="text-gray-600 mt-1">أنشئ وأدر حملات LinkedIn الخاصة بك</p>
          </div>
          <Button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            حملة جديدة
          </Button>
        </div>

        {/* Create Form */}
        {showCreateForm && (
          <Card className="p-8 mb-8 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">إنشاء حملة جديدة</h2>
            <form onSubmit={handleCreateCampaign} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  اسم الحملة *
                </label>
                <Input
                  type="text"
                  placeholder="مثال: حملة البحث عن عملاء تقنيين"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  الوصف (اختياري)
                </label>
                <textarea
                  placeholder="أضف وصفاً لحملتك..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  نوع الحملة *
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {Object.entries(campaignTypes).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-4">
                <Button
                  type="submit"
                  disabled={createCampaign.isPending || !formData.name.trim()}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center gap-2"
                >
                  {createCampaign.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      جاري الإنشاء...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      إنشاء الحملة
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateForm(false)}
                  className="text-gray-700"
                >
                  إلغاء
                </Button>
              </div>
            </form>
          </Card>
        )}

        {/* Campaigns List */}
        {campaigns && campaigns.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {campaigns.map((campaign) => (
              <Card key={campaign.id} className="p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{campaign.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {campaignTypes[campaign.type as keyof typeof campaignTypes] || campaign.type}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    campaign.status === 'active'
                      ? 'bg-green-100 text-green-800'
                      : campaign.status === 'draft'
                      ? 'bg-gray-100 text-gray-800'
                      : campaign.status === 'paused'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {campaign.status === 'active' ? 'نشطة' : campaign.status === 'draft' ? 'مسودة' : campaign.status === 'paused' ? 'موقوفة' : campaign.status}
                  </span>
                </div>

                {campaign.description && (
                  <p className="text-gray-600 text-sm mb-4">{campaign.description}</p>
                )}

                <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-xs text-gray-500">العملاء المحتملين</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {campaign.stats?.total_leads || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">المكتملة</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {campaign.stats?.completed || 0}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 text-gray-700"
                    onClick={() => {
                      // Navigate to campaign details
                      window.location.href = `/app/campaigns/${campaign.id}`;
                    }}
                  >
                    عرض التفاصيل
                  </Button>
                  <Button
                    variant="outline"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => handleDeleteCampaign(campaign.id)}
                    disabled={deleteCampaign.isPending}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <Target className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">لا توجد حملات حتى الآن</h3>
            <p className="text-gray-600 mb-6">
              ابدأ بإنشاء حملتك الأولى لتبدأ رحلتك مع وصل
            </p>
            <Button
              onClick={() => setShowCreateForm(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center gap-2 mx-auto"
            >
              <Plus className="w-4 h-4" />
              إنشاء حملة جديدة
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
