import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft, Eye, UserPlus, MessageSquare, Clock,
  Plus, Trash2, Save, Play, Pause, Loader2,
  CheckCircle, XCircle, Lock, AlertTriangle, ChevronDown, ChevronUp,
  Users, BarChart3, Zap
} from 'lucide-react';
import { Link, useRoute, useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';

const API_BASE = import.meta.env.VITE_API_URL || 'https://wassel-alpha.vercel.app/api';

// API helper for sequence endpoints
async function seqApi(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem('supabase_access_token') || '';
  const res = await fetch(`${API_BASE}/sequence${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  return res.json();
}

// Step type config
const STEP_TYPES = {
  visit: { icon: Eye, label: 'زيارة الملف', color: 'blue', emoji: '👁️' },
  invitation: { icon: UserPlus, label: 'إرسال دعوة', color: 'green', emoji: '🤝' },
  message: { icon: MessageSquare, label: 'إرسال رسالة', color: 'purple', emoji: '💬' },
};

// Status badge config
const STATUS_CONFIG: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  waiting: { icon: Lock, color: 'text-gray-400', bg: 'bg-gray-100', label: 'بانتظار' },
  pending: { icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50', label: 'معلق' },
  in_progress: { icon: Loader2, color: 'text-blue-500', bg: 'bg-blue-50', label: 'جاري' },
  completed: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', label: 'مكتمل' },
  failed: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-50', label: 'فشل' },
  skipped: { icon: AlertTriangle, color: 'text-gray-500', bg: 'bg-gray-50', label: 'تخطي' },
};

type Step = {
  id?: string;
  step_type: string;
  name: string;
  delay_days: number;
  message_template: string;
  configuration: Record<string, any>;
};

export default function CampaignDetail() {
  // Extract campaign ID from URL
  const [, params] = useRoute('/app/campaigns/:id');
  const [location, setLocation] = useLocation();
  const campaignId = params?.id || location.split('/app/campaigns/')[1]?.split('/')[0] || '';

  const { user } = useAuth();
  const { data: campaign, isLoading: loadingCampaign } = trpc.campaigns.get.useQuery(
    { id: campaignId },
    { enabled: !!campaignId }
  );

  // Steps state
  const [steps, setSteps] = useState<Step[]>([]);
  const [saving, setSaving] = useState(false);
  const [stepsLoaded, setStepsLoaded] = useState(false);

  // Stats state
  const [stats, setStats] = useState<any>(null);
  const [prospectGrid, setProspectGrid] = useState<any[]>([]);
  const [loadingStats, setLoadingStats] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<'sequence' | 'prospects' | 'stats'>('sequence');

  // Load steps
  useEffect(() => {
    if (!campaignId) return;
    seqApi(`/campaigns/${campaignId}/steps`).then(res => {
      if (res.success && res.data) {
        setSteps(res.data.map((s: any) => ({
          id: s.id,
          step_type: s.step_type,
          name: s.name,
          delay_days: s.delay_days || 0,
          message_template: s.message_template || '',
          configuration: s.configuration || {},
        })));
      }
      setStepsLoaded(true);
    });
  }, [campaignId]);

  // Load stats + prospect grid
  const loadStats = useCallback(async () => {
    if (!campaignId) return;
    setLoadingStats(true);
    try {
      const [statsRes, gridRes] = await Promise.all([
        seqApi(`/campaigns/${campaignId}/stats`),
        seqApi(`/campaigns/${campaignId}/prospect-status`),
      ]);
      if (statsRes.success) setStats(statsRes.data);
      if (gridRes.success) setProspectGrid(gridRes.data || []);
    } catch (e) { /* silent */ }
    setLoadingStats(false);
  }, [campaignId]);

  useEffect(() => {
    if (activeTab === 'prospects' || activeTab === 'stats') {
      loadStats();
    }
  }, [activeTab, loadStats]);

  // Add step
  const addStep = (type: string) => {
    setSteps(prev => [
      ...prev,
      {
        step_type: type,
        name: STEP_TYPES[type as keyof typeof STEP_TYPES]?.label || type,
        delay_days: type === 'visit' ? 0 : 1,
        message_template: '',
        configuration: {},
      },
    ]);
  };

  // Remove step
  const removeStep = (index: number) => {
    setSteps(prev => prev.filter((_, i) => i !== index));
  };

  // Update step
  const updateStep = (index: number, updates: Partial<Step>) => {
    setSteps(prev => prev.map((s, i) => i === index ? { ...s, ...updates } : s));
  };

  // Move step
  const moveStep = (index: number, direction: 'up' | 'down') => {
    const newSteps = [...steps];
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= newSteps.length) return;
    [newSteps[index], newSteps[target]] = [newSteps[target], newSteps[index]];
    setSteps(newSteps);
  };

  // Save steps
  const saveSteps = async () => {
    setSaving(true);
    try {
      await seqApi(`/campaigns/${campaignId}/steps`, {
        method: 'POST',
        body: JSON.stringify({ steps }),
      });
    } catch (e) { /* silent */ }
    setSaving(false);
  };

  // Default template for 4-step sequence
  const loadDefaultSequence = () => {
    setSteps([
      { step_type: 'visit', name: 'زيارة الملف', delay_days: 0, message_template: '', configuration: {} },
      { step_type: 'invitation', name: 'إرسال دعوة', delay_days: 1, message_template: 'مرحباً {{firstName}}، أود التواصل معك. أرى أنك تعمل في {{company}} كـ {{jobTitle}}.', configuration: {} },
      { step_type: 'message', name: 'رسالة 1', delay_days: 2, message_template: 'شكراً لقبول الدعوة {{firstName}}! أود أن أعرض عليك كيف يمكننا مساعدتك في {{company}}.', configuration: {} },
      { step_type: 'message', name: 'رسالة 2', delay_days: 3, message_template: 'مرحباً {{firstName}}، أتمنى أن تكون بخير. هل لديك وقت لمكالمة قصيرة هذا الأسبوع؟', configuration: {} },
    ]);
  };

  if (loadingCampaign) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">جاري تحميل الحملة...</p>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <Card className="p-8 text-center max-w-md">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">الحملة غير موجودة</h2>
          <Link href="/app/campaigns">
            <Button className="mt-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              العودة للحملات
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/app/campaigns">
                <Button variant="ghost" size="sm" className="text-gray-600">
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  الحملات
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{campaign.name}</h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    campaign.status === 'active' ? 'bg-green-100 text-green-800' :
                    campaign.status === 'paused' ? 'bg-amber-100 text-amber-800' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {campaign.status === 'active' ? '🟢 نشطة' : campaign.status === 'paused' ? '⏸ موقوفة' : '📝 مسودة'}
                  </span>
                  <span className="text-xs text-gray-500">{steps.length} خطوات</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={saveSteps}
                disabled={saving}
                className="text-gray-700"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                حفظ
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-6xl mx-auto px-6 pt-4">
        <div className="flex gap-1 bg-white/60 rounded-lg p-1 w-fit">
          {[
            { key: 'sequence', label: 'التسلسل', icon: Zap },
            { key: 'prospects', label: 'العملاء المحتملين', icon: Users },
            { key: 'stats', label: 'الإحصائيات', icon: BarChart3 },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* ======= SEQUENCE TAB ======= */}
        {activeTab === 'sequence' && (
          <div className="space-y-4">
            {/* Default sequence button */}
            {steps.length === 0 && stepsLoaded && (
              <Card className="p-8 text-center bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
                <Zap className="w-12 h-12 text-blue-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">ابدأ ببناء تسلسل الأتمتة</h3>
                <p className="text-gray-600 mb-6 text-sm">أضف خطوات أو استخدم التسلسل الافتراضي (زيارة → دعوة → رسالة 1 → رسالة 2)</p>
                <Button onClick={loadDefaultSequence} className="bg-blue-600 hover:bg-blue-700 text-white">
                  <Zap className="w-4 h-4 mr-2" />
                  تحميل التسلسل الافتراضي
                </Button>
              </Card>
            )}

            {/* Steps flow */}
            {steps.map((step, index) => {
              const typeConfig = STEP_TYPES[step.step_type as keyof typeof STEP_TYPES];
              const IconComponent = typeConfig?.icon || Eye;

              return (
                <div key={index}>
                  {/* Delay connector */}
                  {index > 0 && (
                    <div className="flex items-center gap-2 py-2 px-6">
                      <div className="w-0.5 h-6 bg-gray-300 mr-4"></div>
                      <div className="flex items-center gap-2 bg-white rounded-full px-3 py-1 shadow-sm border">
                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                        <select
                          value={step.delay_days}
                          onChange={e => updateStep(index, { delay_days: parseInt(e.target.value) })}
                          className="text-xs bg-transparent border-none focus:outline-none text-gray-600 pr-4"
                        >
                          {[0,1,2,3,4,5,7,10,14].map(d => (
                            <option key={d} value={d}>
                              {d === 0 ? 'بدون تأخير' : `${d} ${d === 1 ? 'يوم' : 'أيام'}`}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Step card */}
                  <Card className="p-5 bg-white hover:shadow-md transition-shadow">
                    <div className="flex items-start gap-4">
                      {/* Step number + icon */}
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm ${
                        step.step_type === 'visit' ? 'bg-blue-500' :
                        step.step_type === 'invitation' ? 'bg-green-500' :
                        'bg-purple-500'
                      }`}>
                        <IconComponent className="w-5 h-5" />
                      </div>

                      {/* Step content */}
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-400 bg-gray-100 rounded-full w-6 h-6 flex items-center justify-center">
                              {index + 1}
                            </span>
                            <Input
                              value={step.name}
                              onChange={e => updateStep(index, { name: e.target.value })}
                              className="font-semibold text-gray-900 border-none bg-transparent p-0 h-auto text-base focus-visible:ring-0"
                              placeholder="اسم الخطوة"
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm" onClick={() => moveStep(index, 'up')} disabled={index === 0} className="h-8 w-8 p-0">
                              <ChevronUp className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => moveStep(index, 'down')} disabled={index === steps.length - 1} className="h-8 w-8 p-0">
                              <ChevronDown className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => removeStep(index)} className="h-8 w-8 p-0 text-red-500 hover:text-red-700">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        {/* Message template (for invitation and message steps) */}
                        {(step.step_type === 'invitation' || step.step_type === 'message') && (
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-xs font-medium text-gray-500">
                                {step.step_type === 'invitation' ? 'ملاحظة الدعوة (300 حرف)' : 'نص الرسالة'}
                              </label>
                              <span className={`text-xs ${
                                step.step_type === 'invitation' && (step.message_template?.length || 0) > 300
                                  ? 'text-red-500 font-semibold' : 'text-gray-400'
                              }`}>
                                {step.message_template?.length || 0}{step.step_type === 'invitation' ? '/300' : ''}
                              </span>
                            </div>
                            <textarea
                              value={step.message_template}
                              onChange={e => updateStep(index, { message_template: e.target.value })}
                              maxLength={step.step_type === 'invitation' ? 300 : undefined}
                              placeholder="اكتب رسالتك هنا..."
                              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent resize-none bg-gray-50"
                              rows={3}
                            />
                            {/* Variable chips */}
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {['firstName', 'lastName', 'company', 'jobTitle'].map(v => (
                                <button
                                  key={v}
                                  type="button"
                                  onClick={() => {
                                    const newTemplate = (step.message_template || '') + `{{${v}}}`;
                                    updateStep(index, { message_template: newTemplate });
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-xs font-medium hover:bg-blue-100 transition-colors"
                                >
                                  <Plus className="w-3 h-3" />
                                  {v}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {step.step_type === 'visit' && (
                          <p className="text-xs text-gray-500">سيتم فتح ملف LinkedIn وزيارته تلقائياً (4-7 ثوانٍ)</p>
                        )}
                      </div>
                    </div>
                  </Card>
                </div>
              );
            })}

            {/* Add step buttons */}
            <div className="flex items-center gap-2 pt-2">
              {Object.entries(STEP_TYPES).map(([type, config]) => (
                <Button
                  key={type}
                  variant="outline"
                  size="sm"
                  onClick={() => addStep(type)}
                  className="text-gray-600 hover:text-gray-900"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  {config.emoji} {config.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* ======= PROSPECTS TAB ======= */}
        {activeTab === 'prospects' && (
          <div>
            {loadingStats ? (
              <div className="text-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">جاري تحميل بيانات العملاء...</p>
              </div>
            ) : prospectGrid.length === 0 ? (
              <Card className="p-8 text-center">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">لا يوجد عملاء مسجلين</h3>
                <p className="text-gray-600 text-sm">قم بإضافة عملاء محتملين من الإضافة ثم سجلهم في هذه الحملة</p>
              </Card>
            ) : (
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50/80 border-b">
                        <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">الاسم</th>
                        {steps.map((step, i) => (
                          <th key={i} className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            {step.name || `خطوة ${i + 1}`}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {prospectGrid.map((prospect: any) => (
                        <tr key={prospect.prospectId} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-medium text-gray-900 text-sm">{prospect.name || '—'}</p>
                              <p className="text-xs text-gray-500">{prospect.company || ''}</p>
                            </div>
                          </td>
                          {steps.map((step, stepIdx) => {
                            const stepNum = stepIdx + 1;
                            const stepData = prospect.steps?.[stepNum];
                            const status = stepData?.status || 'waiting';
                            const config = STATUS_CONFIG[status] || STATUS_CONFIG.waiting;
                            const StatusIcon = config.icon;

                            return (
                              <td key={stepIdx} className="text-center px-3 py-3">
                                <div className="flex items-center justify-center" title={`${config.label}${stepData?.executedAt ? ` — ${new Date(stepData.executedAt).toLocaleString('ar')}` : ''}${stepData?.errorMessage ? ` — ${stepData.errorMessage}` : ''}`}>
                                  <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full ${config.bg}`}>
                                    <StatusIcon className={`w-4 h-4 ${config.color} ${status === 'in_progress' ? 'animate-spin' : ''}`} />
                                  </span>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* ======= STATS TAB ======= */}
        {activeTab === 'stats' && (
          <div className="space-y-6">
            {loadingStats ? (
              <div className="text-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-3" />
              </div>
            ) : !stats ? (
              <Card className="p-8 text-center">
                <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600">لا توجد بيانات إحصائية بعد</p>
              </Card>
            ) : (
              <>
                {/* Summary cards */}
                <div className="grid grid-cols-3 gap-4">
                  <Card className="p-5 bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
                    <p className="text-xs font-medium text-green-600 mb-1">مكتمل</p>
                    <p className="text-3xl font-bold text-green-700">{stats.summary?.sent || 0}</p>
                  </Card>
                  <Card className="p-5 bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
                    <p className="text-xs font-medium text-blue-600 mb-1">قيد التنفيذ</p>
                    <p className="text-3xl font-bold text-blue-700">{stats.summary?.inProgress || 0}</p>
                  </Card>
                  <Card className="p-5 bg-gradient-to-br from-red-50 to-rose-50 border-red-200">
                    <p className="text-xs font-medium text-red-600 mb-1">فشل</p>
                    <p className="text-3xl font-bold text-red-700">{stats.summary?.failed || 0}</p>
                  </Card>
                </div>

                {/* Per-step stats */}
                <Card className="p-5">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">إحصائيات كل خطوة</h3>
                  <div className="space-y-3">
                    {(stats.steps || []).map((stepStat: any) => {
                      const total = stepStat.waiting + stepStat.pending + stepStat.in_progress + stepStat.completed + stepStat.failed + stepStat.skipped;
                      const completedPct = total > 0 ? Math.round((stepStat.completed / total) * 100) : 0;

                      return (
                        <div key={stepStat.stepId} className="flex items-center gap-4">
                          <div className="w-28 text-sm font-medium text-gray-700 truncate">
                            {stepStat.stepName}
                          </div>
                          <div className="flex-1">
                            <div className="w-full bg-gray-100 rounded-full h-2.5">
                              <div className="bg-green-500 h-2.5 rounded-full transition-all" style={{ width: `${completedPct}%` }}></div>
                            </div>
                          </div>
                          <div className="w-24 text-xs text-gray-500 text-right">
                            {stepStat.completed}/{total} ({completedPct}%)
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
