import { useState, useEffect, useRef } from 'react';
import ClientNav from '@/components/ClientNav';
import { useAuth } from '@/contexts/AuthContext';
import AISurveyModal, { AIMessageConfig } from '@/components/AISurveyModal';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  Sparkles, Save, Trash2, Edit3, Copy, Search,
  MessageSquare, Loader2, Plus, X, Send,
} from 'lucide-react';

type MessageType = 'connection_note' | 'follow_up' | 'inmail';

interface MessageTemplate {
  id: string;
  name: string;
  content: string;
  message_type: MessageType;
  purpose: string | null;
  tone: string | null;
  variables: string[];
  usage_count: number;
  created_at: string;
}

async function apiFetch(path: string, token: string, options?: RequestInit) {
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(options?.headers || {}) },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.message || `API error ${res.status}`);
  return data;
}

const VARIABLES = [
  { label: 'firstName', insert: '{{firstName}}' },
  { label: 'company', insert: '{{company}}' },
  { label: 'jobTitle', insert: '{{jobTitle}}' },
  { label: 'location', insert: '{{location}}' },
];

export default function Messages() {
  const { t, i18n } = useTranslation();
  const { accessToken } = useAuth();
  const token = accessToken || localStorage.getItem('supabase_token') || '';

  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [search, setSearch] = useState('');

  // Quick Send state
  const [quickUrl, setQuickUrl] = useState('');
  const [quickTemplateId, setQuickTemplateId] = useState('');
  const [quickCustomMsg, setQuickCustomMsg] = useState('');
  const [quickSending, setQuickSending] = useState(false);

  // Form state
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [messageType, setMessageType] = useState<MessageType>('connection_note');

  // AI modal
  const [showAI, setShowAI] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const maxChars = messageType === 'connection_note' ? 300 : 500;

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`/api/messages?type=${filterType}`, token);
      setTemplates(data.messages || []);
    } catch (e) {
      console.error('[Messages] fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTemplates(); }, [filterType]);

  const resetForm = () => {
    setEditId(null);
    setName('');
    setContent('');
    setMessageType('connection_note');
  };

  const saveTemplate = async () => {
    if (!name.trim() || !content.trim()) {
      toast.error(t('messages.nameAndContentRequired') || 'Name and content are required');
      return;
    }
    setSaving(true);
    try {
      if (editId) {
        await apiFetch(`/api/messages/${editId}`, token, {
          method: 'PUT',
          body: JSON.stringify({ name, content, message_type: messageType }),
        });
        toast.success(t('messages.templateUpdated') || 'Template updated ✅');
      } else {
        await apiFetch('/api/messages', token, {
          method: 'POST',
          body: JSON.stringify({ name, content, message_type: messageType }),
        });
        toast.success(t('messages.templateSaved') || 'Template saved ✅');
      }
      resetForm();
      fetchTemplates();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteTemplate = async (id: string) => {
    try {
      await apiFetch(`/api/messages/${id}`, token, { method: 'DELETE' });
      setTemplates(templates.filter(t => t.id !== id));
      toast.success(t('messages.deleted'));
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const editTemplate = (t: MessageTemplate) => {
    setEditId(t.id);
    setName(t.name);
    setContent(t.content);
    setMessageType(t.message_type);
  };

  const insertVariable = (varInsert: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = content.substring(0, start);
    const after = content.substring(end);
    const newContent = before + varInsert + after;
    setContent(newContent.slice(0, maxChars));
    setTimeout(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = start + varInsert.length;
    }, 0);
  };

  const handleAIGenerate = async (config: AIMessageConfig) => {
    setAiGenerating(true);
    try {
      const stepType = messageType === 'connection_note' ? 'invite' : messageType === 'follow_up' ? 'follow_up' : 'message';
      const res = await apiFetch('/api/ai/generate-message', token, {
        method: 'POST',
        body: JSON.stringify({
          stepType,
          purpose: config.purpose,
          tone: config.tone,
          senderContext: config.senderContext,
          specificGoal: config.specificGoal,
          language: i18n.language,
        }),
      });
      if (res.message) {
        setContent(res.message.substring(0, maxChars));
        setShowAI(false);
        toast.success('تم توليد الرسالة ✨');
      }
    } catch (e: any) {
      toast.error(e.message || 'فشل توليد الرسالة');
    } finally {
      setAiGenerating(false);
    }
  };

  const previewContent = (text: string) => {
    return text
      .replace(/\{\{firstName\}\}/g, 'أحمد')
      .replace(/\{\{company\}\}/g, 'شركة واصل')
      .replace(/\{\{jobTitle\}\}/g, 'مدير التسويق')
      .replace(/\{\{location\}\}/g, 'الرياض');
  };

  const typeLabels: Record<string, string> = {
    connection_note: t('messages.connectionNote') || 'Connection Note',
    follow_up: t('messages.followUp') || 'Follow-up',
    inmail: t('messages.inmail') || 'InMail',
  };

  const typeColors: Record<string, { bg: string; color: string }> = {
    connection_note: { bg: 'rgba(124,58,237,0.12)', color: '#c4b5fd' },
    follow_up: { bg: 'rgba(59,130,246,0.12)', color: '#93c5fd' },
    inmail: { bg: 'rgba(34,197,94,0.12)', color: '#86efac' },
  };

  const handleQuickSend = () => {
    if (!quickUrl.trim()) { toast.error('أدخل رابط الملف الشخصي على LinkedIn'); return; }
    const tpl = templates.find(t => t.id === quickTemplateId);
    const msgText = tpl ? tpl.content : quickCustomMsg;
    if (!msgText.trim()) { toast.error('اختر قالبًا أو اكتب رسالة'); return; }
    setQuickSending(true);
    window.postMessage({ type: 'WASSEL_SEND_MESSAGE', source: 'wassel-web', profileUrl: quickUrl.trim(), message: msgText }, '*');
    toast.success('✅ تم إرسال طلب الرسالة — سيفتح LinkedIn تلقائيًا');
    setTimeout(() => setQuickSending(false), 2000);
  };

  const card: React.CSSProperties = {
    background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
    borderRadius: 12, padding: 24,
  };

  const filteredTemplates = templates.filter(t =>
    (!search || t.name.toLowerCase().includes(search.toLowerCase()) ||
     t.content.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-base)' }}>
      <ClientNav />
      <main className="main-content" style={{ flex: 1, padding: 32, overflowY: 'auto' }}>
        <div style={{ maxWidth: 1100 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>
            {t('messages.title') || 'الرسائل'}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>
            {t('messages.subtitle') || 'إنشاء وإدارة قوالب الرسائل لحملات LinkedIn'}
          </p>

          {/* ── Quick Send ── */}
          <div style={{ ...card, marginBottom: 24, background: 'linear-gradient(135deg,rgba(124,58,237,0.08),rgba(59,130,246,0.06))', border: '1px solid rgba(124,58,237,0.2)' }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Send size={15} style={{ color: '#c4b5fd' }} />
              إرسال رسالة سريعة
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, alignItems: 'end' }}>
              {/* LinkedIn URL */}
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>رابط الملف الشخصي</label>
                <input
                  value={quickUrl}
                  onChange={e => setQuickUrl(e.target.value)}
                  placeholder="https://linkedin.com/in/..."
                  dir="ltr"
                  style={{
                    width: '100%', padding: '9px 12px', borderRadius: 8,
                    border: '1px solid var(--border-subtle)', background: 'rgba(255,255,255,0.05)',
                    color: 'var(--text-primary)', fontSize: 13, outline: 'none',
                  }}
                />
              </div>
              {/* Template or custom */}
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>القالب (أو اكتب رسالة أدناه)</label>
                <select
                  value={quickTemplateId}
                  onChange={e => setQuickTemplateId(e.target.value)}
                  style={{
                    width: '100%', padding: '9px 12px', borderRadius: 8,
                    border: '1px solid var(--border-subtle)', background: 'rgba(255,255,255,0.05)',
                    color: 'var(--text-primary)', fontSize: 13, outline: 'none',
                  }}
                >
                  <option value="">— رسالة مخصصة —</option>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              {/* Send button */}
              <button
                onClick={handleQuickSend}
                disabled={quickSending}
                style={{
                  padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                  background: 'var(--gradient-primary)', border: 'none', color: '#fff',
                  cursor: quickSending ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                  opacity: quickSending ? 0.7 : 1,
                }}
              >
                {quickSending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                إرسال
              </button>
            </div>
            {/* Custom message (shown when no template selected) */}
            {!quickTemplateId && (
              <textarea
                value={quickCustomMsg}
                onChange={e => setQuickCustomMsg(e.target.value.slice(0, 500))}
                placeholder="اكتب رسالتك المخصصة هنا..."
                rows={3}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 8, marginTop: 10,
                  border: '1px solid var(--border-subtle)', background: 'rgba(255,255,255,0.04)',
                  color: 'var(--text-primary)', fontSize: 13, resize: 'vertical',
                  fontFamily: 'inherit', outline: 'none',
                }}
              />
            )}
            {/* Preview selected template */}
            {quickTemplateId && templates.find(t => t.id === quickTemplateId) && (
              <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px dashed var(--border-subtle)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>معاينة</div>
                <p style={{ fontSize: 12, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                  {previewContent(templates.find(t => t.id === quickTemplateId)!.content)}
                </p>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '55% 1fr', gap: 20, alignItems: 'start' }}>
            {/* LEFT — Create/Edit Template */}
            <div style={card}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                {editId ? <Edit3 size={15} /> : <Plus size={15} />}
                {editId ? (t('messages.editTemplate') || 'تعديل القالب') : (t('messages.createTemplate') || 'إنشاء قالب جديد')}
                {editId && (
                  <button onClick={resetForm} style={{ marginInlineStart: 'auto', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <X size={14} />
                  </button>
                )}
              </h2>

              {/* Template name */}
              <input
                value={name}
                onChange={e => setName(e.target.value.slice(0, 60))}
                placeholder={t('messages.templateName') || 'اسم القالب'}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 8, marginBottom: 12,
                  border: '1px solid var(--border-subtle)', background: 'rgba(255,255,255,0.04)',
                  color: 'var(--text-primary)', fontSize: 13, outline: 'none',
                }}
              />

              {/* Message type */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                {(['connection_note', 'follow_up', 'inmail'] as MessageType[]).map(mt => (
                  <button
                    key={mt}
                    onClick={() => setMessageType(mt)}
                    style={{
                      flex: 1, padding: '8px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                      background: messageType === mt ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.04)',
                      border: messageType === mt ? '1px solid rgba(124,58,237,0.3)' : '1px solid var(--border-subtle)',
                      color: messageType === mt ? 'var(--accent-secondary)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    {typeLabels[mt]}
                  </button>
                ))}
              </div>

              {/* Textarea */}
              <textarea
                ref={textareaRef}
                value={content}
                onChange={e => setContent(e.target.value.slice(0, maxChars))}
                placeholder={t('messages.writeMessage') || 'اكتب رسالتك هنا...'}
                rows={5}
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 8,
                  border: '1px solid var(--border-subtle)', background: 'rgba(255,255,255,0.04)',
                  color: 'var(--text-primary)', fontSize: 13, resize: 'vertical',
                  fontFamily: 'inherit', outline: 'none', minHeight: 100,
                }}
              />

              {/* Char counter + AI */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, marginBottom: 10 }}>
                <button
                  onClick={() => setShowAI(true)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    background: 'linear-gradient(135deg,rgba(124,58,237,0.12),rgba(236,72,153,0.12))',
                    border: '1px solid rgba(124,58,237,0.25)', borderRadius: 8,
                    padding: '6px 12px', color: '#c4b5fd', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  <Sparkles size={13} /> {t('messages.writeWithAI') || '✨ كتابة بالذكاء الاصطناعي'}
                </button>
                <span style={{ fontSize: 11, color: content.length > maxChars - 30 ? '#ef4444' : 'var(--text-muted)' }}>
                  {content.length}/{maxChars}
                </span>
              </div>

              {/* Variable chips */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                {VARIABLES.map(v => (
                  <button
                    key={v.label}
                    onClick={() => insertVariable(v.insert)}
                    style={{
                      padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                      background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)',
                      color: '#c4b5fd', cursor: 'pointer',
                    }}
                  >
                    + {v.label}
                  </button>
                ))}
              </div>

              {/* Preview */}
              {content && (
                <div style={{
                  padding: 12, borderRadius: 8, marginBottom: 14,
                  background: 'rgba(255,255,255,0.02)', border: '1px dashed var(--border-subtle)',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                    {t('messages.preview') || 'معاينة'}
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                    {previewContent(content)}
                  </p>
                </div>
              )}

              {/* Save button */}
              <button
                onClick={saveTemplate}
                disabled={!name.trim() || !content.trim() || saving}
                style={{
                  width: '100%', padding: '11px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                  background: name.trim() && content.trim() ? 'var(--gradient-primary)' : 'rgba(255,255,255,0.08)',
                  border: 'none', color: name.trim() && content.trim() ? '#fff' : 'var(--text-muted)',
                  cursor: name.trim() && content.trim() ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {editId ? (t('messages.updateTemplate') || 'تحديث القالب') : (t('messages.saveTemplate') || 'حفظ القالب')}
              </button>
            </div>

            {/* RIGHT — Template Library */}
            <div style={card}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <MessageSquare size={15} />
                {t('messages.templateLibrary') || 'مكتبة القوالب'}
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400, marginInlineStart: 'auto' }}>
                  {filteredTemplates.length}
                </span>
              </h2>

              {/* Search */}
              <div style={{ position: 'relative', marginBottom: 10 }}>
                <Search size={14} style={{ position: 'absolute', top: 10, insetInlineStart: 12, color: 'var(--text-muted)' }} />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={t('messages.search') || 'بحث...'}
                  style={{
                    width: '100%', padding: '8px 12px 8px 34px', borderRadius: 8,
                    border: '1px solid var(--border-subtle)', background: 'rgba(255,255,255,0.04)',
                    color: 'var(--text-primary)', fontSize: 12, outline: 'none',
                  }}
                />
              </div>

              {/* Filter */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
                {['all', 'connection_note', 'follow_up', 'inmail'].map(ft => (
                  <button
                    key={ft}
                    onClick={() => setFilterType(ft)}
                    style={{
                      padding: '5px 10px', borderRadius: 16, fontSize: 11, fontWeight: 600,
                      background: filterType === ft ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.04)',
                      border: filterType === ft ? '1px solid rgba(124,58,237,0.3)' : '1px solid var(--border-subtle)',
                      color: filterType === ft ? 'var(--accent-secondary)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    {ft === 'all' ? (t('messages.all') || 'الكل') : typeLabels[ft]}
                  </button>
                ))}
              </div>

              {/* Template list */}
              <div style={{ maxHeight: 420, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {loading ? (
                  <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>
                    <Loader2 size={20} className="animate-spin" style={{ margin: '0 auto 6px' }} />
                  </div>
                ) : filteredTemplates.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)', fontSize: 13 }}>
                    {t('messages.noTemplates') || 'لا توجد قوالب بعد'}
                  </div>
                ) : (
                  filteredTemplates.map(tmpl => {
                    const tc = typeColors[tmpl.message_type] || typeColors.connection_note;
                    return (
                      <div
                        key={tmpl.id}
                        style={{
                          padding: 12, borderRadius: 10,
                          border: '1px solid var(--border-subtle)',
                          background: 'rgba(255,255,255,0.02)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{tmpl.name}</span>
                            <span style={{
                              padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 600,
                              background: tc.bg, color: tc.color,
                            }}>
                              {typeLabels[tmpl.message_type]}
                            </span>
                          </div>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                            {tmpl.usage_count}x
                          </span>
                        </div>

                        <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 8, maxHeight: 40, overflow: 'hidden' }}>
                          {tmpl.content.substring(0, 80)}{tmpl.content.length > 80 ? '...' : ''}
                        </p>

                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => editTemplate(tmpl)}
                            style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}
                          >
                            <Edit3 size={11} /> {t('common.edit') || 'تعديل'}
                          </button>
                          <button
                            onClick={() => { navigator.clipboard.writeText(tmpl.content); toast.success(t('messages.copied')); }}
                            style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}
                          >
                            <Copy size={11} /> {t('common.copy')}
                          </button>
                          <button
                            onClick={() => deleteTemplate(tmpl.id)}
                            style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <AISurveyModal
        isOpen={showAI}
        onClose={() => setShowAI(false)}
        onGenerate={handleAIGenerate}
        isGenerating={aiGenerating}
      />
    </div>
  );
}
