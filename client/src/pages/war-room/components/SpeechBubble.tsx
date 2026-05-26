import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, VolumeX } from 'lucide-react';
import type { Expression } from './AgentPortrait';
import { WebSpeech } from '@/lib/web-speech';

const EXPRESSION_BORDER: Record<Expression, string> = {
  neutral:    'rgba(148, 163, 184, 0.4)',
  happy:      'rgba(16, 185, 129, 0.6)',
  thinking:   'rgba(245, 158, 11, 0.4)',
  concerned:  'rgba(234, 179, 8, 0.6)',
  excited:    'rgba(239, 68, 68, 0.5)',
  frustrated: 'rgba(239, 68, 68, 0.7)',
};

export interface SpeechBubbleProps {
  text: string;
  language: 'ar' | 'en';
  expression: Expression;
  timestamp?: string;
  voicePitch?: number;
  voiceRate?: number;
  /** auto-stream the text char-by-char on mount */
  typewriter?: boolean;
  /** anchor position (top|bottom) — controls bubble tail direction */
  anchor?: 'top' | 'bottom';
}

export default function SpeechBubble({
  text,
  language,
  expression,
  timestamp,
  voicePitch = 1.0,
  voiceRate = 1.0,
  typewriter = true,
  anchor = 'top',
}: SpeechBubbleProps) {
  const [displayedText, setDisplayedText] = useState<string>(typewriter ? '' : text);
  const [reading, setReading] = useState(false);
  const cleanupRef = useRef<{ cancelled: boolean }>({ cancelled: false });

  useEffect(() => {
    cleanupRef.current = { cancelled: false };
    if (!typewriter) {
      setDisplayedText(text);
      return () => { cleanupRef.current.cancelled = true; };
    }

    setDisplayedText('');
    let i = 0;
    const total = text.length;
    const stepMs = total > 200 ? 12 : total > 80 ? 22 : 32;

    function step() {
      if (cleanupRef.current.cancelled) return;
      i += 1;
      setDisplayedText(text.slice(0, i));
      if (i < total) setTimeout(step, stepMs);
    }
    step();

    return () => {
      cleanupRef.current.cancelled = true;
    };
  }, [text, typewriter]);

  function handleRead() {
    if (reading) {
      WebSpeech.stop();
      setReading(false);
      return;
    }
    if (!WebSpeech.isSupported()) return;
    setReading(true);
    WebSpeech.speak(text, language, voicePitch, voiceRate, () => setReading(false));
  }

  const supportsTts = WebSpeech.isSupported();

  return (
    <motion.div
      initial={{ opacity: 0, y: anchor === 'top' ? 6 : -6, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 360, damping: 26 }}
      style={{
        position: 'relative',
        background: '#FFFFFF',
        color: '#0F172A',
        padding: '10px 12px',
        borderRadius: 12,
        boxShadow: `0 6px 20px rgba(0,0,0,0.3), 0 0 0 1px ${EXPRESSION_BORDER[expression]}`,
        maxWidth: 280,
        minWidth: 120,
        fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
        fontSize: 13,
        lineHeight: 1.5,
        textAlign: language === 'ar' ? 'right' : 'left',
        direction: language === 'ar' ? 'rtl' : 'ltr',
      }}
    >
      {/* Bubble tail */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          left: '50%',
          ...(anchor === 'top' ? { bottom: -6 } : { top: -6 }),
          transform: `translateX(-50%) ${anchor === 'bottom' ? 'rotate(180deg)' : ''}`,
          width: 12,
          height: 12,
          background: '#FFFFFF',
          clipPath: 'polygon(50% 100%, 0 0, 100% 0)',
          boxShadow: `0 0 0 1px ${EXPRESSION_BORDER[expression]}`,
        }}
      />

      <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{displayedText}</div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 6,
          gap: 8,
          fontSize: 10,
          color: '#64748B',
        }}
      >
        <span>{timestamp || ''}</span>
        {supportsTts && (
          <button
            type="button"
            onClick={handleRead}
            aria-label={language === 'ar' ? (reading ? 'إيقاف القراءة' : 'اقرأ بصوت عالٍ') : reading ? 'Stop reading' : 'Read aloud'}
            style={{
              background: 'transparent',
              border: 'none',
              padding: 4,
              cursor: 'pointer',
              borderRadius: 6,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              color: reading ? '#10B981' : '#64748B',
              transition: 'color 150ms ease',
            }}
          >
            <AnimatePresence mode="wait">
              {reading ? (
                <motion.span key="r" initial={{ scale: 0.8 }} animate={{ scale: 1 }} exit={{ scale: 0.8 }}>
                  <VolumeX size={12} />
                </motion.span>
              ) : (
                <motion.span key="p" initial={{ scale: 0.8 }} animate={{ scale: 1 }} exit={{ scale: 0.8 }}>
                  <Volume2 size={12} />
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        )}
      </div>
    </motion.div>
  );
}
