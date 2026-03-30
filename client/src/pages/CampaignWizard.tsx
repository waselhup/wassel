import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import ClientNav from '@/components/ClientNav';
import { useAuth } from '@/contexts/AuthContext';
import Avatar from '@/components/Avatar';
import { ChevronRight, ChevronLeft, Rocket, Search, Users, Loader2, Lock, Sparkles, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { CAMPAIGN_PRESETS } from '@/data/presetData';
import CampaignMessageSurvey from '@/components/CampaignMessageSurvey';
import ExtensionRequiredModal from '@/components/ExtensionRequiredModal';

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
function ProgressBar({ current }: { current: number }) {
  const { t } = useTranslation();
  const steps = t('wizard.steps', { returnObjects: true }) as string[];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 32 }}>
      {steps.map((s, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
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
          {i < steps.length - 1 && <div style={{ flex: 1, height: 2, background: i < current ? '#22c55e' : 'rgba(255,255,255,0.08)', marginLeft: 12, marginRight: 4, minWidth: 20 }} />}
        </div>
      ))}
    </div>
  );
}

// ─── Step Toggle Card ──────────────────────────────────────
type StepKey = 'visit' | 'invite' | 'message' | 'follow';

function getStepDefs(t: any) {
  return [
    { key: 'visit' as StepKey, emoji: '👁', label: t('wizard.visitProfile'), desc: t('wizard.visitCardDesc'), bgColor: 'rgba(59,130,246,0.12)' },
    { key: 'invite' as StepKey, emoji: '🤝', label: t('wizard.sendInvite'), desc: t('wizard.inviteCardDesc'), bgColor: 'rgba(34,197,94,0.12)' },
    { key: 'message' as StepKey, emoji: '💬', label: t('wizard.firstMessage'), desc: t('wizard.sentAfterAccepted'), bgColor: 'rgba(124,58,237,0.12)' },
    { key: 'follow' as StepKey, emoji: '↩️', label: t('wizard.followUpMessage'), desc: t('wizard.sentIfNoReply'), bgColor: 'rgba(236,72,153,0.12)' },
  ];
}

function getCampaignTypeLabel(enabled: Record<StepKey, boolean>, t: any): string {
  const active = Object.entries(enabled).filter(([, v]) => v).map(([k]) => k) as StepKey[];
  if (active.length === 0) return t('wizard.selectSteps');
  if (active.length === 4) return t('wizard.fullSequence');
  const labels: Record<StepKey, string> = {
    visit: t('wizard.visitProfile'),
    invite: t('wizard.sendInvite'),
    message: t('wizard.firstMessage'),
    follow: t('wizard.followUpMessage'),
  };
  if (active.length === 1) return labels[active[0]];
  return active.map(k => labels[k]).join(' + ');
}

// ─── Main Wizard ───────────────────────────────────────────
export default function CampaignWizard() {
  const [, navigate] = useLocation();
  const { accessToken } = useAuth();
  const token = accessToken || localStorage.getItem('supabase_token') || '';
  const { t, i18n } = useTranslation();

  const [step, setStep] = useState(0);
  const [launching, setLaunching] = useState(false);
  const [showExtModal, setShowExtModal] = useState(false);
  const [launched, setLaunchedData] = useState<{ id: string; name: string; count: number } | null>(null);
  const [error, setError] = useState('');

  // Step 1 state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [enabledSteps, setEnabledSteps] = useState<Record<StepKey, boolean>>({
    visit: true, invite: true, message: true, follow: true,
  });

  // Pre-populate from preset query param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const presetId = params.get('preset');
    if (!presetId) return;
    const preset = CAMPAIGN_PRESETS.find(p => p.id === presetId);
    if (!preset) return;
    const actions = preset.wizardSteps.map(s => s.action);
    const hasVisit = actions.includes('visit');
    const hasConnect = actions.includes('connect');
    const messages = preset.wizardSteps.filter(s => s.action === 'message');
    const hasMsg = messages.length >= 1;
    const hasFollow = messages.length >= 2;
    setEnabledSteps({ visit: hasVisit, invite: hasConnect, message: hasMsg, follow: hasFollow });
    if (hasMsg && messages[0]) setMsg1Delay(messages[0].delay);
    if (hasFollow && messages[1]) setFollowDelay(messages[1].delay);
  }, []);

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

  // Templates from Messages library
  const [templates, setTemplates] = useState<any[]>([]);
  const [showTemplatePicker, setShowTemplatePicker] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      apiFetch('/api/messages', token)
        .then(data => setTemplates(data.messages || []))
        .catch(() => {});
    }
  }, [token]);

  const applyTemplate = (template: any, setter: (v: string) => void, maxLen: number) => {
    setter(template.content.substring(0, maxLen));
    setShowTemplatePicker(null);
    apiFetch(`/api/messages/${template.id}/use`, token, { method: 'POST' }).catch(() => {});
    toast.success(t('wizard.templateApplied'));
  };

  // AI Writer state
  const [aiTarget, setAiTarget] = useState<'invite' | 'message' | 'follow_up' | null>(null);
  const [aiGoal, setAiGoal] = useState('');
  const [aiTone, setAiTone] = useState('professional');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState('');

  // Campaign message survey modals
  const [showSurveyInvite, setShowSurveyInvite] = useState(false);
  const [showSurveyMsg1, setShowSurveyMsg1] = useState(false);
  const [showSurveyFollow, setShowSurveyFollow] = useState(false);

  // Shared survey generate handler
  const handleSurveyGenerate = async (
    config: { purpose: string; tone: string; context: string },
    setter: (v: string) => void,
    maxLen: number
  ) => {
    const firstSelected = prospects.find(p => selected.has(p.id)) || prospects[0] || null;
    const res = await apiFetch('/api/ai/generate-message', token, {
      method: 'POST',
      body: JSON.stringify({
        purpose: config.purpose,
        tone: config.tone,
        senderContext: config.context,
        stepType: 'message',
        language: i18n.language || 'ar',
        prospectName: firstSelected?.name || '',
        prospectTitle: firstSelected?.title || '',
        prospectCompany: firstSelected?.company || '',
      }),
    });
    const msg = res.message || res.content || '';
    if (msg) setter(msg.slice(0, maxLen));
  };

  const generateAI = async (stepType: string) => {
    setAiLoading(true);
    setAiResult('');
    // Pick first selected prospect for style detection
    const firstSelected = prospects.find(p => selected.has(p.id)) || prospects[0] || null;
    try {
      const res = await apiFetch('/api/ai/generate-message', token, {
        method: 'POST',
        body: JSON.stringify({
          stepType,
          goal: aiGoal || 'LinkedIn outreach',
          tone: aiTone,
          prospectName: firstSelected?.name || '',
          prospectTitle: firstSelected?.title || '',
          prospectCompany: firstSelected?.company || '',
        }),
      });
      setAiResult(res.message || t('wizard.aiGenerationFailed'));
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

  const toggleStep = (key: StepKey) => {
    const updated = { ...enabledSteps, [key]: !enabledSteps[key] };
    if (key === 'invite' && !updated.invite) { updated.message = false; updated.follow = false; }
    if (key === 'message' && !updated.message) { updated.follow = false; }
    if (!updated.visit && !updated.invite && !updated.message && !updated.follow) return;
    setEnabledSteps(updated);
  };

  const canToggle = (key: StepKey): boolean => {
    if (enabledSteps[key]) {
      return Object.entries(enabledSteps).filter(([k, v]) => k !== key && v).length > 0;
    }
    if (key === 'message') return enabledSteps.invite;
    if (key === 'follow') return enabledSteps.message;
    return true;
  };

  const canNext = () => {
    if (step === 0) return name.trim().length >= 3;
    if (step === 1) {
      if (enabledSteps.message && msg1.trim().length === 0) return false;
      if (enabledSteps.follow && followUp.trim().length === 0) return false;
      return true;
    }
    if (step === 2) return selected.size > 0;
    return true;
  };

  const previewMsg = (template: string) => {
    const sample = prospects.find(p => selected.has(p.id)) || prospects[0] || {};
    const parts = (sample.name || 'Prospect').split(' ');
    return template
      .replace(/\{\{firstName\}\}/g, parts[0] || '')
      .replace(/\{\{lastName\}\}/g, parts.slice(1).join(' ') || '')
      .replace(/\{\{company\}\}/g, sample.company || 'Company')
      .replace(/\{\{jobTitle\}\}/g, sample.title || 'Title');
  };

  const activeStepCount = Object.values(enabledSteps).filter(Boolean).length;
  const STEP_DEFS = getStepDefs(t);

  // LAUNCH
  const launch = async () => {
    // Check extension is installed before launching
    if (document.documentElement.getAttribute('data-wassel-extension') !== 'true') {
      setShowExtModal(true);
      return;
    }
    setLaunching(true);
    setError('');
    try {
      let campType = 'combined';
      if (enabledSteps.visit && !enabledSteps.invite && !enabledSteps.message && !enabledSteps.follow) campType = 'visit';
      else if (enabledSteps.invite && !enabledSteps.message) campType = 'invitation';
      else if (enabledSteps.invite && enabledSteps.message && !enabledSteps.follow) campType = 'invitation_message';
      else campType = 'combined';

      const campRes = await apiFetch('/api/trpc/campaigns.create', token, {
        method: 'POST',
        body: JSON.stringify({ json: { name, description, type: campType } }),
      });
      const campaignId = campRes?.result?.data?.json?.id || campRes?.result?.data?.id;
      if (!campaignId) throw new Error(campRes?.error?.message || 'Failed to create campaign');

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

      const enrollRes = await apiFetch(`/api/sequence/campaigns/${campaignId}/enroll`, token, {
        method: 'POST',
        body: JSON.stringify({ prospect_ids: Array.from(selected) }),
      });
      if (enrollRes.error) throw new Error(enrollRes.error);

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
  const lbl: React.CSSProperties = { display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 6, fontWeight: 500 };
  const delaySelect: React.CSSProperties = { ...input, width: 70, padding: '6px 8px', fontSize: 13, appearance: 'auto' as any };

  const toneLabel = (tone: string) => {
    if (tone === 'professional') return '💼 ' + t('ai.toneProfessional');
    if (tone === 'friendly') return '😊 ' + t('ai.toneFriendly');
    if (tone === 'direct') return '🎯 ' + t('ai.toneDirect');
    return '🌍 ' + t('ai.toneArabic');
  };

  const renderAIWriter = (target: 'invite' | 'message' | 'follow_up', setter: (v: string) => void) => {
    if (aiTarget !== target) {
      return (
        <button type="button" onClick={() => { setAiTarget(target); setAiResult(''); }}
          style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, background: 'linear-gradient(135deg,rgba(124,58,237,0.12),rgba(236,72,153,0.12))', border: '1px solid rgba(124,58,237,0.25)', borderRadius: 8, padding: '8px 14px', color: '#c4b5fd', fontSize: 13, fontWeight: 600, cursor: 'pointer', width: '100%', justifyContent: 'center' }}>
          <Sparkles size={14} /> {t('wizard.writeAI')}
        </button>
      );
    }
    return (
      <div style={{ marginTop: 10, background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 10, padding: 14 }}>
        <div style={{ marginBottom: 10 }}>
          <label style={lbl}>{t('wizard.aiGoal')}</label>
          <input style={input} value={aiGoal} onChange={e => setAiGoal(e.target.value)} placeholder={t('wizard.aiGoalPlaceholder')} />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {(['professional', 'friendly', 'direct', 'arabic'] as const).map(tone => (
            <button key={tone} type="button" onClick={() => setAiTone(tone)}
              style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: aiTone === tone ? '2px solid #a855f7' : '1px solid rgba(255,255,255,0.1)', background: aiTone === tone ? 'rgba(168,85,247,0.15)' : 'rgba(255,255,255,0.04)', color: aiTone === tone ? '#c4b5fd' : '#94a3b8' }}>
              {toneLabel(tone)}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => generateAI(target)} disabled={aiLoading}
          style={{ ...btnPrimary, width: '100%', justifyContent: 'center', opacity: aiLoading ? 0.7 : 1 }}>
          {aiLoading ? <><Loader2 size={14} className="animate-spin" /> {t('wizard.generating')}</> : <><Sparkles size={14} /> {t('wizard.generate')}</>}
        </button>
        {aiResult && (
          <div style={{ marginTop: 10, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, padding: 12 }}>
            <p style={{ color: '#e2e8f0', fontSize: 13, whiteSpace: 'pre-wrap', marginBottom: 10 }}>{aiResult}</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => useAiResult(setter)} style={{ ...btnPrimary, fontSize: 12, padding: '6px 14px' }}>{t('wizard.useThis')}</button>
              <button type="button" onClick={() => generateAI(target)} style={{ ...btnSecondary, fontSize: 12, padding: '6px 14px' }}>{t('wizard.regenerate')}</button>
              <button type="button" onClick={() => setAiTarget(null)} style={{ ...btnSecondary, fontSize: 12, padding: '6px 14px' }}>{t('wizard.close')}</button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ─────────── SUCCESS SCREEN ──────────────────────────────
  if (launched) {
    const enabledLabels: string[] = [];
    if (enabledSteps.visit) enabledLabels.push(t('wizard.visitProfilesAction', { count: launched.count }));
    if (enabledSteps.invite) enabledLabels.push(t('wizard.sendConnectionRequests'));
    if (enabledSteps.message) enabledLabels.push(t('wizard.sendPersonalizedMessages'));
    if (enabledSteps.follow) enabledLabels.push(t('wizard.followUpAuto'));

    return (
      <div className="flex min-h-screen" style={{ background: 'var(--bg-base)' }}>
        <ClientNav />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8 flex items-center justify-center">
          <div style={{ ...card, maxWidth: 480, textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: '#f1f5f9', fontFamily: "'Syne', sans-serif", marginBottom: 8 }}>{t('wizard.campaignLaunched')}</h2>
            <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 24 }}>
              <strong style={{ color: '#f1f5f9' }}>"{launched.name}"</strong> {t('wizard.isNowRunning')}
            </p>
            <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 10, padding: 16, marginBottom: 24, textAlign: 'left' }}>
              <p style={{ color: '#86efac', fontSize: 13, marginBottom: 8 }}>{t('wizard.willAutomatically')}</p>
              <ul style={{ color: '#94a3b8', fontSize: 13, listStyle: 'none', padding: 0 }}>
                {enabledLabels.map((l, i) => <li key={i} style={{ marginBottom: 4 }}>{l}</li>)}
              </ul>
            </div>
            <button style={btnPrimary} onClick={() => navigate(`/app/campaigns/${launched.id}`)}>
              {t('wizard.viewCampaign')} <ChevronRight size={16} />
            </button>
          </div>
        </main>
      </div>
    );
  }

  // ─────────── WIZARD ──────────────────────────────────────
  return (
    <>
    <div className="flex min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <ClientNav />
      <main className="flex-1 overflow-y-auto p-6 lg:p-8" style={{ maxHeight: '100vh' }}>
        <div style={{ maxWidth: 700 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: '#f1f5f9', fontFamily: "'Syne', sans-serif", marginBottom: 4 }}>{t('wizard.createCampaign')}</h2>
          <p style={{ color: '#64748b', fontSize: 13, marginBottom: 24 }}>{t('wizard.subtitle')}</p>
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
                <h3 style={{ color: '#f1f5f9', fontSize: 16, fontWeight: 700, marginBottom: 16 }}>{t('wizard.setupTitle')}</h3>
                <div style={{ marginBottom: 16 }}>
                  <label style={lbl}>{t('wizard.campaignName')}</label>
                  <input style={input} value={name} onChange={e => setName(e.target.value)} placeholder={t('wizard.campaignNamePlaceholder')} />
                  {name.length > 0 && name.length < 3 && <p style={{ color: '#f87171', fontSize: 11, marginTop: 4 }}>{t('wizard.campaignNameMin')}</p>}
                </div>
                <div>
                  <label style={lbl}>{t('wizard.descriptionLabel')}</label>
                  <textarea style={textarea} value={description} onChange={e => setDescription(e.target.value)} placeholder={t('wizard.descriptionPlaceholder')} rows={3} />
                </div>
              </div>

            </div>
          )}

          {/* ── STEP 2: Sequence ── */}
          {step === 1 && (
            <div>
              {/* Visit Profile */}
              <div style={card}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(59,130,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>👁</div>
                  <div>
                    <h4 style={{ color: '#f1f5f9', fontSize: 14, fontWeight: 600 }}>{t('wizard.visitProfile')}</h4>
                    <p style={{ color: '#64748b', fontSize: 11 }}>{t('wizard.visitDesc')}</p>
                  </div>
                </div>
                <p style={{ color: '#475569', fontSize: 12 }}>{t('wizard.delay')}: 0 {t('wizard.days')} ({t('wizard.immediate')})</p>
              </div>

              {/* Invite */}
              {enabledSteps.invite && (
                <>
                  <div style={{ textAlign: 'center', color: '#475569', fontSize: 12, margin: '4px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    {t('wizard.wait')} <select value={inviteDelay} onChange={e => setInviteDelay(+e.target.value)} style={delaySelect}>{[0,1,2,3].map(d => <option key={d} value={d}>{d}</option>)}</select> {t('wizard.days')} ↓
                  </div>
                  <div style={card}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(34,197,94,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🤝</div>
                      <div>
                        <h4 style={{ color: '#f1f5f9', fontSize: 14, fontWeight: 600 }}>{t('wizard.sendInvite')}</h4>
                        <p style={{ color: '#64748b', fontSize: 11 }}>{t('wizard.inviteDesc')}</p>
                      </div>
                    </div>
                    <label style={lbl}>{t('wizard.connectionNote')}</label>
                    <textarea ref={inviteRef} style={textarea} value={inviteNote} onChange={e => setInviteNote(e.target.value.slice(0, 300))} placeholder={t('wizard.notePlaceholder')} rows={3} maxLength={300} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <VariableChips textareaRef={inviteRef} value={inviteNote} onChange={setInviteNote} />
                      <span style={{ color: '#475569', fontSize: 11 }}>{inviteNote.length}/300</span>
                    </div>
                    {templates.filter(tmpl => tmpl.message_type === 'connection_note').length > 0 && (
                      <div style={{ position: 'relative', marginTop: 8 }}>
                        <button type="button" onClick={() => setShowTemplatePicker(showTemplatePicker === 'invite' ? null : 'invite')}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-subtle, rgba(255,255,255,0.08))', borderRadius: 8, padding: '6px 12px', color: '#94a3b8', fontSize: 12, cursor: 'pointer' }}>
                          <FileText size={13} /> 📋 {t('wizard.useTemplate')}
                        </button>
                        {showTemplatePicker === 'invite' && (
                          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: 'var(--bg-card, #1e293b)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: 6, zIndex: 50, maxHeight: 200, overflowY: 'auto' }}>
                            {templates.filter(tmpl => tmpl.message_type === 'connection_note').map(tmpl => (
                              <button key={tmpl.id} type="button" onClick={() => applyTemplate(tmpl, setInviteNote, 300)}
                                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 6, border: 'none', background: 'transparent', color: '#e2e8f0', fontSize: 12, cursor: 'pointer', marginBottom: 2 }}>
                                <strong>{tmpl.name}</strong>
                                <span style={{ display: 'block', color: '#64748b', fontSize: 11, marginTop: 2 }}>{tmpl.content.substring(0, 60)}...</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    <button type="button" onClick={() => setShowSurveyInvite(true)}
                      style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, background: 'linear-gradient(135deg,rgba(124,58,237,0.12),rgba(236,72,153,0.12))', border: '1px solid rgba(124,58,237,0.25)', borderRadius: 8, padding: '8px 14px', color: '#c4b5fd', fontSize: 13, fontWeight: 600, cursor: 'pointer', width: '100%', justifyContent: 'center' }}>
                      <Sparkles size={14} /> {t('wizard.writeAI')}
                    </button>
                    <CampaignMessageSurvey
                      isOpen={showSurveyInvite}
                      onClose={() => setShowSurveyInvite(false)}
                      messageType="connection_note"
                      prospectName={prospects.find(p => selected.has(p.id))?.name}
                      prospectTitle={prospects.find(p => selected.has(p.id))?.title}
                      onGenerate={async (config) => handleSurveyGenerate(config, setInviteNote, 300)}
                    />
                  </div>
                </>
              )}

              {/* Message 1 */}
              {enabledSteps.message && (
                <>
                  <div style={{ textAlign: 'center', color: '#475569', fontSize: 12, margin: '4px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    {t('wizard.wait')} <select value={msg1Delay} onChange={e => setMsg1Delay(+e.target.value)} style={delaySelect}>{[0,1,2,3,4,5,6,7].map(d => <option key={d} value={d}>{d}</option>)}</select> {t('wizard.daysAfterAcceptance')} ↓
                  </div>
                  <div style={card}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(124,58,237,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>💬</div>
                      <div>
                        <h4 style={{ color: '#f1f5f9', fontSize: 14, fontWeight: 600 }}>{t('wizard.firstMessage')}</h4>
                        <p style={{ color: '#64748b', fontSize: 11 }}>{t('wizard.sentAfterAccepted')}</p>
                      </div>
                    </div>
                    <label style={lbl}>{t('wizard.messageLabel')}</label>
                    <textarea ref={msg1Ref} style={{ ...textarea, borderColor: msg1.length === 0 ? 'rgba(239,68,68,0.3)' : undefined }} value={msg1} onChange={e => setMsg1(e.target.value.slice(0, 500))} placeholder="Hi {{firstName}}, I noticed you work at {{company}}..." rows={4} maxLength={500} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <VariableChips textareaRef={msg1Ref} value={msg1} onChange={setMsg1} />
                      <span style={{ color: '#475569', fontSize: 11 }}>{msg1.length}/500</span>
                    </div>
                    <button type="button" onClick={() => setShowSurveyMsg1(true)}
                      style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, background: 'linear-gradient(135deg,rgba(124,58,237,0.12),rgba(236,72,153,0.12))', border: '1px solid rgba(124,58,237,0.25)', borderRadius: 8, padding: '8px 14px', color: '#c4b5fd', fontSize: 13, fontWeight: 600, cursor: 'pointer', width: '100%', justifyContent: 'center' }}>
                      <Sparkles size={14} /> {t('wizard.writeAI')}
                    </button>
                    <CampaignMessageSurvey
                      isOpen={showSurveyMsg1}
                      onClose={() => setShowSurveyMsg1(false)}
                      messageType="follow_up"
                      prospectName={prospects.find(p => selected.has(p.id))?.name}
                      prospectTitle={prospects.find(p => selected.has(p.id))?.title}
                      onGenerate={async (config) => handleSurveyGenerate(config, setMsg1, 500)}
                    />
                  </div>
                </>
              )}

              {/* Follow Up */}
              {enabledSteps.follow && (
                <>
                  <div style={{ textAlign: 'center', color: '#475569', fontSize: 12, margin: '4px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    {t('wizard.wait')} <select value={followDelay} onChange={e => setFollowDelay(+e.target.value)} style={delaySelect}>{[1,2,3,4,5,6,7,8,9,10,11,12,13,14].map(d => <option key={d} value={d}>{d}</option>)}</select> {t('wizard.days')} ↓
                  </div>
                  <div style={card}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(236,72,153,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>↩️</div>
                      <div>
                        <h4 style={{ color: '#f1f5f9', fontSize: 14, fontWeight: 600 }}>{t('wizard.followUpMessage')}</h4>
                        <p style={{ color: '#64748b', fontSize: 11 }}>{t('wizard.sentIfNoReply')}</p>
                      </div>
                    </div>
                    <label style={lbl}>{t('wizard.messageLabel')}</label>
                    <textarea ref={followRef} style={{ ...textarea, borderColor: followUp.length === 0 ? 'rgba(239,68,68,0.3)' : undefined }} value={followUp} onChange={e => setFollowUp(e.target.value.slice(0, 500))} placeholder="Hi {{firstName}}, just following up on my previous message..." rows={4} maxLength={500} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <VariableChips textareaRef={followRef} value={followUp} onChange={setFollowUp} />
                      <span style={{ color: '#475569', fontSize: 11 }}>{followUp.length}/500</span>
                    </div>
                    <button type="button" onClick={() => setShowSurveyFollow(true)}
                      style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, background: 'linear-gradient(135deg,rgba(124,58,237,0.12),rgba(236,72,153,0.12))', border: '1px solid rgba(124,58,237,0.25)', borderRadius: 8, padding: '8px 14px', color: '#c4b5fd', fontSize: 13, fontWeight: 600, cursor: 'pointer', width: '100%', justifyContent: 'center' }}>
                      <Sparkles size={14} /> {t('wizard.writeAI')}
                    </button>
                    <CampaignMessageSurvey
                      isOpen={showSurveyFollow}
                      onClose={() => setShowSurveyFollow(false)}
                      messageType="follow_up"
                      prospectName={prospects.find(p => selected.has(p.id))?.name}
                      prospectTitle={prospects.find(p => selected.has(p.id))?.title}
                      onGenerate={async (config) => handleSurveyGenerate(config, setFollowUp, 500)}
                    />
                  </div>
                </>
              )}

              {!enabledSteps.invite && !enabledSteps.message && !enabledSteps.follow && (
                <div style={{ ...card, textAlign: 'center', color: '#64748b', fontSize: 13 }}>
                  {t('wizard.visitOnlyNote')}
                </div>
              )}
            </div>
          )}

          {/* ── STEP 3: Prospects ── */}
          {step === 2 && (
            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ color: '#f1f5f9', fontSize: 16, fontWeight: 700 }}>{t('wizard.selectProspects')}</h3>
                <span style={{ background: 'rgba(124,58,237,0.15)', color: '#c4b5fd', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{selected.size} {t('wizard.selected')}</span>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: '#475569' }} />
                  <input style={{ ...input, paddingLeft: 30 }} value={search} onChange={e => setSearch(e.target.value)} placeholder={t('wizard.searchProspects')} />
                </div>
                <button onClick={toggleAll} style={{ ...btnSecondary, padding: '8px 12px', fontSize: 12 }}>
                  {selected.size === filteredProspects.length ? t('wizard.deselectAll') : t('wizard.selectAll')}
                </button>
              </div>

              {loadingProspects ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
                  <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} />
                  {t('wizard.loadingProspects')}
                </div>
              ) : prospects.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <Users size={32} style={{ color: '#475569', margin: '0 auto 12px' }} />
                  <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 12 }}>{t('wizard.noProspects')}</p>
                  <button style={btnPrimary} onClick={() => navigate('/app/extension')}>{t('wizard.goImport')}</button>
                </div>
              ) : (
                <div style={{ maxHeight: 340, overflowY: 'auto', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left', color: '#64748b', fontWeight: 500, width: 36 }}>☑</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', color: '#64748b', fontWeight: 500 }}>{t('leads.name')}</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', color: '#64748b', fontWeight: 500 }}>{t('leads.titleCol')}</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', color: '#64748b', fontWeight: 500 }}>{t('leads.company')}</th>
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
                <h3 style={{ color: '#f1f5f9', fontSize: 16, fontWeight: 700, marginBottom: 16 }}>{t('wizard.reviewLaunch')}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
                  <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 14, textAlign: 'center' }}>
                    <div style={{ color: '#64748b', fontSize: 11, marginBottom: 4 }}>{t('wizard.campaign')}</div>
                    <div style={{ color: '#f1f5f9', fontSize: 14, fontWeight: 600 }}>{name}</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 14, textAlign: 'center' }}>
                    <div style={{ color: '#64748b', fontSize: 11, marginBottom: 4 }}>{t('wizard.sequence')}</div>
                    <div style={{ color: '#f1f5f9', fontSize: 14, fontWeight: 600 }}>{activeStepCount} {t('wizard.stepsLabel')}</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 14, textAlign: 'center' }}>
                    <div style={{ color: '#64748b', fontSize: 11, marginBottom: 4 }}>{t('wizard.prospects')}</div>
                    <div style={{ color: '#f1f5f9', fontSize: 14, fontWeight: 600 }}>{selected.size} {t('wizard.selected')}</div>
                  </div>
                </div>

                <h4 style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>{t('wizard.sequencePreview')}</h4>
                <div style={{ borderLeft: '2px solid rgba(124,58,237,0.3)', paddingLeft: 16 }}>
                  {enabledSteps.visit && (
                    <div style={{ marginBottom: 14 }}><span style={{ color: '#64748b', fontSize: 11 }}>Day 0</span><br /><span style={{ color: '#f1f5f9', fontSize: 13 }}>👁 {t('wizard.visitProfile')}</span></div>
                  )}
                  {enabledSteps.invite && (
                    <div style={{ marginBottom: 14 }}><span style={{ color: '#64748b', fontSize: 11 }}>Day {inviteDelay}</span><br /><span style={{ color: '#f1f5f9', fontSize: 13 }}>🤝 {t('wizard.sendInvite')} {inviteNote ? `— "${inviteNote.slice(0, 50)}${inviteNote.length > 50 ? '...' : ''}"` : ''}</span></div>
                  )}
                  {enabledSteps.message && (
                    <div style={{ marginBottom: 14 }}><span style={{ color: '#64748b', fontSize: 11 }}>+{msg1Delay}d {t('wizard.daysAfterAcceptance')}</span><br /><span style={{ color: '#f1f5f9', fontSize: 13 }}>💬 "{msg1.slice(0, 60)}{msg1.length > 60 ? '...' : ''}"</span></div>
                  )}
                  {enabledSteps.follow && (
                    <div><span style={{ color: '#64748b', fontSize: 11 }}>+{followDelay}d {t('wizard.days')}</span><br /><span style={{ color: '#f1f5f9', fontSize: 13 }}>↩️ "{followUp.slice(0, 60)}{followUp.length > 60 ? '...' : ''}"</span></div>
                  )}
                </div>
              </div>

              {prospects.length > 0 && enabledSteps.message && (
                <div style={{ ...card, background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.2)' }}>
                  <h4 style={{ color: '#c4b5fd', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>📝 {t('wizard.messagePreview')}</h4>
                  <p style={{ color: '#94a3b8', fontSize: 13, fontStyle: 'italic' }}>"{previewMsg(msg1).slice(0, 120)}{previewMsg(msg1).length > 120 ? '...' : ''}"</p>
                </div>
              )}
            </div>
          )}

          {/* ── Navigation ── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
            {step > 0 ? (
              <button style={btnSecondary} onClick={() => { setStep(step - 1); setError(''); }}>
                <ChevronLeft size={16} /> {t('common.back')}
              </button>
            ) : <div />}

            {step < 3 ? (
              <button style={{ ...btnPrimary, opacity: canNext() ? 1 : 0.5 }} disabled={!canNext()} onClick={() => { setError(''); setStep(step + 1); }}>
                {t('common.next')} <ChevronRight size={16} />
              </button>
            ) : (
              <button style={{ ...btnPrimary, opacity: launching ? 0.6 : 1 }} disabled={launching} onClick={launch}>
                {launching ? <><Loader2 size={16} className="animate-spin" /> {t('wizard.launching')}</> : <><Rocket size={16} /> {t('wizard.launchCampaign')}</>}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
    {showExtModal && (
      <ExtensionRequiredModal reason="campaign" onClose={() => setShowExtModal(false)} />
    )}
    </>
  );
}
