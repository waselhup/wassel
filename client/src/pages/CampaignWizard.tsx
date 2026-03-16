import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import ClientNav from '@/components/ClientNav';
import { useAuth } from '@/contexts/AuthContext';
import Avatar from '@/components/Avatar';
import { ChevronRight, ChevronLeft, Rocket, CheckCircle, Search, Users, Loader2, Lock, Sparkles } from 'lucide-react';

// Fetch helper
async function apiFetch(path: string, token: string, options?: RequestInit) {
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, ...(options?.headers || {}) },
  });
  return res.json();
}

// ─── Variable Chips ────────────────────────────────────────
function VariableChips({ textareaRef, value, onChange }: { textareaRef: React.RefObject<HTMLTextAreaElement | null>; value: string; onChange: (v: string) => void }) {
  const vars = [
    { label: 'firstName', tag: '{{firstName}}' },
    { label: 'lastName', tag: '{{lastName}}' },
    { label: 'company', tag: '{{company}}' },
    { label: 'jobTitle', tag: '{{jobTitle}}' },
  ];
  const insert = (tag: string) => {
    const el = textareaRef.current;
    if (el) {
      const start = el.selectionStart || value.length;
      const newVal = value.slice(0, start) + tag + value.slice(start);
      onChange(newVal);
      setTimeout(() => { el.focus(); el.setSelectionRange(start + tag.length, start + tag.length); }, 50);
    } else {
      onChange(value + tag);
    }
  };
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
      {vars.map(v => (
        <button key={v.label} type="button" onClick={() => insert(v.tag)}
          style={{ background: 'rgba(124,58,237,0.15)', color: '#c4b5fd', border: '1px solid rgba(124,58,237,0.3)', borderRadius: 6, padding: '2px 8px', fontSize: 11, cursor: 'pointer' }}>
          + {v.label}
        </button>
      ))}
    </div>
  );
}

// ─── Progress Bar ──────────────────────────────────────────
const STEPS = ['Setup', 'Sequence', 'Prospects', 'Launch'];
function ProgressBar({ current }: { current: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 32 }}>
      {STEPS.map((s, i) => (
        <div key={s} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700,
              background: i < current ? '#22c55e' : i === current ? 'linear-gradient(135deg,#7c3aed,#ec4899)' : 'rgba(255,255,255,0.06)',
              color: i <= current ? '#fff' : '#475569', border: i === current ? '2px solid #a855f7' : '2px solid transparent',
            }}>
              {i < current ? '✓' : i + 1}
            </div>
            <span style={{ fontSize: 13, fontWeight: i === current ? 700 : 400, color: i <= current ? '#f1f5f9' : '#475569' }}>{s}</span>
          </div>
          {i < STEPS.length - 1 && <div style={{ flex: 1, height: 2, background: i < current ? '#22c55e' : 'rgba(255,255,255,0.08)', marginLeft: 12, marginRight: 4, minWidth: 20 }} />}
        </div>
      ))}
    </div>
  );
}

// ─── Step Toggle Card ──────────────────────────────────────
type StepKey = 'visit' | 'invite' | 'message' | 'follow';

const STEP_DEFS: { key: StepKey; emoji: string; label: string; desc: string; locked?: boolean; bgColor: string }[] = [
  { key: 'visit', emoji: '👁', label: 'Visit', desc: 'View profile', locked: true, bgColor: 'rgba(59,130,246,0.12)' },
  { key: 'invite', emoji: '🤝', label: 'Invite', desc: 'Connect request', bgColor: 'rgba(34,197,94,0.12)' },
  { key: 'message', emoji: '💬', label: 'Msg 1', desc: 'First message', bgColor: 'rgba(124,58,237,0.12)' },
  { key: 'follow', emoji: '↩️', label: 'Follow Up', desc: 'Follow-up msg', bgColor: 'rgba(236,72,153,0.12)' },
];

function getCampaignTypeLabel(enabled: Record<StepKey, boolean>): string {
  const count = Object.values(enabled).filter(Boolean).length;
  if (count <= 1) return 'Visit Only';
  if (count === 2) return 'Visit + Invite';
  if (count === 3) return 'Visit + Invite + Message';
  return 'Full Sequence';
}

// ─── Main Wizard ───────────────────────────────────────────
export default function CampaignWizard() {
  const [, navigate] = useLocation();
  const { accessToken } = useAuth();
  const token = accessToken || localStorage.getItem('supabase_token') || '';

  const [step, setStep] = useState(0);
  const [launching, setLaunching] = useState(false);
  const [launched, setLaunchedData] = useState<{ id: string; name: string; count: number } | null>(null);
  const [error, setError] = useState('');

  // Step 1 state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [enabledSteps, setEnabledSteps] = useState<Record<StepKey, boolean>>({
    visit: true, invite: true, message: true, follow: true,
  });

  // Step 2 state
  const [inviteDelay, setInviteDelay] = useState(0);
  const [inviteNote, setInviteNote] = useState('');
  const [msg1Delay, setMsg1Delay] = useState(1);
  const [msg1, setMsg1] = useState('');
  const [followDelay, setFollowDelay] = useState(3);
  const [followUp, setFollowUp] = useState('');
  const inviteRef = useRef<HTMLTextAreaElement>(null);
  const msg1Ref = useRef<HTMLTextAreaElement>(null);
  const followRef = useRef<HTMLTextAreaElement>(null);

  // AI Writer state
  const [aiTarget, setAiTarget] = useState<'invite' | 'message' | 'follow_up' | null>(null);
  const [aiGoal, setAiGoal] = useState('');
  const [aiTone, setAiTone] = useState('professional');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState('');

  const generateAI = async (stepType: string) => {
    setAiLoading(true);
    setAiResult('');
    try {
      const res = await apiFetch('/api/ai/generate-message', token, {
        method: 'POST',
        body: JSON.stringify({ stepType, goal: aiGoal || 'LinkedIn outreach', tone: aiTone }),
      });
      setAiResult(res.message || 'AI generation failed. Check your API key.');
    } catch (e: any) {
      setAiResult('Error: ' + (e.message || 'Unknown'));
    } finally {
      setAiLoading(false);
    }
  };

  const useAiResult = (setter: (v: string) => void) => {
    setter(aiResult);
    setAiTarget(null);
    setAiResult('');
    setAiGoal('');
  };

  // Step 3 state
  const [prospects, setProspects] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [loadingProspects, setLoadingProspects] = useState(false);

  // Load prospects when reaching step 3
  useEffect(() => {
    if (step === 2 && prospects.length === 0) {
      setLoadingProspects(true);
      apiFetch('/api/ext/prospects', token)
        .then(data => {
          const list = data.data || data.prospects || data || [];
          if (Array.isArray(list)) {
            setProspects(list);
            setSelected(new Set(list.map((p: any) => p.id)));
          }
        })
        .catch(() => {})
        .finally(() => setLoadingProspects(false));
    }
  }, [step]);

  const filteredProspects = prospects.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (p.name || '').toLowerCase().includes(q) || (p.title || '').toLowerCase().includes(q) || (p.company || '').toLowerCase().includes(q);
  });

  const toggleSelect = (id: string) => {
    const n = new Set(selected);
    n.has(id) ? n.delete(id) : n.add(id);
    setSelected(n);
  };
  const toggleAll = () => {
    if (selected.size === filteredProspects.length) setSelected(new Set());
    else setSelected(new Set(filteredProspects.map(p => p.id)));
  };

  // Toggle a step on/off (with sequential enforcement)
  const toggleStep = (key: StepKey) => {
    if (key === 'visit') return; // locked
    const order: StepKey[] = ['visit', 'invite', 'message', 'follow'];
    const idx = order.indexOf(key);

    if (enabledSteps[key]) {
      // Turning OFF → also disable all subsequent
      const updated = { ...enabledSteps };
      for (let i = idx; i < order.length; i++) updated[order[i]] = false;
      updated.visit = true; // always on
      setEnabledSteps(updated);
    } else {
      // Turning ON → check that previous step is enabled
      const prev = order[idx - 1];
      if (!enabledSteps[prev]) return; // can't enable without previous
      setEnabledSteps({ ...enabledSteps, [key]: true });
    }
  };

  const canToggle = (key: StepKey): boolean => {
    if (key === 'visit') return false;
    const order: StepKey[] = ['visit', 'invite', 'message', 'follow'];
    const idx = order.indexOf(key);
    if (!enabledSteps[key]) {
      // For turning on: previous must be enabled
      return enabledSteps[order[idx - 1]];
    }
    return true; // can always turn off
  };

  // Validation
  const canNext = () => {
    if (step === 0) return name.trim().length >= 3;
    if (step === 1) {
      // Message fields only required if those steps are enabled
      if (enabledSteps.message && msg1.trim().length === 0) return false;
      if (enabledSteps.follow && followUp.trim().length === 0) return false;
      return true;
    }
    if (step === 2) return selected.size > 0;
    return true;
  };

  // Preview variables
  const previewMsg = (template: string) => {
    const sample = prospects.find(p => selected.has(p.id)) || prospects[0] || {};
    const parts = (sample.name || 'Prospect').split(' ');
    return template
      .replace(/\{\{firstName\}\}/g, parts[0] || '')
      .replace(/\{\{lastName\}\}/g, parts.slice(1).join(' ') || '')
      .replace(/\{\{company\}\}/g, sample.company || 'Company')
      .replace(/\{\{jobTitle\}\}/g, sample.title || 'Title');
  };

  // Count enabled steps
  const activeStepCount = Object.values(enabledSteps).filter(Boolean).length;

  // LAUNCH
  const launch = async () => {
    setLaunching(true);
    setError('');
    try {
      // 1. Create campaign
      const campType = activeStepCount <= 1 ? 'visit_only' : activeStepCount === 2 ? 'invitation' : 'invitation_message';
      const campRes = await apiFetch('/api/trpc/campaigns.create', token, {
        method: 'POST',
        body: JSON.stringify({ json: { name, description, type: campType } }),
      });
      const campaignId = campRes?.result?.data?.json?.id || campRes?.result?.data?.id;
      if (!campaignId) throw new Error(campRes?.error?.message || 'Failed to create campaign');

      // 2. Create only enabled steps
      const stepsPayload: any[] = [];
      if (enabledSteps.visit) stepsPayload.push({ step_type: 'visit', name: 'Visit Profile', delay_days: 0, configuration: {} });
      if (enabledSteps.invite) stepsPayload.push({ step_type: 'invitation', name: 'Send Invite', message_template: inviteNote || null, delay_days: inviteDelay, configuration: {} });
      if (enabledSteps.message) stepsPayload.push({ step_type: 'message', name: 'First Message', message_template: msg1, delay_days: msg1Delay, configuration: {} });
      if (enabledSteps.follow) stepsPayload.push({ step_type: 'follow', name: 'Follow Up', message_template: followUp, delay_days: followDelay, configuration: {} });

      const stepsRes = await apiFetch(`/api/sequence/campaigns/${campaignId}/steps`, token, {
        method: 'POST',
        body: JSON.stringify({ steps: stepsPayload }),
      });
      if (stepsRes.error) throw new Error(stepsRes.error);

      // 3. Enroll prospects
      const enrollRes = await apiFetch(`/api/sequence/campaigns/${campaignId}/enroll`, token, {
        method: 'POST',
        body: JSON.stringify({ prospect_ids: Array.from(selected) }),
      });
      if (enrollRes.error) throw new Error(enrollRes.error);

      // 4. Set campaign status to ACTIVE
      const activateRes = await apiFetch('/api/trpc/campaigns.updateStatus', token, {
        method: 'POST',
        body: JSON.stringify({ json: { id: campaignId, status: 'active' } }),
      });
      console.log('[Wizard] Campaign activated:', activateRes);

      setLaunchedData({ id: campaignId, name, count: selected.size });
    } catch (e: any) {
      setError(e.message || 'Launch failed');
    } finally {
      setLaunching(false);
    }
  };

  // ─── Styles ──────────────────────────────────────────────
  const card: React.CSSProperties = { background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 20, marginBottom: 16 };
  const input: React.CSSProperties = { width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#f1f5f9', fontSize: 14, outline: 'none' };
  const textarea: React.CSSProperties = { ...input, minHeight: 80, resize: 'vertical', fontFamily: 'inherit' };
  const btnPrimary: React.CSSProperties = { background: 'linear-gradient(135deg,#7c3aed,#ec4899)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 };
  const btnSecondary: React.CSSProperties = { background: 'rgba(255,255,255,0.06)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 };
  const label: React.CSSProperties = { display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 6, fontWeight: 500 };
  const delaySelect: React.CSSProperties = { ...input, width: 70, padding: '6px 8px', fontSize: 13, appearance: 'auto' as any };

  // ─────────── SUCCESS SCREEN ──────────────────────────────
  if (launched) {
    const enabledLabels: string[] = [];
    if (enabledSteps.visit) enabledLabels.push('👁 Visit ' + launched.count + ' profiles');
    if (enabledSteps.invite) enabledLabels.push('🤝 Send connection requests');
    if (enabledSteps.message) enabledLabels.push('💬 Send personalized messages');
    if (enabledSteps.follow) enabledLabels.push('↩️ Follow up automatically');

    return (
      <div className="flex min-h-screen" style={{ background: 'var(--bg-base)' }}>
        <ClientNav />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8 flex items-center justify-center">
          <div style={{ ...card, maxWidth: 480, textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: '#f1f5f9', fontFamily: "'Syne', sans-serif", marginBottom: 8 }}>Campaign Launched!</h2>
            <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 24 }}>
              <strong style={{ color: '#f1f5f9' }}>"{launched.name}"</strong> is now running.
            </p>
            <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 10, padding: 16, marginBottom: 24, textAlign: 'left' }}>
              <p style={{ color: '#86efac', fontSize: 13, marginBottom: 8 }}>Wassel will automatically:</p>
              <ul style={{ color: '#94a3b8', fontSize: 13, listStyle: 'none', padding: 0 }}>
                {enabledLabels.map((l, i) => <li key={i} style={{ marginBottom: 4 }}>{l}</li>)}
              </ul>
            </div>
            <button style={btnPrimary} onClick={() => navigate(`/app/campaigns/${launched.id}`)}>
              View Campaign <ChevronRight size={16} />
            </button>
          </div>
        </main>
      </div>
    );
  }

  // ─────────── WIZARD ──────────────────────────────────────
  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <ClientNav />
      <main className="flex-1 overflow-y-auto p-6 lg:p-8" style={{ maxHeight: '100vh' }}>
        <div style={{ maxWidth: 700 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: '#f1f5f9', fontFamily: "'Syne', sans-serif", marginBottom: 4 }}>Create Campaign</h2>
          <p style={{ color: '#64748b', fontSize: 13, marginBottom: 24 }}>Build your outreach sequence in 4 simple steps.</p>
          <ProgressBar current={step} />

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: 12, marginBottom: 16, color: '#fca5a5', fontSize: 13 }}>
              {error}
            </div>
          )}

          {/* ── STEP 1: Setup + Step Toggles ── */}
          {step === 0 && (
            <div>
              <div style={card}>
                <h3 style={{ color: '#f1f5f9', fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Campaign Setup</h3>
                <div style={{ marginBottom: 16 }}>
                  <label style={label}>Campaign Name *</label>
                  <input style={input} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Q2 Recruiter Outreach" />
                  {name.length > 0 && name.length < 3 && <p style={{ color: '#f87171', fontSize: 11, marginTop: 4 }}>Name must be at least 3 characters</p>}
                </div>
                <div>
                  <label style={label}>Description (optional)</label>
                  <textarea style={textarea} value={description} onChange={e => setDescription(e.target.value)} placeholder="What is this campaign about?" rows={3} />
                </div>
              </div>

              {/* Step Toggles */}
              <div style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ color: '#f1f5f9', fontSize: 16, fontWeight: 700 }}>Choose Sequence Steps</h3>
                  <span style={{
                    background: 'linear-gradient(135deg,rgba(124,58,237,0.2),rgba(236,72,153,0.2))',
                    color: '#c4b5fd', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                    border: '1px solid rgba(124,58,237,0.3)',
                  }}>
                    {getCampaignTypeLabel(enabledSteps)}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                  {STEP_DEFS.map(sd => {
                    const on = enabledSteps[sd.key];
                    const canClick = sd.locked ? false : canToggle(sd.key);
                    const tooltip = sd.locked
                      ? 'Visit is always required'
                      : !on && !canClick
                        ? `Enable ${STEP_DEFS[STEP_DEFS.findIndex(s => s.key === sd.key) - 1]?.label} first`
                        : undefined;

                    return (
                      <button
                        key={sd.key}
                        type="button"
                        title={tooltip}
                        onClick={() => !sd.locked && canClick && toggleStep(sd.key)}
                        style={{
                          background: on ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.01)',
                          border: on ? '1px solid rgba(124,58,237,0.4)' : '1px solid rgba(255,255,255,0.06)',
                          borderRadius: 10,
                          padding: '14px 8px',
                          textAlign: 'center',
                          cursor: sd.locked ? 'default' : canClick ? 'pointer' : 'not-allowed',
                          opacity: on ? 1 : 0.4,
                          transition: 'all 0.2s',
                        }}
                      >
                        <div style={{ fontSize: 22, marginBottom: 6, filter: on ? 'none' : 'grayscale(1)' }}>{sd.emoji}</div>
                        <div style={{ color: on ? '#f1f5f9' : '#475569', fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{sd.label}</div>
                        <div style={{ color: '#64748b', fontSize: 10, marginBottom: 8 }}>{sd.desc}</div>
                        {sd.locked ? (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: 'rgba(34,197,94,0.15)', color: '#86efac', borderRadius: 6, padding: '2px 8px', fontSize: 10, fontWeight: 600 }}>
                            <Lock size={9} /> ON
                          </div>
                        ) : (
                          <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: 3,
                            background: on ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.04)',
                            color: on ? '#86efac' : '#475569',
                            borderRadius: 6, padding: '2px 8px', fontSize: 10, fontWeight: 600,
                          }}>
                            {on ? '✓ ON' : 'OFF'}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 2: Sequence (only enabled steps) ── */}
          {step === 1 && (
            <div>
              {/* Visit Profile — always shown */}
              <div style={card}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(59,130,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>👁</div>
                  <div>
                    <h4 style={{ color: '#f1f5f9', fontSize: 14, fontWeight: 600 }}>Visit Profile</h4>
                    <p style={{ color: '#64748b', fontSize: 11 }}>Automatically visits the prospect's LinkedIn profile</p>
                  </div>
                </div>
                <p style={{ color: '#475569', fontSize: 12 }}>Delay: 0 days (immediate)</p>
              </div>

              {/* Invite */}
              {enabledSteps.invite && (
                <>
                  <div style={{ textAlign: 'center', color: '#475569', fontSize: 12, margin: '4px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    Wait <select value={inviteDelay} onChange={e => setInviteDelay(+e.target.value)} style={delaySelect}>{[0,1,2,3].map(d => <option key={d} value={d}>{d}</option>)}</select> days ↓
                  </div>
                  <div style={card}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(34,197,94,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🤝</div>
                      <div>
                        <h4 style={{ color: '#f1f5f9', fontSize: 14, fontWeight: 600 }}>Send Invite</h4>
                        <p style={{ color: '#64748b', fontSize: 11 }}>Connection request with optional note</p>
                      </div>
                    </div>
                    <label style={label}>Connection Note (optional, max 300)</label>
                    <textarea ref={inviteRef} style={textarea} value={inviteNote} onChange={e => setInviteNote(e.target.value.slice(0, 300))} placeholder="Add a personal note to your connection request..." rows={3} maxLength={300} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <VariableChips textareaRef={inviteRef} value={inviteNote} onChange={setInviteNote} />
                      <span style={{ color: '#475569', fontSize: 11 }}>{inviteNote.length}/300</span>
                    </div>
                    {/* AI Writer */}
                    {aiTarget !== 'invite' ? (
                      <button type="button" onClick={() => { setAiTarget('invite'); setAiResult(''); }}
                        style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, background: 'linear-gradient(135deg,rgba(124,58,237,0.12),rgba(236,72,153,0.12))', border: '1px solid rgba(124,58,237,0.25)', borderRadius: 8, padding: '8px 14px', color: '#c4b5fd', fontSize: 13, fontWeight: 600, cursor: 'pointer', width: '100%', justifyContent: 'center' }}>
                        <Sparkles size={14} /> ✨ Write with Wassel AI
                      </button>
                    ) : (
                      <div style={{ marginTop: 10, background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 10, padding: 14 }}>
                        <div style={{ marginBottom: 10 }}>
                          <label style={label}>What's your goal?</label>
                          <input style={input} value={aiGoal} onChange={e => setAiGoal(e.target.value)} placeholder="e.g. Connect with recruiters in tech" />
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                          {(['professional','friendly','direct','arabic'] as const).map(t => (
                            <button key={t} type="button" onClick={() => setAiTone(t)}
                              style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: aiTone === t ? '2px solid #a855f7' : '1px solid rgba(255,255,255,0.1)', background: aiTone === t ? 'rgba(168,85,247,0.15)' : 'rgba(255,255,255,0.04)', color: aiTone === t ? '#c4b5fd' : '#94a3b8' }}>
                              {t === 'professional' ? '💼 Professional' : t === 'friendly' ? '😊 Friendly' : t === 'direct' ? '🎯 Direct' : '🌍 Arabic'}
                            </button>
                          ))}
                        </div>
                        <button type="button" onClick={() => generateAI('invite')} disabled={aiLoading}
                          style={{ ...btnPrimary, width: '100%', justifyContent: 'center', opacity: aiLoading ? 0.7 : 1 }}>
                          {aiLoading ? <><Loader2 size={14} className="animate-spin" /> Generating...</> : <><Sparkles size={14} /> Generate</>}
                        </button>
                        {aiResult && (
                          <div style={{ marginTop: 10, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, padding: 12 }}>
                            <p style={{ color: '#e2e8f0', fontSize: 13, whiteSpace: 'pre-wrap', marginBottom: 10 }}>{aiResult}</p>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button type="button" onClick={() => useAiResult(setInviteNote)} style={{ ...btnPrimary, fontSize: 12, padding: '6px 14px' }}>✓ Use This</button>
                              <button type="button" onClick={() => generateAI('invite')} style={{ ...btnSecondary, fontSize: 12, padding: '6px 14px' }}>↻ Regenerate</button>
                              <button type="button" onClick={() => setAiTarget(null)} style={{ ...btnSecondary, fontSize: 12, padding: '6px 14px' }}>✕ Close</button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Message 1 */}
              {enabledSteps.message && (
                <>
                  <div style={{ textAlign: 'center', color: '#475569', fontSize: 12, margin: '4px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    Wait <select value={msg1Delay} onChange={e => setMsg1Delay(+e.target.value)} style={delaySelect}>{[0,1,2,3,4,5,6,7].map(d => <option key={d} value={d}>{d}</option>)}</select> days after acceptance ↓
                  </div>
                  <div style={card}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(124,58,237,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>💬</div>
                      <div>
                        <h4 style={{ color: '#f1f5f9', fontSize: 14, fontWeight: 600 }}>First Message</h4>
                        <p style={{ color: '#64748b', fontSize: 11 }}>Sent after connection is accepted</p>
                      </div>
                    </div>
                    <label style={label}>Message * (max 500)</label>
                    <textarea ref={msg1Ref} style={{ ...textarea, borderColor: msg1.length === 0 ? 'rgba(239,68,68,0.3)' : undefined }} value={msg1} onChange={e => setMsg1(e.target.value.slice(0, 500))} placeholder="Hi {{firstName}}, I noticed you work at {{company}}..." rows={4} maxLength={500} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <VariableChips textareaRef={msg1Ref} value={msg1} onChange={setMsg1} />
                      <span style={{ color: '#475569', fontSize: 11 }}>{msg1.length}/500</span>
                    </div>
                    {/* AI Writer */}
                    {aiTarget !== 'message' ? (
                      <button type="button" onClick={() => { setAiTarget('message'); setAiResult(''); }}
                        style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, background: 'linear-gradient(135deg,rgba(124,58,237,0.12),rgba(236,72,153,0.12))', border: '1px solid rgba(124,58,237,0.25)', borderRadius: 8, padding: '8px 14px', color: '#c4b5fd', fontSize: 13, fontWeight: 600, cursor: 'pointer', width: '100%', justifyContent: 'center' }}>
                        <Sparkles size={14} /> ✨ Write with Wassel AI
                      </button>
                    ) : (
                      <div style={{ marginTop: 10, background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 10, padding: 14 }}>
                        <div style={{ marginBottom: 10 }}>
                          <label style={label}>What's your goal?</label>
                          <input style={input} value={aiGoal} onChange={e => setAiGoal(e.target.value)} placeholder="e.g. Pitch our consulting services" />
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                          {(['professional','friendly','direct','arabic'] as const).map(t => (
                            <button key={t} type="button" onClick={() => setAiTone(t)}
                              style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: aiTone === t ? '2px solid #a855f7' : '1px solid rgba(255,255,255,0.1)', background: aiTone === t ? 'rgba(168,85,247,0.15)' : 'rgba(255,255,255,0.04)', color: aiTone === t ? '#c4b5fd' : '#94a3b8' }}>
                              {t === 'professional' ? '💼 Professional' : t === 'friendly' ? '😊 Friendly' : t === 'direct' ? '🎯 Direct' : '🌍 Arabic'}
                            </button>
                          ))}
                        </div>
                        <button type="button" onClick={() => generateAI('message')} disabled={aiLoading}
                          style={{ ...btnPrimary, width: '100%', justifyContent: 'center', opacity: aiLoading ? 0.7 : 1 }}>
                          {aiLoading ? <><Loader2 size={14} className="animate-spin" /> Generating...</> : <><Sparkles size={14} /> Generate</>}
                        </button>
                        {aiResult && (
                          <div style={{ marginTop: 10, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, padding: 12 }}>
                            <p style={{ color: '#e2e8f0', fontSize: 13, whiteSpace: 'pre-wrap', marginBottom: 10 }}>{aiResult}</p>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button type="button" onClick={() => useAiResult(setMsg1)} style={{ ...btnPrimary, fontSize: 12, padding: '6px 14px' }}>✓ Use This</button>
                              <button type="button" onClick={() => generateAI('message')} style={{ ...btnSecondary, fontSize: 12, padding: '6px 14px' }}>↻ Regenerate</button>
                              <button type="button" onClick={() => setAiTarget(null)} style={{ ...btnSecondary, fontSize: 12, padding: '6px 14px' }}>✕ Close</button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Follow Up */}
              {enabledSteps.follow && (
                <>
                  <div style={{ textAlign: 'center', color: '#475569', fontSize: 12, margin: '4px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    Wait <select value={followDelay} onChange={e => setFollowDelay(+e.target.value)} style={delaySelect}>{[1,2,3,4,5,6,7,8,9,10,11,12,13,14].map(d => <option key={d} value={d}>{d}</option>)}</select> days ↓
                  </div>
                  <div style={card}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(236,72,153,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>↩️</div>
                      <div>
                        <h4 style={{ color: '#f1f5f9', fontSize: 14, fontWeight: 600 }}>Follow Up Message</h4>
                        <p style={{ color: '#64748b', fontSize: 11 }}>Sent if no reply to the first message</p>
                      </div>
                    </div>
                    <label style={label}>Message * (max 500)</label>
                    <textarea ref={followRef} style={{ ...textarea, borderColor: followUp.length === 0 ? 'rgba(239,68,68,0.3)' : undefined }} value={followUp} onChange={e => setFollowUp(e.target.value.slice(0, 500))} placeholder="Hi {{firstName}}, just following up on my previous message..." rows={4} maxLength={500} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <VariableChips textareaRef={followRef} value={followUp} onChange={setFollowUp} />
                      <span style={{ color: '#475569', fontSize: 11 }}>{followUp.length}/500</span>
                    </div>
                    {/* AI Writer */}
                    {aiTarget !== 'follow_up' ? (
                      <button type="button" onClick={() => { setAiTarget('follow_up'); setAiResult(''); }}
                        style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, background: 'linear-gradient(135deg,rgba(124,58,237,0.12),rgba(236,72,153,0.12))', border: '1px solid rgba(124,58,237,0.25)', borderRadius: 8, padding: '8px 14px', color: '#c4b5fd', fontSize: 13, fontWeight: 600, cursor: 'pointer', width: '100%', justifyContent: 'center' }}>
                        <Sparkles size={14} /> ✨ Write with Wassel AI
                      </button>
                    ) : (
                      <div style={{ marginTop: 10, background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 10, padding: 14 }}>
                        <div style={{ marginBottom: 10 }}>
                          <label style={label}>What's your goal?</label>
                          <input style={input} value={aiGoal} onChange={e => setAiGoal(e.target.value)} placeholder="e.g. Re-engage after no reply" />
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                          {(['professional','friendly','direct','arabic'] as const).map(t => (
                            <button key={t} type="button" onClick={() => setAiTone(t)}
                              style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: aiTone === t ? '2px solid #a855f7' : '1px solid rgba(255,255,255,0.1)', background: aiTone === t ? 'rgba(168,85,247,0.15)' : 'rgba(255,255,255,0.04)', color: aiTone === t ? '#c4b5fd' : '#94a3b8' }}>
                              {t === 'professional' ? '💼 Professional' : t === 'friendly' ? '😊 Friendly' : t === 'direct' ? '🎯 Direct' : '🌍 Arabic'}
                            </button>
                          ))}
                        </div>
                        <button type="button" onClick={() => generateAI('follow_up')} disabled={aiLoading}
                          style={{ ...btnPrimary, width: '100%', justifyContent: 'center', opacity: aiLoading ? 0.7 : 1 }}>
                          {aiLoading ? <><Loader2 size={14} className="animate-spin" /> Generating...</> : <><Sparkles size={14} /> Generate</>}
                        </button>
                        {aiResult && (
                          <div style={{ marginTop: 10, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, padding: 12 }}>
                            <p style={{ color: '#e2e8f0', fontSize: 13, whiteSpace: 'pre-wrap', marginBottom: 10 }}>{aiResult}</p>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button type="button" onClick={() => useAiResult(setFollowUp)} style={{ ...btnPrimary, fontSize: 12, padding: '6px 14px' }}>✓ Use This</button>
                              <button type="button" onClick={() => generateAI('follow_up')} style={{ ...btnSecondary, fontSize: 12, padding: '6px 14px' }}>↻ Regenerate</button>
                              <button type="button" onClick={() => setAiTarget(null)} style={{ ...btnSecondary, fontSize: 12, padding: '6px 14px' }}>✕ Close</button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* When only Visit is selected */}
              {!enabledSteps.invite && !enabledSteps.message && !enabledSteps.follow && (
                <div style={{ ...card, textAlign: 'center', color: '#64748b', fontSize: 13 }}>
                  This campaign will only visit profiles. No messages will be sent.
                </div>
              )}
            </div>
          )}

          {/* ── STEP 3: Prospects ── */}
          {step === 2 && (
            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ color: '#f1f5f9', fontSize: 16, fontWeight: 700 }}>Select Prospects</h3>
                <span style={{ background: 'rgba(124,58,237,0.15)', color: '#c4b5fd', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{selected.size} selected</span>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: '#475569' }} />
                  <input style={{ ...input, paddingLeft: 30 }} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, title, or company..." />
                </div>
                <button onClick={toggleAll} style={{ ...btnSecondary, padding: '8px 12px', fontSize: 12 }}>
                  {selected.size === filteredProspects.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              {loadingProspects ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}><Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} />Loading prospects...</div>
              ) : prospects.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <Users size={32} style={{ color: '#475569', margin: '0 auto 12px' }} />
                  <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 12 }}>No prospects imported yet.</p>
                  <button style={btnPrimary} onClick={() => navigate('/app/extension')}>Go import prospects →</button>
                </div>
              ) : (
                <div style={{ maxHeight: 340, overflowY: 'auto', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left', color: '#64748b', fontWeight: 500, width: 36 }}>☑</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', color: '#64748b', fontWeight: 500 }}>Name</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', color: '#64748b', fontWeight: 500 }}>Title</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', color: '#64748b', fontWeight: 500 }}>Company</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProspects.map(p => (
                        <tr key={p.id} onClick={() => toggleSelect(p.id)} style={{ cursor: 'pointer', borderTop: '1px solid rgba(255,255,255,0.04)', background: selected.has(p.id) ? 'rgba(124,58,237,0.06)' : 'transparent' }}>
                          <td style={{ padding: '8px 12px' }}><input type="checkbox" checked={selected.has(p.id)} readOnly style={{ accentColor: '#7c3aed' }} /></td>
                          <td style={{ padding: '8px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <Avatar name={p.name || '?'} size="sm" />
                              <span style={{ color: '#f1f5f9', fontWeight: 500 }}>{p.name || '—'}</span>
                            </div>
                          </td>
                          <td style={{ padding: '8px 12px', color: '#94a3b8' }}>{p.title || '—'}</td>
                          <td style={{ padding: '8px 12px', color: '#94a3b8' }}>{p.company || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 4: Review & Launch ── */}
          {step === 3 && (
            <div>
              <div style={card}>
                <h3 style={{ color: '#f1f5f9', fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Review & Launch</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
                  <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 14, textAlign: 'center' }}>
                    <div style={{ color: '#64748b', fontSize: 11, marginBottom: 4 }}>Campaign</div>
                    <div style={{ color: '#f1f5f9', fontSize: 14, fontWeight: 600 }}>{name}</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 14, textAlign: 'center' }}>
                    <div style={{ color: '#64748b', fontSize: 11, marginBottom: 4 }}>Sequence</div>
                    <div style={{ color: '#f1f5f9', fontSize: 14, fontWeight: 600 }}>{activeStepCount} step{activeStepCount > 1 ? 's' : ''}</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 14, textAlign: 'center' }}>
                    <div style={{ color: '#64748b', fontSize: 11, marginBottom: 4 }}>Prospects</div>
                    <div style={{ color: '#f1f5f9', fontSize: 14, fontWeight: 600 }}>{selected.size} selected</div>
                  </div>
                </div>

                <h4 style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Sequence Preview</h4>
                <div style={{ borderLeft: '2px solid rgba(124,58,237,0.3)', paddingLeft: 16 }}>
                  {enabledSteps.visit && (
                    <div style={{ marginBottom: 14 }}><span style={{ color: '#64748b', fontSize: 11 }}>Day 0</span><br /><span style={{ color: '#f1f5f9', fontSize: 13 }}>👁 Visit Profile</span></div>
                  )}
                  {enabledSteps.invite && (
                    <div style={{ marginBottom: 14 }}><span style={{ color: '#64748b', fontSize: 11 }}>Day {inviteDelay}</span><br /><span style={{ color: '#f1f5f9', fontSize: 13 }}>🤝 Send Invite {inviteNote ? `— "${inviteNote.slice(0, 50)}${inviteNote.length > 50 ? '...' : ''}"` : ''}</span></div>
                  )}
                  {enabledSteps.message && (
                    <div style={{ marginBottom: 14 }}><span style={{ color: '#64748b', fontSize: 11 }}>+{msg1Delay}d after accepted</span><br /><span style={{ color: '#f1f5f9', fontSize: 13 }}>💬 "{msg1.slice(0, 60)}{msg1.length > 60 ? '...' : ''}"</span></div>
                  )}
                  {enabledSteps.follow && (
                    <div><span style={{ color: '#64748b', fontSize: 11 }}>+{followDelay}d later</span><br /><span style={{ color: '#f1f5f9', fontSize: 13 }}>↩️ "{followUp.slice(0, 60)}{followUp.length > 60 ? '...' : ''}"</span></div>
                  )}
                </div>
              </div>

              {/* Variable preview */}
              {prospects.length > 0 && enabledSteps.message && (
                <div style={{ ...card, background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.2)' }}>
                  <h4 style={{ color: '#c4b5fd', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>📝 Message Preview (using first prospect)</h4>
                  <p style={{ color: '#94a3b8', fontSize: 13, fontStyle: 'italic' }}>"{previewMsg(msg1).slice(0, 120)}{previewMsg(msg1).length > 120 ? '...' : ''}"</p>
                </div>
              )}
            </div>
          )}

          {/* ── Navigation ── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
            {step > 0 ? (
              <button style={btnSecondary} onClick={() => { setStep(step - 1); setError(''); }}>
                <ChevronLeft size={16} /> Back
              </button>
            ) : <div />}

            {step < 3 ? (
              <button style={{ ...btnPrimary, opacity: canNext() ? 1 : 0.5 }} disabled={!canNext()} onClick={() => { setError(''); setStep(step + 1); }}>
                Next <ChevronRight size={16} />
              </button>
            ) : (
              <button style={{ ...btnPrimary, opacity: launching ? 0.6 : 1 }} disabled={launching} onClick={launch}>
                {launching ? <><Loader2 size={16} className="animate-spin" /> Launching...</> : <><Rocket size={16} /> Launch Campaign</>}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
