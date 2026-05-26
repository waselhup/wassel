import { useEffect, useRef, useState } from 'react';
import { Send, Mic, MicOff, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { WebSpeech } from '@/lib/web-speech';

export interface ChatInputProps {
  language: 'ar' | 'en';
  disabled?: boolean;
  onSend: (message: string) => void;
  /** Quick-action handlers — keys map to optional shortcuts. */
  onQuickAction?: (key: 'morning_brief' | 'approve_safe' | 'show_yesterday') => void;
}

export default function ChatInput({ language, disabled, onSend, onQuickAction }: ChatInputProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState('');
  const [listening, setListening] = useState(false);
  const [showQuick, setShowQuick] = useState(false);
  const recognitionRef = useRef<any>(null);
  const ttsSupported = WebSpeech.isSupported();
  const sttSupported = WebSpeech.isRecognitionSupported();

  useEffect(() => () => {
    if (recognitionRef.current) WebSpeech.stopListening(recognitionRef.current);
  }, []);

  function handleSend() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
  }

  function handleMic() {
    if (listening) {
      WebSpeech.stopListening(recognitionRef.current);
      recognitionRef.current = null;
      setListening(false);
      return;
    }
    if (!sttSupported) return;
    setListening(true);
    recognitionRef.current = WebSpeech.startListening(
      language,
      (text) => setValue(text),
      (err) => {
        console.warn('[war-room] STT error:', err);
        setListening(false);
      },
    );
    if (!recognitionRef.current) setListening(false);
  }

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: '12px 16px',
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderTop: '1px solid rgba(148, 163, 184, 0.2)',
        direction: language === 'ar' ? 'rtl' : 'ltr',
      }}
    >
      <AnimatePresence>
        {showQuick && onQuickAction && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
              marginBottom: 4,
            }}
          >
            {[
              { key: 'morning_brief' as const,  label: t('warRoom.quick.morningBrief',  { defaultValue: language === 'ar' ? 'صباح الخير، أعطني brief' : 'Good morning, give me brief' }) },
              { key: 'approve_safe' as const,   label: t('warRoom.quick.approveSafe',   { defaultValue: language === 'ar' ? 'وافق على الآمن' : 'Approve safe' }) },
              { key: 'show_yesterday' as const, label: t('warRoom.quick.showYesterday', { defaultValue: language === 'ar' ? 'أرني أمس' : 'Show yesterday' }) },
            ].map((q) => (
              <button
                key={q.key}
                type="button"
                onClick={() => {
                  setShowQuick(false);
                  onQuickAction(q.key);
                }}
                style={{
                  padding: '6px 12px',
                  borderRadius: 999,
                  border: '1px solid rgba(148, 163, 184, 0.35)',
                  background: 'rgba(30, 41, 59, 0.7)',
                  color: '#E2E8F0',
                  fontSize: 12,
                  fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                  cursor: 'pointer',
                }}
              >
                {q.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        {onQuickAction && (
          <button
            type="button"
            onClick={() => setShowQuick((s) => !s)}
            aria-label={t('warRoom.quickActions', { defaultValue: language === 'ar' ? 'خيارات سريعة' : 'Quick options' })}
            style={{
              flexShrink: 0,
              width: 40,
              height: 40,
              borderRadius: 10,
              border: '1px solid rgba(148, 163, 184, 0.3)',
              background: showQuick ? 'rgba(20, 184, 166, 0.2)' : 'rgba(30, 41, 59, 0.7)',
              color: showQuick ? '#14B8A6' : '#94A3B8',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 150ms ease, color 150ms ease',
            }}
          >
            <Zap size={16} />
          </button>
        )}

        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          rows={1}
          disabled={disabled}
          placeholder={
            t('warRoom.askPlaceholder', {
              defaultValue: language === 'ar' ? 'اكتب رسالتك للفريق...' : 'Type a message to the team...',
            })
          }
          style={{
            flex: 1,
            resize: 'none',
            minHeight: 40,
            maxHeight: 120,
            padding: '10px 14px',
            borderRadius: 12,
            border: '1px solid rgba(148, 163, 184, 0.3)',
            background: 'rgba(30, 41, 59, 0.6)',
            color: '#F8FAFC',
            fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
            fontSize: 14,
            lineHeight: 1.4,
            outline: 'none',
            direction: language === 'ar' ? 'rtl' : 'ltr',
          }}
        />

        {sttSupported && (
          <button
            type="button"
            onClick={handleMic}
            aria-label={listening ? (language === 'ar' ? 'إيقاف' : 'Stop') : (language === 'ar' ? 'تكلم' : 'Speak')}
            style={{
              flexShrink: 0,
              width: 40,
              height: 40,
              borderRadius: 10,
              border: '1px solid rgba(148, 163, 184, 0.3)',
              background: listening ? 'rgba(239, 68, 68, 0.25)' : 'rgba(30, 41, 59, 0.7)',
              color: listening ? '#EF4444' : '#94A3B8',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {listening ? <MicOff size={16} /> : <Mic size={16} />}
          </button>
        )}

        <button
          type="button"
          onClick={handleSend}
          disabled={disabled || !value.trim()}
          aria-label={t('warRoom.send', { defaultValue: language === 'ar' ? 'إرسال' : 'Send' })}
          style={{
            flexShrink: 0,
            width: 44,
            height: 40,
            borderRadius: 10,
            border: 'none',
            background:
              disabled || !value.trim()
                ? 'rgba(71, 85, 105, 0.4)'
                : 'linear-gradient(135deg, #14B8A6, #0F766E)',
            color: '#FFFFFF',
            cursor: disabled || !value.trim() ? 'default' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 150ms ease',
          }}
        >
          <Send size={16} style={language === 'ar' ? { transform: 'scaleX(-1)' } : undefined} />
        </button>
      </div>

      {!ttsSupported && (
        <div style={{ fontSize: 10, color: '#94A3B8', textAlign: 'center' }}>
          {t('warRoom.voiceUnsupported', { defaultValue: language === 'ar' ? 'متصفحك لا يدعم الصوت' : 'Your browser does not support voice' })}
        </div>
      )}
    </div>
  );
}
