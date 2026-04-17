import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  Bot, Send, Loader2, Check, X, AlertTriangle, Trash2, Plus,
  TrendingUp, MessageCircle, PenTool, BarChart, Zap, Building2,
  Lightbulb, ShieldCheck, Sparkles,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';

const ICON_MAP: Record<string, any> = {
  TrendingUp, MessageCircle, PenTool, BarChart, Zap, Building2, Lightbulb, Bot,
};
const COLOR_MAP: Record<string, { bg: string; border: string; text: string }> = {
  teal: { bg: '#F0FDF9', border: '#A7F3D0', text: '#065F46' },
  blue: { bg: '#EFF6FF', border: '#BFDBFE', text: '#1D4ED8' },
  purple: { bg: '#FAF5FF', border: '#E9D5FF', text: '#6B21A8' },
  orange: { bg: '#FFF7ED', border: '#FED7AA', text: '#C2410C' },
  red: { bg: '#FEF2F2', border: '#FECACA', text: '#B91C1C' },
  green: { bg: '#F0FDF4', border: '#BBF7D0', text: '#166534' },
  yellow: { bg: '#FEFCE8', border: '#FEF08A', text: '#A16207' },
};

interface Agent {
  id: string;
  name_ar: string;
  name_en: string;
  description_ar: string;
  description_en: string;
  allowed_tools: string[];
  icon: string;
  color: string;
}

interface Conversation {
  id: string;
  agent_id: string;
  title: string | null;
  updated_at: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls: any[] | null;
  created_at: string;
}

interface Action {
  id: string;
  tool_name: string;
  tool_input: any;
  tool_output: any;
  status: 'pending' | 'approved' | 'executed' | 'failed' | 'rejected';
  requires_confirmation: boolean;
  error_message: string | null;
  created_at: string;
}

export default function AdminExecutorAgents() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';

  const [agents, setAgents] = useState<Agent[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [actions, setActions] = useState<Action[]>([]);

  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const [a, c] = await Promise.all([trpc.executor.list(), trpc.executor.listConversations()]);
        setAgents(a);
        setConversations(c);
      } catch (e: any) {
        setErr(e?.message || 'Failed to load');
      } finally {
        setLoadingAgents(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length, actions.length]);

  async function openConversation(conv: Conversation) {
    setActiveConv(conv);
    const agent = agents.find((a) => a.id === conv.agent_id) || null;
    setSelectedAgent(agent);
    try {
      const { messages: m, actions: acts } = await trpc.executor.getConversation({ conversationId: conv.id });
      setMessages(m);
      setActions(acts);
    } catch (e: any) {
      setErr(e?.message || 'Load failed');
    }
  }

  async function startNewConversation(agent: Agent) {
    setSelectedAgent(agent);
    try {
      const conv = await trpc.executor.startConversation({ agentId: agent.id });
      setActiveConv(conv);
      setConversations([conv, ...conversations]);
      setMessages([]);
      setActions([]);
    } catch (e: any) {
      setErr(e?.message || 'Failed to start conversation');
    }
  }

  async function sendMessage() {
    if (!input.trim() || !activeConv || sending) return;
    const text = input.trim();
    setInput('');
    setSending(true);
    setErr(null);

    const userMsg: Message = {
      id: 'local-' + Date.now(),
      role: 'user',
      content: text,
      tool_calls: null,
      created_at: new Date().toISOString(),
    };
    setMessages((m) => [...m, userMsg]);

    try {
      const res = await trpc.executor.sendMessage({ conversationId: activeConv.id, content: text });
      if (res.error) {
        setErr(res.error);
      }
      const refreshed = await trpc.executor.getConversation({ conversationId: activeConv.id });
      setMessages(refreshed.messages);
      setActions(refreshed.actions);
    } catch (e: any) {
      setErr(e?.message || 'Send failed');
    } finally {
      setSending(false);
    }
  }

  async function approveAction(actionId: string) {
    try {
      await trpc.executor.approveAction({ actionId });
      if (activeConv) {
        const refreshed = await trpc.executor.getConversation({ conversationId: activeConv.id });
        setActions(refreshed.actions);
      }
    } catch (e: any) {
      setErr(e?.message || 'Approve failed');
    }
  }

  async function rejectAction(actionId: string) {
    try {
      await trpc.executor.rejectAction({ actionId });
      if (activeConv) {
        const refreshed = await trpc.executor.getConversation({ conversationId: activeConv.id });
        setActions(refreshed.actions);
      }
    } catch (e: any) {
      setErr(e?.message || 'Reject failed');
    }
  }

  async function deleteConversation(convId: string) {
    if (!confirm(isAr ? 'حذف المحادثة؟' : 'Delete conversation?')) return;
    try {
      await trpc.executor.deleteConversation({ conversationId: convId });
      setConversations((c) => c.filter((x) => x.id !== convId));
      if (activeConv?.id === convId) {
        setActiveConv(null);
        setMessages([]);
        setActions([]);
      }
    } catch {}
  }

  const pendingCount = actions.filter((a) => a.status === 'pending').length;
  const allToolsInConv = actions.map((a) => ({ ...a }));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr 280px', gap: 12, height: 'calc(100vh - 280px)', minHeight: 500 }}>
      {/* Left pane: agents + conversations */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E5E7EB', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid #E5E7EB', fontFamily: 'Cairo, sans-serif', fontWeight: 900, fontSize: 12, color: '#6B7280' }}>
          {isAr ? 'الوكلاء' : 'Agents'}
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loadingAgents && <div style={{ padding: 14, textAlign: 'center' }}><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /></div>}
          {agents.map((a) => {
            const Icon = ICON_MAP[a.icon] || Bot;
            const colors = COLOR_MAP[a.color] || COLOR_MAP.teal;
            return (
              <button key={a.id} onClick={() => startNewConversation(a)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px',
                  background: selectedAgent?.id === a.id && !activeConv ? colors.bg : 'transparent',
                  border: 'none', cursor: 'pointer', textAlign: 'start',
                  borderBottom: '1px solid #F3F4F6', transition: 'all 150ms',
                }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: colors.bg, border: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={14} color={colors.text} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: '#111827', fontFamily: 'Cairo, sans-serif' }}>
                    {isAr ? a.name_ar : a.name_en}
                  </div>
                  <div style={{ fontSize: 10, color: '#9CA3AF', fontFamily: 'Cairo, sans-serif' }}>
                    {a.allowed_tools.length} {isAr ? 'أداة' : 'tools'}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        <div style={{ padding: '10px 14px', borderTop: '1px solid #E5E7EB', fontFamily: 'Cairo, sans-serif', fontWeight: 900, fontSize: 11, color: '#6B7280' }}>
          {isAr ? 'محادثاتي' : 'My conversations'}
        </div>
        <div style={{ maxHeight: 180, overflowY: 'auto' }}>
          {conversations.map((c) => {
            const agent = agents.find((x) => x.id === c.agent_id);
            return (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 4, borderBottom: '1px solid #F3F4F6' }}>
                <button onClick={() => openConversation(c)}
                  style={{ flex: 1, padding: '8px 14px', background: activeConv?.id === c.id ? '#F0FDF9' : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'start', fontSize: 11, fontFamily: 'Cairo, sans-serif', color: '#374151', minWidth: 0 }}>
                  <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.title || (agent ? (isAr ? agent.name_ar : agent.name_en) : c.agent_id)}
                  </div>
                  <div style={{ fontSize: 9, color: '#9CA3AF' }}>{new Date(c.updated_at).toLocaleString()}</div>
                </button>
                <button onClick={() => deleteConversation(c.id)} style={{ padding: '4px 6px', background: 'transparent', border: 'none', color: '#DC2626', cursor: 'pointer' }}>
                  <Trash2 size={10} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Center pane: chat */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {activeConv && selectedAgent ? (
          <>
            <div style={{ padding: '12px 18px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: 10 }}>
              {(() => {
                const Icon = ICON_MAP[selectedAgent.icon] || Bot;
                const colors = COLOR_MAP[selectedAgent.color] || COLOR_MAP.teal;
                return (
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: colors.bg, border: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={16} color={colors.text} />
                  </div>
                );
              })()}
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 900, fontSize: 14, color: '#111827' }}>
                  {isAr ? selectedAgent.name_ar : selectedAgent.name_en}
                </div>
                <div style={{ fontSize: 11, color: '#6B7280', fontFamily: 'Cairo, sans-serif' }}>
                  {isAr ? selectedAgent.description_ar : selectedAgent.description_en}
                </div>
              </div>
              {pendingCount > 0 && (
                <span style={{ padding: '3px 10px', borderRadius: 999, background: '#FEF3C7', color: '#92400E', fontSize: 10, fontWeight: 900, fontFamily: 'Cairo, sans-serif', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <AlertTriangle size={10} /> {pendingCount} {isAr ? 'بانتظار الموافقة' : 'pending'}
                </span>
              )}
            </div>

            <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {messages.length === 0 && (
                <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF', fontSize: 12, fontFamily: 'Cairo, sans-serif' }}>
                  {isAr ? 'ابدأ المحادثة بإرسال رسالة' : 'Start by sending a message'}
                </div>
              )}
              {messages.map((m) => (
                <div key={m.id} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '82%', padding: '10px 14px', borderRadius: 12,
                    background: m.role === 'user' ? '#0A8F84' : '#F9FAFB',
                    color: m.role === 'user' ? '#fff' : '#111827',
                    fontFamily: 'Cairo, Inter, sans-serif', fontSize: 13, lineHeight: 1.7,
                    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  }}>
                    {m.content}
                    {m.tool_calls && m.tool_calls.length > 0 && (
                      <div style={{ marginTop: 8, padding: 8, background: 'rgba(0,0,0,0.05)', borderRadius: 8, fontSize: 10, fontFamily: 'monospace' }}>
                        🔧 {m.tool_calls.map((t: any) => t.name).join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {sending && (
                <div style={{ display: 'flex', gap: 8, padding: '8px 12px', color: '#6B7280', fontSize: 12, fontFamily: 'Cairo, sans-serif' }}>
                  <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                  {isAr ? 'يفكر...' : 'Thinking...'}
                </div>
              )}
              {err && (
                <div style={{ padding: 10, borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', fontSize: 12, fontFamily: 'Cairo, sans-serif' }}>
                  {err}
                </div>
              )}
            </div>

            <div style={{ borderTop: '1px solid #E5E7EB', padding: 12, display: 'flex', gap: 8 }}>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !sending) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder={isAr ? 'اكتب رسالة...' : 'Type a message...'}
                rows={2}
                style={{
                  flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid #E5E7EB',
                  resize: 'none', fontSize: 13, fontFamily: 'Cairo, Inter, sans-serif', outline: 'none',
                }}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || sending}
                style={{
                  padding: '0 16px', borderRadius: 10, background: '#0A8F84', color: '#fff',
                  border: 'none', cursor: 'pointer', opacity: !input.trim() || sending ? 0.5 : 1,
                  display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: 12, fontFamily: 'Cairo, sans-serif',
                }}
              >
                <Send size={14} />
                {isAr ? 'إرسال' : 'Send'}
              </button>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, color: '#9CA3AF' }}>
            <Bot size={40} style={{ marginBottom: 10, color: '#D1D5DB' }} />
            <div style={{ fontSize: 14, fontFamily: 'Cairo, sans-serif', fontWeight: 800 }}>
              {isAr ? 'اختر وكيلاً للبدء' : 'Pick an agent to start'}
            </div>
            <div style={{ fontSize: 11, marginTop: 4, fontFamily: 'Cairo, sans-serif' }}>
              {isAr ? 'من القائمة على اليمين' : 'From the list on the left'}
            </div>
          </div>
        )}
      </div>

      {/* Right pane: action log */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E5E7EB', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'Cairo, sans-serif', fontWeight: 900, fontSize: 12, color: '#6B7280' }}>
          <ShieldCheck size={12} /> {isAr ? 'سجل الإجراءات' : 'Actions log'}
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {allToolsInConv.length === 0 && (
            <div style={{ textAlign: 'center', padding: 20, color: '#9CA3AF', fontSize: 11, fontFamily: 'Cairo, sans-serif' }}>
              {isAr ? 'لا توجد إجراءات بعد' : 'No actions yet'}
            </div>
          )}
          {allToolsInConv.map((a) => (
            <div key={a.id} style={{
              padding: 10, borderRadius: 10, border: '1px solid #E5E7EB',
              background: a.status === 'pending' ? '#FEFCE8' : a.status === 'failed' || a.status === 'rejected' ? '#FEF2F2' : '#F0FDF9',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 900, color: '#111827' }}>{a.tool_name}</span>
                <span style={{
                  padding: '2px 6px', borderRadius: 6, fontSize: 9, fontWeight: 900, fontFamily: 'monospace',
                  background: a.status === 'pending' ? '#FEF3C7' : a.status === 'executed' ? '#D1FAE5' : a.status === 'failed' ? '#FECACA' : a.status === 'rejected' ? '#FECACA' : '#E5E7EB',
                  color: a.status === 'pending' ? '#92400E' : a.status === 'executed' ? '#065F46' : a.status === 'failed' ? '#991B1B' : a.status === 'rejected' ? '#991B1B' : '#6B7280',
                }}>{a.status}</span>
              </div>
              <pre style={{ fontSize: 9, color: '#6B7280', fontFamily: 'monospace', margin: 0, maxHeight: 80, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {JSON.stringify(a.tool_input, null, 2)}
              </pre>
              {a.error_message && (
                <div style={{ marginTop: 4, fontSize: 10, color: '#991B1B', fontFamily: 'Cairo, sans-serif' }}>
                  {a.error_message}
                </div>
              )}
              {a.status === 'pending' && (
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <button onClick={() => approveAction(a.id)} style={{ flex: 1, padding: '5px 8px', borderRadius: 6, background: '#10B981', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 900, fontFamily: 'Cairo, sans-serif', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                    <Check size={10} /> {isAr ? 'موافقة' : 'Approve'}
                  </button>
                  <button onClick={() => rejectAction(a.id)} style={{ flex: 1, padding: '5px 8px', borderRadius: 6, background: '#EF4444', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 900, fontFamily: 'Cairo, sans-serif', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                    <X size={10} /> {isAr ? 'رفض' : 'Reject'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
