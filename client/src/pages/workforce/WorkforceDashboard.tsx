import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check, X, Edit3, Sparkles, Users, AlertTriangle, BarChart3,
  FileEdit, RefreshCw, Send, Wallet, Activity, Megaphone, Calculator,
  ShieldCheck, HeartHandshake, TrendingUp, Microscope, LayoutDashboard,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';

const CARD: React.CSSProperties = {
  background: '#fff', borderRadius: 14,
  border: '1px solid var(--border-subtle, #E5E7EB)',
  padding: 20,
  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
};

const SECTION_TITLE: React.CSSProperties = {
  fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
  fontWeight: 900, fontSize: 18, color: 'var(--wsl-ink, #0F172A)',
  margin: 0, display: 'flex', alignItems: 'center', gap: 8,
};

const ICON_BY_NAME: Record<string, any> = {
  Megaphone, HeartHandshake, Microscope, ShieldCheck,
  TrendingUp, Activity, Calculator, LayoutDashboard,
};

interface Agent {
  id: string; name_ar: string; name_en: string; role_ar: string; role_en: string;
  portal: string; approval_mode: string; argue_mode_enabled: boolean;
  monthly_token_budget: number; is_active: boolean;
  avatar_color: string; avatar_icon: string;
  tokens_this_month: number; cost_sar_this_month: number;
  pending_tasks: number; completed_this_month: number; over_budget: boolean;
}

interface Task {
  id: string; agent_id: string; task_type: string; title: string;
  payload: any; preview: any; status: string; priority: string;
  scheduled_for: string | null;
  estimated_money_cost_sar: number | null; expected_impact: string | null;
  created_at: string;
}

export default function WorkforceDashboard() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const tr = (ar: string, en: string) => (isAr ? ar : en);

  const [agents, setAgents] = useState<Agent[]>([]);
  const [queue, setQueue] = useState<Task[]>([]);
  const [vitals, setVitals] = useState<any | null>(null);
  const [brief, setBrief] = useState<any | null>(null);
  const [costReport, setCostReport] = useState<any | null>(null);
  const [filterAgent, setFilterAgent] = useState<string>('all');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [argueHistory, setArgueHistory] = useState<any[]>([]);
  const [argueDraft, setArgueDraft] = useState('');
  const [contextEditorOpen, setContextEditorOpen] = useState(false);
  const [contextDraft, setContextDraft] = useState('');
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [a, q, v, b, c] = await Promise.all([
        trpc.faris.listAgents(),
        trpc.faris.getApprovalQueue({ filter: 'pending', limit: 100 }),
        trpc.faris.dailyVitals(),
        trpc.faris.morningBrief(),
        trpc.faris.agentCostReport({ days: 30 }),
      ]);
      setAgents(a as any);
      setQueue((q as any).rows);
      setVitals(v);
      setBrief(b);
      setCostReport(c);
    } catch (e) {
      console.error('[workforce] refresh failed', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const openTask = useCallback(async (task: Task) => {
    setSelectedTask(task);
    setArgueHistory([]);
    const { arguments: args } = await trpc.faris.getTask({ taskId: task.id });
    setArgueHistory(args);
  }, []);

  const approve = useCallback(async (task: Task, editedPayload?: any) => {
    await trpc.faris.approveTask({ taskId: task.id, ...(editedPayload ? { editedPayload } : {}) });
    setSelectedTask(null);
    refresh();
  }, [refresh]);

  const reject = useCallback(async (task: Task, reason: string) => {
    await trpc.faris.rejectTask({ taskId: task.id, reason });
    setSelectedTask(null);
    refresh();
  }, [refresh]);

  const sendArgue = useCallback(async () => {
    if (!selectedTask || !argueDraft.trim()) return;
    const { agentReply } = await trpc.faris.replyToArgue({ taskId: selectedTask.id, message: argueDraft });
    const { arguments: args } = await trpc.faris.getTask({ taskId: selectedTask.id });
    setArgueHistory(args);
    setArgueDraft('');
    if (agentReply == null) {
      // No agent wired yet — just refresh.
    }
  }, [argueDraft, selectedTask]);

  const openContextEditor = useCallback(async () => {
    const { content } = await trpc.faris.readContextFile();
    setContextDraft(content);
    setContextEditorOpen(true);
  }, []);

  const saveContext = useCallback(async () => {
    await trpc.faris.updateContextFile({ content: contextDraft });
    setContextEditorOpen(false);
  }, [contextDraft]);

  const filteredQueue = useMemo(() => {
    if (filterAgent === 'all') return queue;
    return queue.filter((q) => q.agent_id === filterAgent);
  }, [queue, filterAgent]);

  const agentByIdMap = useMemo(() => {
    const m = new Map<string, Agent>();
    for (const a of agents) m.set(a.id, a);
    return m;
  }, [agents]);

  if (loading && !agents.length) {
    return <div style={{ padding: 24, fontFamily: '"Thmanyah Sans"' }}>{tr('جاري التحميل…', 'Loading…')}</div>;
  }

  return (
    <div className="admin-portal-page" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* MORNING BRIEF */}
      <section style={CARD}>
        <h2 style={SECTION_TITLE}>
          <Sparkles size={18} color="#8B5CF6" />
          {tr('موجز الصباح', 'Morning Brief')}
        </h2>
        {brief ? (
          <p style={{ marginTop: 12, fontSize: 14, color: '#374151', lineHeight: 1.7 }}>
            {tr(
              `أمس: ${brief.signups} تسجيل جديد، ${brief.paid} اشتراك مدفوع، إنفاق إعلاني ${brief.adSpendSar} ر.س، و ${brief.pending} مهمة بانتظار الموافقة.`,
              `Yesterday: ${brief.signups} new signups, ${brief.paid} paid, ad spend ${brief.adSpendSar} SAR, ${brief.pending} tasks awaiting approval.`,
            )}
          </p>
        ) : <p style={{ fontSize: 13, color: '#9CA3AF' }}>—</p>}
      </section>

      {/* DAILY VITALS */}
      {vitals && (
        <section>
          <h2 style={SECTION_TITLE}>
            <BarChart3 size={18} color="#0F172A" />
            {tr('المؤشرات اليومية', 'Daily Vitals')}
          </h2>
          <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
            {[
              { label: tr('تسجيلات اليوم', 'Signups today'), value: vitals.signupsToday },
              { label: tr('مدفوعات اليوم', 'Paid today'), value: vitals.paidToday },
              { label: tr('MRR ر.س', 'MRR (SAR)'), value: vitals.mrrSar },
              { label: tr('إنفاق الإعلانات', 'Ad spend'), value: vitals.adSpendSar },
              { label: tr('بانتظار الموافقة', 'Pending'), value: vitals.pendingApprovals },
              { label: tr('تكلفة AI ر.س', 'AI cost (SAR)'), value: vitals.agentTokenSpendSar },
              { label: tr('أخطاء 24س', 'Errors 24h'), value: vitals.errors24h },
              { label: tr('انسحاب الشهر', 'Churned'), value: vitals.churnedThisMonth },
            ].map((tile) => (
              <div key={tile.label} style={{ ...CARD, padding: 14, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 700 }}>{tile.label}</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#0F172A', marginTop: 4 }}>{tile.value}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* APPROVAL QUEUE + ARGUE THREAD */}
      <section className="admin-grid-2col">

        {/* QUEUE */}
        <div style={CARD}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <h2 style={SECTION_TITLE}>
              <Users size={18} color="#8B5CF6" />
              {tr('قائمة الموافقات', 'Approval Queue')} ({filteredQueue.length})
            </h2>
            <button onClick={refresh} style={chipBtnStyle()}>
              <RefreshCw size={12} /> {tr('تحديث', 'Refresh')}
            </button>
          </div>

          {/* Filter chips */}
          <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <FilterChip active={filterAgent === 'all'} onClick={() => setFilterAgent('all')}>
              {tr('الكل', 'All')}
            </FilterChip>
            {agents.map((a) => (
              <FilterChip key={a.id} active={filterAgent === a.id} color={a.avatar_color} onClick={() => setFilterAgent(a.id)}>
                {isAr ? a.name_ar : a.name_en}
              </FilterChip>
            ))}
          </div>

          {/* Task list */}
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filteredQueue.length === 0 && (
              <div style={{ padding: 24, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
                {tr('لا توجد مهام معلّقة. جربّ توليد محتوى الشهر من قسم النمو.', 'No pending tasks. Try generating monthly batch from the Growth portal.')}
              </div>
            )}
            {filteredQueue.map((task) => {
              const agent = agentByIdMap.get(task.agent_id);
              const Icon = ICON_BY_NAME[agent?.avatar_icon || 'LayoutDashboard'] || LayoutDashboard;
              return (
                <button
                  key={task.id}
                  onClick={() => openTask(task)}
                  style={{
                    textAlign: 'start', background: '#fff',
                    border: `1px solid ${selectedTask?.id === task.id ? agent?.avatar_color : 'var(--border-subtle, #E5E7EB)'}`,
                    borderRadius: 10, padding: 12, cursor: 'pointer',
                    fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: agent?.avatar_color || '#8B5CF6',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
                    }}>
                      <Icon size={14} />
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 13, color: '#0F172A', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {task.title}
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                      background: '#F3F4F6', color: '#374151',
                    }}>
                      {task.task_type}
                    </span>
                  </div>
                  {task.preview?.caption_snippet && (
                    <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.5, marginInlineStart: 38 }}>
                      {String(task.preview.caption_snippet).slice(0, 160)}
                    </div>
                  )}
                  {task.expected_impact && (
                    <div style={{ marginTop: 6, marginInlineStart: 38, fontSize: 11, color: agent?.avatar_color || '#8B5CF6', fontWeight: 700 }}>
                      {task.expected_impact}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ARGUE THREAD */}
        <div style={CARD}>
          <h2 style={SECTION_TITLE}>
            <FileEdit size={18} color="#8B5CF6" />
            {tr('المحادثة', 'Discussion')}
          </h2>
          {!selectedTask ? (
            <p style={{ marginTop: 12, fontSize: 13, color: '#9CA3AF' }}>
              {tr('اختر مهمة من القائمة لرؤية تفاصيلها وفتح نقاش مع الوكيل', 'Select a task to view detail and discuss with the agent')}
            </p>
          ) : (
            <>
              <div style={{ marginTop: 12, marginBottom: 10, padding: 10, background: '#F9FAFB', borderRadius: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#0F172A' }}>{selectedTask.title}</div>
                <pre style={{ marginTop: 8, fontSize: 11, color: '#374151', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 200, overflow: 'auto' }}>
                  {JSON.stringify(selectedTask.payload, null, 2)}
                </pre>
              </div>

              <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                <button onClick={() => approve(selectedTask)} style={primaryBtnStyle('#10B981')}>
                  <Check size={12} /> {tr('موافقة', 'Approve')}
                </button>
                <button
                  onClick={() => {
                    const reason = window.prompt(tr('سبب الرفض؟', 'Reason for rejection?') || '');
                    if (reason) reject(selectedTask, reason);
                  }}
                  style={primaryBtnStyle('#EF4444')}
                >
                  <X size={12} /> {tr('رفض', 'Reject')}
                </button>
                <button
                  onClick={() => {
                    const editedRaw = window.prompt(
                      tr('عدّل الـ payload (JSON):', 'Edit payload (JSON):') || '',
                      JSON.stringify(selectedTask.payload),
                    );
                    if (!editedRaw) return;
                    try {
                      const edited = JSON.parse(editedRaw);
                      approve(selectedTask, edited);
                    } catch {
                      alert('Invalid JSON');
                    }
                  }}
                  style={primaryBtnStyle('#F59E0B')}
                >
                  <Edit3 size={12} /> {tr('تعديل وموافقة', 'Edit & approve')}
                </button>
              </div>

              <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#6B7280', marginBottom: 8 }}>
                  {tr('حوار النقاش', 'Argue thread')}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 200, overflow: 'auto', marginBottom: 10 }}>
                  {argueHistory.length === 0 && (
                    <div style={{ fontSize: 12, color: '#9CA3AF' }}>
                      {tr('لا حوار بعد. اكتب رسالة لبدء النقاش.', 'No argument yet. Send a message to start.')}
                    </div>
                  )}
                  {argueHistory.map((m: any) => (
                    <div key={m.id} style={{
                      padding: 8, borderRadius: 8,
                      background: m.speaker === 'ali' ? '#EFF6FF' : '#F5F3FF',
                      borderInlineStart: `3px solid ${m.speaker === 'ali' ? '#3B82F6' : '#8B5CF6'}`,
                    }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: m.speaker === 'ali' ? '#1E40AF' : '#5B21B6', marginBottom: 4 }}>
                        {m.speaker === 'ali' ? tr('علي', 'Ali') : tr('الوكيل', 'Agent')}
                      </div>
                      <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.6 }}>{m.message}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    value={argueDraft}
                    onChange={(e) => setArgueDraft(e.target.value)}
                    placeholder={tr('اكتب تعليقك للوكيل…', 'Type a note to the agent…')}
                    style={{
                      flex: 1, padding: '8px 10px', fontSize: 12,
                      border: '1px solid #E5E7EB', borderRadius: 8,
                      fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                    }}
                  />
                  <button onClick={sendArgue} style={primaryBtnStyle('#8B5CF6')}>
                    <Send size={12} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {/* AGENT ROSTER */}
      <section style={CARD}>
        <h2 style={SECTION_TITLE}>
          <Users size={18} color="#8B5CF6" />
          {tr('فريق الوكلاء', 'Agent Roster')} (8)
        </h2>
        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {agents.map((a) => {
            const Icon = ICON_BY_NAME[a.avatar_icon] || LayoutDashboard;
            const pct = a.monthly_token_budget > 0 ? Math.min(100, (a.tokens_this_month / a.monthly_token_budget) * 100) : 0;
            return (
              <div key={a.id} style={{
                background: '#fff', borderRadius: 10,
                border: `1px solid ${a.over_budget ? '#FCA5A5' : 'var(--border-subtle, #E5E7EB)'}`,
                padding: 14,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: '50%',
                    background: a.avatar_color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
                  }}>
                    <Icon size={16} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 900, fontSize: 14, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {isAr ? a.name_ar : a.name_en}
                    </div>
                    <div style={{ fontSize: 11, color: '#6B7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {isAr ? a.role_ar : a.role_en}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 999,
                    background: a.is_active ? '#D1FAE5' : '#FEE2E2',
                    color: a.is_active ? '#047857' : '#B91C1C',
                  }}>
                    {a.is_active ? tr('نشط', 'Active') : tr('متوقف', 'Paused')}
                  </span>
                </div>

                <div style={{ marginTop: 12, fontSize: 11, color: '#374151', lineHeight: 1.7 }}>
                  <div>{tr('مهام معلّقة', 'Pending')}: <strong>{a.pending_tasks}</strong></div>
                  <div>{tr('مكتملة الشهر', 'Done this month')}: <strong>{a.completed_this_month}</strong></div>
                  <div>{tr('تكلفة الشهر', 'Cost this month')}: <strong>{a.cost_sar_this_month} ر.س</strong></div>
                </div>

                <div style={{ marginTop: 10 }}>
                  <div style={{ height: 6, background: '#F3F4F6', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: a.over_budget ? '#EF4444' : a.avatar_color }} />
                  </div>
                  <div style={{ marginTop: 4, fontSize: 10, color: '#6B7280' }}>
                    {Math.round(pct)}% {tr('من ميزانية الـ tokens', 'of token budget')}
                  </div>
                </div>

                <div style={{ marginTop: 10 }}>
                  <select
                    value={a.approval_mode}
                    onChange={async (e) => {
                      await trpc.faris.toggleAgentMode({ agentId: a.id, mode: e.target.value as any });
                      refresh();
                    }}
                    style={{
                      width: '100%', padding: '6px 8px', fontSize: 11,
                      border: '1px solid #E5E7EB', borderRadius: 6,
                      fontFamily: '"Thmanyah Sans", system-ui, sans-serif', cursor: 'pointer',
                    }}
                  >
                    <option value="approval_required">{tr('يتطلب موافقة', 'Approval required')}</option>
                    <option value="suggest_only">{tr('اقتراح فقط', 'Suggest only')}</option>
                    <option value="auto_with_bounds">{tr('تلقائي ضمن حدود', 'Auto with bounds')}</option>
                    <option value="auto">{tr('تلقائي', 'Fully auto')}</option>
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* COST REPORT */}
      {costReport && (
        <section style={CARD}>
          <h2 style={SECTION_TITLE}>
            <AlertTriangle size={18} color="#EF4444" />
            {tr('تقرير التكاليف (آخر 30 يوم)', 'Cost Report (last 30 days)')}
          </h2>
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'baseline', gap: 16 }}>
            <div>
              <div style={{ fontSize: 10, color: '#6B7280' }}>{tr('الإجمالي', 'Total')}</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#0F172A' }}>{costReport.totalCostSar} ر.س</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#6B7280' }}>USD</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#374151' }}>${costReport.totalCostUsd}</div>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            {costReport.breakdown.map((b: any) => {
              const agent = agentByIdMap.get(b.agentId);
              const max = Math.max(...costReport.breakdown.map((x: any) => x.costSar), 1);
              const pct = (b.costSar / max) * 100;
              return (
                <div key={b.agentId} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, color: '#0F172A' }}>{agent ? (isAr ? agent.name_ar : agent.name_en) : b.agentId}</span>
                    <span style={{ color: '#374151' }}>{b.costSar} ر.س · {b.tokens.toLocaleString()} tokens · {b.calls} calls</span>
                  </div>
                  <div style={{ height: 8, background: '#F3F4F6', borderRadius: 999 }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: agent?.avatar_color || '#8B5CF6', borderRadius: 999 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* BRAIN FILE EDITOR */}
      <section style={CARD}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={SECTION_TITLE}>
            <Wallet size={18} color="#8B5CF6" />
            {tr('ملف دماغ الوكلاء (wassel_context.md)', 'Agent Brain File (wassel_context.md)')}
          </h2>
          <button onClick={openContextEditor} style={primaryBtnStyle('#8B5CF6')}>
            <Edit3 size={12} /> {tr('فتح المحرّر', 'Open editor')}
          </button>
        </div>
        <p style={{ marginTop: 8, fontSize: 12, color: '#6B7280' }}>
          {tr('الملف المرجعي الذي يقرأه كل وكيل قبل توليد المحتوى. عدّله لتغيير دماغ الـ 8 وكلاء فوراً.',
              'The reference file every agent reads before generating content. Edit it to change all 8 agents\' brain instantly.')}
        </p>
      </section>

      <AnimatePresence>
        {contextEditorOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100,
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
            }}
            onClick={() => setContextEditorOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: '#fff', borderRadius: 14, padding: 20,
                width: '95%', maxWidth: 900, maxHeight: '90vh', display: 'flex', flexDirection: 'column', gap: 12,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontWeight: 900, color: '#0F172A' }}>
                  {tr('تعديل دماغ الوكلاء', 'Edit Agent Brain')}
                </h3>
                <button onClick={() => setContextEditorOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                  <X size={18} />
                </button>
              </div>
              <textarea
                value={contextDraft}
                onChange={(e) => setContextDraft(e.target.value)}
                style={{
                  flex: 1, minHeight: 400, padding: 12,
                  fontFamily: '"JetBrains Mono", monospace', fontSize: 12,
                  border: '1px solid #E5E7EB', borderRadius: 8, resize: 'vertical',
                }}
              />
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <button onClick={() => setContextEditorOpen(false)} style={chipBtnStyle()}>
                  {tr('إلغاء', 'Cancel')}
                </button>
                <button onClick={saveContext} style={primaryBtnStyle('#8B5CF6')}>
                  <Check size={12} /> {tr('حفظ', 'Save')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FilterChip({ children, active, onClick, color }: { children: any; active: boolean; onClick: () => void; color?: string }) {
  const bg = active ? (color || '#8B5CF6') : '#fff';
  const fg = active ? '#fff' : '#374151';
  return (
    <button
      onClick={onClick}
      style={{
        background: bg, color: fg, padding: '4px 10px',
        border: `1px solid ${active ? bg : '#E5E7EB'}`, borderRadius: 999,
        fontSize: 11, fontWeight: 700, cursor: 'pointer',
        fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
      }}
    >
      {children}
    </button>
  );
}

function chipBtnStyle(): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: '#fff', color: '#374151',
    border: '1px solid #E5E7EB', borderRadius: 8,
    padding: '6px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
    fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
  };
}

function primaryBtnStyle(color: string): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: color, color: '#fff',
    border: 'none', borderRadius: 8,
    padding: '6px 12px', fontSize: 11, fontWeight: 800, cursor: 'pointer',
    fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
  };
}
