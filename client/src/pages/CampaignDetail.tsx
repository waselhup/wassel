import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft, Eye, UserPlus, MessageSquare, Clock,
  Plus, Trash2, Save, Play, Pause, Loader2,
  CheckCircle, XCircle, Lock, AlertTriangle, ChevronDown, ChevronUp,
  Users, BarChart3, Zap, Link2, Reply, Calendar, TrendingUp, Target
} from 'lucide-react';
import { Link, useRoute, useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';

const API_BASE = import.meta.env.VITE_API_URL || 'https://wassel-alpha.vercel.app/api';

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// API helper for sequence endpoints
async function seqApi(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem('supabase_token') || localStorage.getItem('supabase_access_token') || '';
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
  const { t } = useTranslation();
  // Extract campaign ID from URL
  const [, params] = useRoute('/app/campaigns/:id');
  const [location, setLocation] = useLocation();
  const campaignId = params?.id || location.split('/app/campaigns/')[1]?.split('/')[0] || '';

  const { user } = useAuth();
  const utils = trpc.useUtils();
  const { data: campaign, isLoading: loadingCampaign } = trpc.campaigns.get.useQuery(
    { id: campaignId },
    { enabled: !!campaignId }
  );
  const updateStatusMutation = trpc.campaigns.updateStatus.useMutation({
    onSuccess: () => { utils.campaigns.get.invalidate({ id: campaignId }); },
  });

  const [statusUpdating, setStatusUpdating] = useState(false);
  const [cloudError, setCloudError] = useState('');
  const changeCampaignStatus = async (newStatus: string) => {
    setStatusUpdating(true);
    setCloudError('');
    try {
      // If launching or resuming → use cloud execution
      if (newStatus === 'active') {
        const token = localStorage.getItem('supabase_token') || '';

        // Check if user has a LinkedIn session (cookies stored)
        const checkRes = await fetch('/api/cloud/session-check', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        const { hasSession } = await checkRes.json();

        if (!hasSession) {
          setCloudError('يرجى فتح LinkedIn وإعادة تحميل الإضافة لمزامنة الجلسة\nPlease open LinkedIn and reload the extension to sync your session.');
          setStatusUpdating(false);
          return;
        }

        // Launch campaign in cloud
        const launchRes = await fetch(`/api/cloud/campaign/${campaignId}/launch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        });
        const launchData = await launchRes.json();

        if (!launchData.success) {
          setCloudError(launchData.error || 'Cloud launch failed');
          setStatusUpdating(false);
          return;
        }

        console.log(`[Campaign] Cloud launch: ${launchData.prospects} prospects, ${launchData.steps} steps`);
      }

      // Update UI status via TRPC
      await updateStatusMutation.mutateAsync({ id: campaignId, status: newStatus as any });
    } catch (e: any) {
      console.error('Status update failed:', e);
      setCloudError(e.message || 'Launch failed');
    }
    setStatusUpdating(false);
  };

  // Steps state
  const [steps, setSteps] = useState<Step[]>([]);
  const [saving, setSaving] = useState(false);
  const [stepsLoaded, setStepsLoaded] = useState(false);

  // Stats state
  const [stats, setStats] = useState<any>(null);
  const [prospectGrid, setProspectGrid] = useState<any[]>([]);
  const [loadingStats, setLoadingStats] = useState(false);

  // Analytics state
  const [analytics, setAnalytics] = useState<any>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<'sequence' | 'prospects' | 'stats'>('sequence');

  // Activity feed state
  const [activity, setActivity] = useState<any[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);

  // Test automation state
  const [testResult, setTestResult] = useState<any>(null);
  const [testLoading, setTestLoading] = useState(false);

  // Load recent activity from activity-log endpoint
  const loadActivity = useCallback(async () => {
    if (!campaignId) return;
    setLoadingActivity(true);
    try {
      const token = localStorage.getItem('supabase_token') || localStorage.getItem('supabase_access_token') || '';
      const res = await fetch(`${API_BASE}/activity-log?campaign_id=${campaignId}&limit=20`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        // Normalize field names: activity-log uses snake_case, map to camelCase for UI
        const logs = (data.logs || []).map((l: any) => ({
          id: l.id,
          stepType: l.action_type,
          status: l.status,
          prospectName: l.prospect_name,
          executedAt: l.executed_at || l.created_at,
        }));
        setActivity(logs);
      }
    } catch {}
    setLoadingActivity(false);
  }, [campaignId]);

  // Auto-refresh activity every 8s
  useEffect(() => {
    loadActivity();
    const interval = setInterval(loadActivity, 8000);
    return () => clearInterval(interval);
  }, [loadActivity]);

  // Test automation handler
  const testAutomation = async () => {
    setTestLoading(true);
    try {
      const token = localStorage.getItem('supabase_token') || localStorage.getItem('supabase_access_token') || '';
      const res = await fetch(`${API_BASE}/sequence/queue/active`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      setTestResult(data);
    } catch (e: any) {
      setTestResult({ error: e.message });
    }
    setTestLoading(false);
  };

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

  // Load full analytics
  const loadAnalytics = useCallback(async () => {
    if (!campaignId) return;
    setLoadingAnalytics(true);
    try {
      const res = await seqApi(`/campaigns/${campaignId}/analytics`);
      if (res.success) setAnalytics(res.data);
    } catch (e) { /* silent */ }
    setLoadingAnalytics(false);
  }, [campaignId]);

  useEffect(() => {
    if (activeTab === 'prospects') loadStats();
    if (activeTab === 'stats') loadAnalytics();
  }, [activeTab, loadStats, loadAnalytics]);

  // Mark prospect as replied
  const markReplied = async (prospectId: string) => {
    try {
      const res = await seqApi(`/prospects/${prospectId}/mark-replied`, { method: 'POST' });
      if (res.success) {
        setProspectGrid(prev => prev.map(p =>
          p.prospectId === prospectId
            ? { ...p, replied: true, repliedAt: res.repliedAt }
            : p
        ));
      }
    } catch (e) { /* silent */ }
  };

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
              {campaign.status === 'draft' && (
                <Button
                  size="sm"
                  onClick={() => changeCampaignStatus('active')}
                  disabled={statusUpdating}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {statusUpdating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Play className="w-4 h-4 mr-1" />}
                  🚀 Launch
                </Button>
              )}
              {campaign.status === 'active' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => changeCampaignStatus('paused')}
                  disabled={statusUpdating}
                  className="text-amber-600 border-amber-300"
                >
                  {statusUpdating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Pause className="w-4 h-4 mr-1" />}
                  Pause
                </Button>
              )}
              {campaign.status === 'paused' && (
                <Button
                  size="sm"
                  onClick={() => changeCampaignStatus('active')}
                  disabled={statusUpdating}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {statusUpdating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Play className="w-4 h-4 mr-1" />}
                  ▶ Resume
                </Button>
              )}
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
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  if (!confirm('Delete this campaign? This cannot be undone.')) return;
                  try {
                    const token = localStorage.getItem('supabase_token') || '';
                    const res = await fetch(`/api/sequence/campaigns/${campaignId}`, {
                      method: 'DELETE',
                      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    });
                    const data = await res.json();
                    if (data.success || data.deleted) {
                      setLocation('/app/campaigns');
                    }
                  } catch {}
                }}
                className="text-red-600 border-red-300 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                🗑
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Status Banner */}
      <div className="max-w-6xl mx-auto px-6 pt-4">
        {(() => {
          const s = campaign.status;
          const banners: Record<string, { bg: string; border: string; icon: string; color: string; title: string; desc: string }> = {
            active: { bg: 'bg-green-50', border: 'border-green-200', icon: '🟢', color: 'text-green-800', title: t('campaign.running'), desc: `${t('campaign.extensionExecuting')}. ${t('campaign.keepLinkedIn')}.` },
            paused: { bg: 'bg-amber-50', border: 'border-amber-200', icon: '⏸', color: 'text-amber-800', title: t('campaign.paused'), desc: t('campaigns.pausedDesc') },
            draft: { bg: 'bg-gray-50', border: 'border-gray-200', icon: '📝', color: 'text-gray-700', title: t('campaign.draft'), desc: t('campaigns.draftDesc') },
            completed: { bg: 'bg-blue-50', border: 'border-blue-200', icon: '✅', color: 'text-blue-800', title: t('campaign.completed'), desc: t('campaigns.completedDesc') },
          };
          const b = banners[s] || banners.draft;
          return (
            <div className={`${b.bg} ${b.border} border rounded-lg px-4 py-3 flex items-center justify-between gap-3`}>
              <div className="flex items-center gap-3">
                <span className="text-lg">{b.icon}</span>
                <div>
                  <p className={`text-sm font-semibold ${b.color}`}>{b.title}</p>
                  <p className="text-xs text-gray-500">{b.desc}</p>
                </div>
              </div>
              {s === 'draft' && (
                <Button
                  size="sm"
                  onClick={() => changeCampaignStatus('active')}
                  disabled={statusUpdating}
                  className="bg-green-600 hover:bg-green-700 text-white shrink-0"
                >
                  {statusUpdating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Play className="w-4 h-4 mr-1" />}
                  🚀 Launch Now
                </Button>
              )}
              {s === 'paused' && (
                <Button
                  size="sm"
                  onClick={() => changeCampaignStatus('active')}
                  disabled={statusUpdating}
                  className="bg-green-600 hover:bg-green-700 text-white shrink-0"
                >
                  {statusUpdating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Play className="w-4 h-4 mr-1" />}
                  ▶ Resume
                </Button>
              )}
            </div>
          );
        })()}
      </div>

      {/* Cloud error banner */}
      {cloudError && (
        <div className="max-w-6xl mx-auto px-6 pt-2">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 whitespace-pre-line">
            ⚠️ {cloudError}
          </div>
        </div>
      )}

      {/* Activity Feed + Test Automation */}
      <div className="max-w-6xl mx-auto px-6 pt-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Recent Activity */}
          <div className="lg:col-span-2">
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                  {t('campaign.recentActivity')}
                  {campaign?.status === 'active' && (
                    <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                      {t('campaign.live')}
                    </span>
                  )}
                </h3>
                <button onClick={loadActivity} className="text-xs text-gray-400 hover:text-gray-600">↻ {t('common.refresh')}</button>
              </div>
              {activity.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-400 text-sm">{t('campaign.noActivity')}</p>
                  <p className="text-gray-400 text-xs mt-1">{t('campaign.keepChrome')}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {activity.map((a: any) => {
                    const icons: Record<string, string> = { visit: '👁', invitation: '🤝', invite: '🤝', message: '💬', follow: '↩', follow_up: '↩' };
                    const labels: Record<string, string> = { visit: 'Visited', invitation: 'Invite sent to', invite: 'Invite sent to', message: 'Message sent to', follow: 'Follow-up sent to', follow_up: 'Follow-up sent to' };
                    const icon = icons[a.stepType] || '⚡';
                    const label = labels[a.stepType] || a.stepType;
                    const timeAgo = a.executedAt ? getTimeAgo(a.executedAt) : '';
                    return (
                      <div key={a.id} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-gray-50/60 hover:bg-gray-50">
                        <span className="text-base">{a.status === 'failed' ? '❌' : icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-700 truncate">
                            <span className="text-gray-500">{label}</span>{' '}
                            <span className="font-medium">{a.prospectName}</span>
                          </p>
                        </div>
                        <span className="text-xs text-gray-400 shrink-0">{timeAgo}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          {/* Test Automation */}
          {campaign?.status === 'active' && (
            <div className="lg:col-span-1">
              <Card className="p-4">
                <h3 className="text-sm font-semibold text-gray-800 mb-3">{t('campaign.automationStatus')}</h3>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={testAutomation}
                  disabled={testLoading}
                  className="w-full mb-3"
                >
                  {testLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : '🧪'}
                  {testLoading ? t('campaign.checking') : t('campaign.testAutomation')}
                </Button>
                {testResult && (
                  <div className={`text-xs rounded-lg p-3 ${
                    testResult.queue?.length > 0
                      ? 'bg-green-50 text-green-800 border border-green-200'
                      : 'bg-amber-50 text-amber-800 border border-amber-200'
                  }`}>
                    {testResult.error ? (
                      <p>❌ Error: {testResult.error}</p>
                    ) : testResult.queue?.length > 0 ? (
                      <>
                        <p className="font-semibold">{t('campaign.working')}</p>
                        <p className="mt-1">Next: {testResult.queue[0]?.step_type} for {testResult.queue[0]?.name}</p>
                        <p>{t('campaign.queue')} {testResult.queue.length} {t('campaign.actionPending')}</p>
                        <p className="mt-1 text-green-600">{t('campaign.executeSoon')}</p>
                      </>
                    ) : (
                      <>
                        <p className="font-semibold">{t('campaign.queueEmpty')}</p>
                        <p className="mt-1">{t('campaigns.possibleReasons')}:</p>
                        <ul className="list-disc ml-4 mt-0.5">
                          <li>{t('campaigns.allContacted')}</li>
                          <li>{t('campaigns.justLaunched')}</li>
                          <li>{t('campaigns.noProspects')}</li>
                        </ul>
                      </>
                    )}
                  </div>
                )}
              </Card>
            </div>
          )}
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
          <div className="space-y-3">
            {steps.length === 0 && stepsLoaded ? (
              <Card className="p-8 text-center">
                <Zap className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-gray-700 mb-1">{t('campaign.noSteps')}</h3>
                <p className="text-gray-500 text-sm">{t('campaigns.noStepsDesc')}</p>
              </Card>
            ) : (
              steps.map((s, i) => {
                const cfg = STEP_TYPES[s.step_type as keyof typeof STEP_TYPES];
                const Icon = cfg?.icon || Eye;
                return (
                  <div key={i}>
                    {i > 0 && (
                      <div className="flex items-center gap-2 py-1 pl-6">
                        <div className="w-0.5 h-5 bg-gray-200" />
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {s.delay_days === 0 ? 'No delay' : `${s.delay_days} day${s.delay_days > 1 ? 's' : ''} delay`}
                        </span>
                      </div>
                    )}
                    <Card className="p-4 bg-white">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-white shrink-0 ${
                          s.step_type === 'visit' ? 'bg-blue-500' :
                          s.step_type === 'invitation' ? 'bg-green-500' : 'bg-purple-500'
                        }`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800">{s.name}</p>
                          {s.message_template && (
                            <p className="text-xs text-gray-500 truncate mt-0.5">{s.message_template}</p>
                          )}
                          {s.step_type === 'visit' && (
                            <p className="text-xs text-gray-400 mt-0.5">Auto-visits LinkedIn profile (4-7 seconds)</p>
                          )}
                        </div>
                        <span className="text-xs text-gray-400 bg-gray-50 rounded-full px-2 py-0.5 shrink-0">
                          Step {i + 1}
                        </span>
                      </div>
                    </Card>
                  </div>
                );
              })
            )}
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
                        <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          <div className="flex items-center justify-center gap-1">
                            <Link2 className="w-3 h-3" />
                            الاتصال
                          </div>
                        </th>
                        {steps.map((step, i) => (
                          <th key={i} className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            {step.name || `خطوة ${i + 1}`}
                          </th>
                        ))}
                        <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          <div className="flex items-center justify-center gap-1">
                            <Reply className="w-3 h-3" />
                            الرد
                          </div>
                        </th>
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
                          {/* Connection status column */}
                          <td className="text-center px-3 py-3">
                            {(() => {
                              const cs = prospect.connectionStatus || 'none';
                              const lastChecked = prospect.lastCheckedAt;
                              const hoursAgo = lastChecked
                                ? Math.round((Date.now() - new Date(lastChecked).getTime()) / 3600000)
                                : null;
                              const tooltip = hoursAgo !== null
                                ? `آخر فحص: قبل ${hoursAgo} ساعة`
                                : 'لم يتم الفحص بعد';

                              if (cs === 'accepted') {
                                return (
                                  <div className="flex items-center justify-center" title={tooltip}>
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-xs font-medium">
                                      ✅ متصل
                                    </span>
                                  </div>
                                );
                              }
                              if (cs === 'withdrawn') {
                                return (
                                  <div className="flex items-center justify-center" title={tooltip}>
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-xs font-medium">
                                      ❌ منسحب
                                    </span>
                                  </div>
                                );
                              }
                              if (cs === 'pending') {
                                return (
                                  <div className="flex items-center justify-center" title={tooltip}>
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 text-xs font-medium">
                                      ⏳ معلق
                                    </span>
                                  </div>
                                );
                              }
                              return (
                                <div className="flex items-center justify-center" title="لم يتم إرسال دعوة">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-50 text-gray-400 text-xs">
                                    —
                                  </span>
                                </div>
                              );
                            })()}
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
                          {/* Reply column */}
                          <td className="text-center px-3 py-3">
                            {prospect.replied ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                                <CheckCircle className="w-3 h-3" /> رد
                              </span>
                            ) : (
                              <button
                                onClick={() => markReplied(prospect.prospectId)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-50 text-gray-500 text-xs hover:bg-green-50 hover:text-green-600 transition-colors border border-gray-200 hover:border-green-300"
                              >
                                <Reply className="w-3 h-3" /> ✓ رد
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* ======= STATS TAB — Analytics Dashboard ======= */}
        {activeTab === 'stats' && (
          <div className="space-y-6">
            {loadingAnalytics ? (
              <div className="text-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">جاري تحميل التحليلات...</p>
              </div>
            ) : !analytics ? (
              <Card className="p-8 text-center">
                <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600">لا توجد بيانات تحليلية بعد</p>
              </Card>
            ) : (
              <>
                {/* === KEY METRICS CARDS === */}
                <div className="grid grid-cols-4 gap-4">
                  <Card className="p-5 bg-gradient-to-br from-blue-50 to-sky-50 border-blue-200">
                    <div className="flex items-center gap-2 mb-1">
                      <Users className="w-4 h-4 text-blue-500" />
                      <p className="text-xs font-medium text-blue-600">العملاء المحتملين</p>
                    </div>
                    <p className="text-3xl font-bold text-blue-700">{analytics.funnel?.enrolled || 0}</p>
                  </Card>
                  <Card className="p-5 bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
                    <div className="flex items-center gap-2 mb-1">
                      <Target className="w-4 h-4 text-green-500" />
                      <p className="text-xs font-medium text-green-600">نسبة القبول</p>
                    </div>
                    <p className="text-3xl font-bold text-green-700">{analytics.rates?.acceptanceRate || '0%'}</p>
                  </Card>
                  <Card className="p-5 bg-gradient-to-br from-purple-50 to-violet-50 border-purple-200">
                    <div className="flex items-center gap-2 mb-1">
                      <Reply className="w-4 h-4 text-purple-500" />
                      <p className="text-xs font-medium text-purple-600">نسبة الرد</p>
                    </div>
                    <p className="text-3xl font-bold text-purple-700">{analytics.rates?.replyRate || '0%'}</p>
                  </Card>
                  <Card className="p-5 bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="w-4 h-4 text-amber-500" />
                      <p className="text-xs font-medium text-amber-600">أيام التشغيل</p>
                    </div>
                    <p className="text-3xl font-bold text-amber-700">{analytics.time?.daysRunning || 0}</p>
                    {analytics.time?.avgDaysToAccept > 0 && (
                      <p className="text-[10px] text-amber-500 mt-1">متوسط القبول: {analytics.time.avgDaysToAccept} يوم</p>
                    )}
                  </Card>
                </div>

                {/* === FUNNEL VISUALIZATION === */}
                <Card className="p-6">
                  <h3 className="text-sm font-semibold text-gray-700 mb-5 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    قمع التحويل
                  </h3>
                  <div className="space-y-3">
                    {(() => {
                      const f = analytics.funnel || {};
                      const maxVal = Math.max(f.enrolled || 1, 1);
                      const funnelRows = [
                        { label: 'مسجلين', value: f.enrolled || 0, pct: 100, color: 'from-blue-500 to-blue-400' },
                        { label: 'تمت الزيارة', value: f.visited || 0, pct: f.enrolled ? Math.round(((f.visited || 0) / f.enrolled) * 100) : 0, color: 'from-cyan-500 to-cyan-400' },
                        { label: 'دعوات مرسلة', value: f.invited || 0, pct: f.enrolled ? Math.round(((f.invited || 0) / f.enrolled) * 100) : 0, color: 'from-teal-500 to-teal-400' },
                        { label: 'قبلوا الدعوة', value: f.accepted || 0, pct: f.invited ? Math.round(((f.accepted || 0) / f.invited) * 100) : 0, color: 'from-green-500 to-green-400' },
                        { label: 'رسالة 1', value: f.messaged || 0, pct: f.accepted ? Math.round(((f.messaged || 0) / f.accepted) * 100) : 0, color: 'from-purple-500 to-purple-400' },
                        { label: 'رسالة 2', value: f.followedUp || 0, pct: f.messaged ? Math.round(((f.followedUp || 0) / f.messaged) * 100) : 0, color: 'from-indigo-500 to-indigo-400' },
                        { label: 'ردوا', value: f.replied || 0, pct: f.messaged ? Math.round(((f.replied || 0) / f.messaged) * 100) : 0, color: 'from-pink-500 to-rose-400' },
                      ];

                      return funnelRows.map((row, idx) => {
                        const barWidth = maxVal > 0 ? Math.max(2, Math.round((row.value / maxVal) * 100)) : 0;
                        const rateColor = row.pct >= 70 ? 'text-green-600' : row.pct >= 40 ? 'text-amber-600' : 'text-red-500';

                        return (
                          <div key={idx} className="flex items-center gap-3">
                            <div className="w-24 text-sm font-medium text-gray-600 text-right">{row.label}</div>
                            <div className="flex-1 relative">
                              <div className="w-full bg-gray-50 rounded-lg h-8 overflow-hidden">
                                <div
                                  className={`h-full rounded-lg bg-gradient-to-r ${row.color} transition-all duration-700 ease-out flex items-center justify-end pr-2`}
                                  style={{ width: `${barWidth}%` }}
                                >
                                  {barWidth > 15 && (
                                    <span className="text-white text-xs font-bold">{row.value}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="w-16 text-right">
                              <span className="text-sm font-bold text-gray-800">{row.value}</span>
                              {idx > 0 && (
                                <span className={`text-[10px] block ${rateColor}`}>({row.pct}%)</span>
                              )}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </Card>

                {/* === DAILY ACTIVITY CHART === */}
                {analytics.dailySnapshots && analytics.dailySnapshots.length > 0 && (
                  <Card className="p-6">
                    <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                      <BarChart3 className="w-4 h-4" />
                      النشاط اليومي (آخر 14 يوم)
                    </h3>
                    <div className="flex items-end gap-1 h-40">
                      {analytics.dailySnapshots.map((snap: any, idx: number) => {
                        const maxSnap = Math.max(...analytics.dailySnapshots.map((s: any) => Math.max(s.invites_sent || 0, s.accepted || 0, s.messages_sent || 0, 1)));
                        const inviteH = maxSnap > 0 ? ((snap.invites_sent || 0) / maxSnap) * 100 : 0;
                        const acceptH = maxSnap > 0 ? ((snap.accepted || 0) / maxSnap) * 100 : 0;
                        const msgH = maxSnap > 0 ? ((snap.messages_sent || 0) / maxSnap) * 100 : 0;
                        const day = new Date(snap.snapshot_date).toLocaleDateString('ar', { day: 'numeric' });

                        return (
                          <div key={idx} className="flex-1 flex flex-col items-center gap-0.5" title={`${snap.snapshot_date}\nدعوات: ${snap.invites_sent || 0}\nقبول: ${snap.accepted || 0}\nرسائل: ${snap.messages_sent || 0}`}>
                            <div className="w-full flex gap-[1px] items-end" style={{ height: '120px' }}>
                              <div className="flex-1 bg-blue-400 rounded-t-sm transition-all" style={{ height: `${Math.max(inviteH, 2)}%` }}></div>
                              <div className="flex-1 bg-green-400 rounded-t-sm transition-all" style={{ height: `${Math.max(acceptH, 2)}%` }}></div>
                              <div className="flex-1 bg-purple-400 rounded-t-sm transition-all" style={{ height: `${Math.max(msgH, 2)}%` }}></div>
                            </div>
                            <span className="text-[9px] text-gray-400">{day}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-center gap-4 mt-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-blue-400"></span> دعوات</span>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-green-400"></span> قبول</span>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-purple-400"></span> رسائل</span>
                    </div>
                  </Card>
                )}

                {/* === TIME METRICS === */}
                <Card className="p-5">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    مقاييس الوقت
                  </h3>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-gray-800">{analytics.time?.daysRunning || 0}</p>
                      <p className="text-xs text-gray-500">أيام التشغيل</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-800">{analytics.time?.avgDaysToAccept || '—'}</p>
                      <p className="text-xs text-gray-500">متوسط أيام القبول</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-800">{analytics.time?.estimatedDaysLeft ? `~${analytics.time.estimatedDaysLeft}` : '—'}</p>
                      <p className="text-xs text-gray-500">أيام حتى الإكمال</p>
                    </div>
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
