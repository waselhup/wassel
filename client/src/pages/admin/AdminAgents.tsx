import React, { useEffect, useMemo, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  Settings,
  TrendingUp,
  PenTool,
  Zap,
  MessageCircle,
  BarChart,
  Lightbulb,
  Plus,
  Send,
  Trash2,
  Loader2,
  Bot,
  User,
  Sparkles,
  X,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';

const ICONS: Record<string, any> = {
  Settings,
  TrendingUp,
  PenTool,
  Zap,
  MessageCircle,
  BarChart,
  Lightbulb,
};

interface Agent {
  id: string;
  nameAr: string;
  nameEn: string;
  descAr: string;
  descEn: string;
  icon: string;
  color: string;
}

interface Conversation {
  id: string;
  agent_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface Message {
  id: string;
  role: string;
  content: string;
  tokens_used?: number;
  created_at: string;
}

interface TrainingNote {
  id: string;
  agent_id: string;
  note: string;
  created_at: string;
}

export default function AdminAgents() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';

  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [training, setTraining] = useState<TrainingNote[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(false);
  const [showTrainingModal, setShowTrainingModal] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void loadAgents();
  }, []);

  useEffect(() => {
    if (selectedAgentId) {
      void loadConversations(selectedAgentId);
      void loadTraining(selectedAgentId);
    } else {
      setConversations([]);
      setActiveConvId(null);
      setMessages([]);
      setTraining([]);
    }
  }, [selectedAgentId]);

  useEffect(() => {
    if (activeConvId) {
      void loadConversation(activeConvId);
    } else {
      setMessages([]);
    }
  }, [activeConvId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  async function loadAgents() {
    try {
      const list = await trpc.agents.list();
      setAgents(list);
    } catch (e: any) {
      console.error('[Agents] loadAgents:', e);
    }
  }

  async function loadConversations(agentId: string) {
    setLoadingConvs(true);
    try {
      const list = await trpc.agents.listConversations({ agentId });
      setConversations(list);
    } catch (e: any) {
      console.error('[Agents] loadConversations:', e);
    } finally {
      setLoadingConvs(false);
    }
  }

  async function loadConversation(convId: string) {
    try {
      const { messages: msgs } = await trpc.agents.getConversation({ conversationId: convId });
      setMessages(msgs);
    } catch (e: any) {
      console.error('[Agents] loadConversation:', e);
    }
  }

  async function loadTraining(agentId: string) {
    try {
      const list = await trpc.agents.listTrainingNotes({ agentId });
      setTraining(list);
    } catch (e: any) {
      console.error('[Agents] loadTraining:', e);
    }
  }

  async function startNewConversation() {
    if (!selectedAgentId) return;
    try {
      const conv = await trpc.agents.startConversation({ agentId: selectedAgentId });
      setConversations((prev) => [conv, ...prev]);
      setActiveConvId(conv.id);
    } catch (e: any) {
      console.error('[Agents] startConversation:', e);
    }
  }

  async function sendMessage() {
    if (!activeConvId || !input.trim() || sending) return;
    const content = input.trim();
    setInput('');
    setSending(true);

    const tempUserMsg: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const result = await trpc.agents.sendMessage({
        conversationId: activeConvId,
        content,
      });
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempUserMsg.id),
        { ...tempUserMsg, id: `user-${Date.now()}` },
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: result.content,
          tokens_used: result.tokensUsed,
          created_at: new Date().toISOString(),
        },
      ]);
    } catch (e: any) {
      console.error('[Agents] sendMessage:', e);
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
      setInput(content);
      alert(e?.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  }

  async function deleteConversation(convId: string) {
    if (!confirm(isAr ? 'حذف هذه المحادثة؟' : 'Delete this conversation?')) return;
    try {
      await trpc.agents.deleteConversation({ conversationId: convId });
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      if (activeConvId === convId) setActiveConvId(null);
    } catch (e: any) {
      console.error('[Agents] deleteConversation:', e);
    }
  }

  async function addTrainingNote() {
    if (!selectedAgentId || !newNote.trim() || savingNote) return;
    setSavingNote(true);
    try {
      const note = await trpc.agents.addTrainingNote({
        agentId: selectedAgentId,
        note: newNote.trim(),
      });
      setTraining((prev) => [note, ...prev]);
      setNewNote('');
      setShowTrainingModal(false);
    } catch (e: any) {
      console.error('[Agents] addTrainingNote:', e);
    } finally {
      setSavingNote(false);
    }
  }

  async function deleteTrainingNote(noteId: string) {
    if (!confirm(isAr ? 'حذف هذه الملاحظة؟' : 'Delete this note?')) return;
    try {
      await trpc.agents.deleteTrainingNote({ noteId });
      setTraining((prev) => prev.filter((n) => n.id !== noteId));
    } catch (e: any) {
      console.error('[Agents] deleteTrainingNote:', e);
    }
  }

  const selectedAgent = useMemo(
    () => agents.find((a) => a.id === selectedAgentId),
    [agents, selectedAgentId],
  );

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '260px 1fr 280px',
        gap: 16,
        height: 'calc(100vh - 280px)',
        minHeight: 500,
        fontFamily: 'Cairo, Inter, sans-serif',
      }}
    >
      {/* LEFT — agents list */}
      <div
        style={{
          background: '#fff',
          borderRadius: 14,
          border: '1px solid #E5E7EB',
          padding: 14,
          overflowY: 'auto',
        }}
      >
        <div style={{ marginBottom: 12, fontWeight: 900, fontSize: 13, color: '#1F2937' }}>
          {isAr ? 'الوكلاء' : 'Agents'}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {agents.map((agent) => {
            const Icon = ICONS[agent.icon] || Bot;
            const active = selectedAgentId === agent.id;
            return (
              <button
                key={agent.id}
                onClick={() => {
                  setSelectedAgentId(agent.id);
                  setActiveConvId(null);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: 'none',
                  background: active ? agent.color + '15' : 'transparent',
                  cursor: 'pointer',
                  textAlign: 'start',
                  fontFamily: 'inherit',
                  transition: 'background 150ms',
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: agent.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Icon size={16} color="#fff" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#1F2937', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {isAr ? agent.nameAr : agent.nameEn}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {selectedAgentId && (
          <>
            <div style={{ height: 1, background: '#E5E7EB', margin: '14px 0' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontWeight: 900, fontSize: 12, color: '#6B7280' }}>
                {isAr ? 'المحادثات' : 'Conversations'}
              </div>
              <button
                onClick={startNewConversation}
                style={{
                  padding: '4px 8px',
                  borderRadius: 8,
                  background: '#0A8F84',
                  color: '#fff',
                  border: 'none',
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontFamily: 'inherit',
                }}
              >
                <Plus size={11} /> {isAr ? 'جديد' : 'New'}
              </button>
            </div>
            {loadingConvs ? (
              <div style={{ padding: 16, textAlign: 'center' }}>
                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite', color: '#9CA3AF' }} />
              </div>
            ) : conversations.length === 0 ? (
              <div style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center', padding: 14 }}>
                {isAr ? 'لا توجد محادثات' : 'No conversations yet'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {conversations.map((c) => {
                  const active = c.id === activeConvId;
                  return (
                    <div
                      key={c.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '8px 10px',
                        borderRadius: 8,
                        background: active ? '#F3F4F6' : 'transparent',
                        cursor: 'pointer',
                      }}
                      onClick={() => setActiveConvId(c.id)}
                    >
                      <div style={{ flex: 1, fontSize: 11, color: '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {c.title}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void deleteConversation(c.id);
                        }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#9CA3AF',
                          cursor: 'pointer',
                          padding: 2,
                        }}
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* MIDDLE — chat */}
      <div
        style={{
          background: '#fff',
          borderRadius: 14,
          border: '1px solid #E5E7EB',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {!selectedAgent ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: '#9CA3AF' }}>
            <Bot size={48} />
            <div style={{ fontSize: 14, fontWeight: 700 }}>
              {isAr ? 'اختر وكيلاً للبدء' : 'Pick an agent to get started'}
            </div>
          </div>
        ) : !activeConvId ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14, padding: 24 }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 16,
                background: selectedAgent.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {React.createElement(ICONS[selectedAgent.icon] || Bot, { size: 32, color: '#fff' })}
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#1F2937' }}>
              {isAr ? selectedAgent.nameAr : selectedAgent.nameEn}
            </div>
            <div style={{ fontSize: 13, color: '#6B7280', textAlign: 'center', maxWidth: 380, lineHeight: 1.6 }}>
              {isAr ? selectedAgent.descAr : selectedAgent.descEn}
            </div>
            <button
              onClick={startNewConversation}
              style={{
                padding: '11px 22px',
                borderRadius: 12,
                background: 'linear-gradient(135deg, #0A8F84, #0EA5E9)',
                color: '#fff',
                border: 'none',
                fontWeight: 800,
                fontSize: 13,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                fontFamily: 'inherit',
                boxShadow: '0 6px 16px rgba(10,143,132,0.25)',
              }}
            >
              <Sparkles size={14} /> {isAr ? 'ابدأ محادثة جديدة' : 'Start new conversation'}
            </button>
          </div>
        ) : (
          <>
            <div style={{ flex: 1, overflowY: 'auto', padding: 18, background: '#F9FAFB' }}>
              {messages.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#9CA3AF', padding: 40, fontSize: 13 }}>
                  {isAr ? 'اكتب رسالة لبدء المحادثة' : 'Type a message to start the conversation'}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {messages.map((m) => {
                    const isUser = m.role === 'user';
                    return (
                      <div
                        key={m.id}
                        style={{
                          display: 'flex',
                          gap: 10,
                          alignItems: 'flex-start',
                          flexDirection: isUser ? 'row-reverse' : 'row',
                        }}
                      >
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            background: isUser ? '#374151' : selectedAgent.color,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {isUser ? <User size={15} color="#fff" /> : <Bot size={15} color="#fff" />}
                        </div>
                        <div
                          style={{
                            maxWidth: '75%',
                            padding: '10px 14px',
                            borderRadius: 12,
                            background: isUser ? '#0A8F84' : '#fff',
                            color: isUser ? '#fff' : '#1F2937',
                            fontSize: 13,
                            lineHeight: 1.7,
                            whiteSpace: 'pre-wrap',
                            border: isUser ? 'none' : '1px solid #E5E7EB',
                            boxShadow: isUser ? '0 2px 6px rgba(10,143,132,0.15)' : 'none',
                          }}
                        >
                          {m.content}
                          {m.tokens_used !== undefined && m.tokens_used > 0 && (
                            <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 6 }}>
                              {m.tokens_used} tokens
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {sending && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#6B7280', fontSize: 12 }}>
                      <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                      {isAr ? 'الوكيل يفكر...' : 'Agent is thinking...'}
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>
            <div
              style={{
                padding: 12,
                borderTop: '1px solid #E5E7EB',
                display: 'flex',
                gap: 8,
                background: '#fff',
              }}
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void sendMessage();
                  }
                }}
                placeholder={isAr ? 'اكتب رسالة...' : 'Type a message...'}
                rows={2}
                disabled={sending}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1.5px solid #E5E7EB',
                  fontSize: 13,
                  fontFamily: 'inherit',
                  resize: 'none',
                  outline: 'none',
                  background: '#F9FAFB',
                }}
              />
              <button
                onClick={sendMessage}
                disabled={sending || !input.trim()}
                style={{
                  padding: '10px 16px',
                  borderRadius: 10,
                  background: sending || !input.trim() ? '#E5E7EB' : 'linear-gradient(135deg, #0A8F84, #0EA5E9)',
                  color: sending || !input.trim() ? '#9CA3AF' : '#fff',
                  border: 'none',
                  cursor: sending || !input.trim() ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {sending ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={16} />}
              </button>
            </div>
          </>
        )}
      </div>

      {/* RIGHT — training notes */}
      <div
        style={{
          background: '#fff',
          borderRadius: 14,
          border: '1px solid #E5E7EB',
          padding: 14,
          overflowY: 'auto',
          display: selectedAgent ? 'block' : 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontWeight: 900, fontSize: 13, color: '#1F2937' }}>
            {isAr ? 'ملاحظات التدريب' : 'Training notes'}
          </div>
          <button
            onClick={() => setShowTrainingModal(true)}
            style={{
              padding: '4px 8px',
              borderRadius: 8,
              background: '#0A8F84',
              color: '#fff',
              border: 'none',
              fontSize: 11,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontFamily: 'inherit',
            }}
          >
            <Plus size={11} /> {isAr ? 'إضافة' : 'Add'}
          </button>
        </div>
        <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 12 }}>
          {isAr
            ? 'الملاحظات تُضاف لرسالة النظام في كل محادثة لتحسين الردود.'
            : 'Notes are appended to the system prompt of every conversation.'}
        </div>
        {training.length === 0 ? (
          <div style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', padding: 14 }}>
            {isAr ? 'لا توجد ملاحظات بعد' : 'No notes yet'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {training.map((n) => (
              <div
                key={n.id}
                style={{
                  padding: 10,
                  borderRadius: 10,
                  background: '#F9FAFB',
                  border: '1px solid #E5E7EB',
                  fontSize: 12,
                  color: '#374151',
                  lineHeight: 1.6,
                  position: 'relative',
                }}
              >
                {n.note}
                <button
                  onClick={() => deleteTrainingNote(n.id)}
                  style={{
                    position: 'absolute',
                    top: 6,
                    insetInlineEnd: 6,
                    background: 'transparent',
                    border: 'none',
                    color: '#9CA3AF',
                    cursor: 'pointer',
                    padding: 2,
                  }}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showTrainingModal && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: 16,
            }}
            onClick={() => setShowTrainingModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: '#fff',
                borderRadius: 16,
                padding: 24,
                width: '100%',
                maxWidth: 480,
              }}
            >
              <div style={{ fontWeight: 900, fontSize: 18, color: '#1F2937', marginBottom: 12 }}>
                {isAr ? 'إضافة ملاحظة تدريب' : 'Add training note'}
              </div>
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder={
                  isAr
                    ? 'مثال: اذكر دائماً مواءمة رؤية 2030'
                    : 'Example: Always mention Vision 2030 alignment'
                }
                rows={4}
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  borderRadius: 12,
                  border: '1.5px solid #E5E7EB',
                  fontSize: 13,
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  outline: 'none',
                  background: '#F9FAFB',
                  marginBottom: 14,
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  onClick={() => setShowTrainingModal(false)}
                  style={{
                    padding: '9px 16px',
                    borderRadius: 10,
                    background: '#F3F4F6',
                    color: '#374151',
                    border: 'none',
                    fontWeight: 800,
                    fontSize: 13,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  onClick={addTrainingNote}
                  disabled={savingNote || !newNote.trim()}
                  style={{
                    padding: '9px 18px',
                    borderRadius: 10,
                    background: savingNote || !newNote.trim() ? '#E5E7EB' : '#0A8F84',
                    color: savingNote || !newNote.trim() ? '#9CA3AF' : '#fff',
                    border: 'none',
                    fontWeight: 800,
                    fontSize: 13,
                    cursor: savingNote || !newNote.trim() ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {savingNote ? (isAr ? 'جاري الحفظ...' : 'Saving...') : isAr ? 'إضافة' : 'Add'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
