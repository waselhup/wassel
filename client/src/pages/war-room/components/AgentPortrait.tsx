import { motion } from 'framer-motion';
import { getAgentAvatarUrl, isAgentId } from '../assets/agent-avatars';

export type Expression = 'neutral' | 'happy' | 'thinking' | 'concerned' | 'excited' | 'frustrated';
export type AgentStatus = 'idle' | 'thinking' | 'speaking';

export interface AgentPortraitProps {
  agentId: string;
  nameAr: string;
  nameEn: string;
  age: number;
  language: 'ar' | 'en';
  expression: Expression;
  status: AgentStatus;
  /** Signature animation key from agent_personalities. */
  signatureAnimation?: string | null;
  /** Accent color (glow, status). */
  accentColor?: string;
}

// Per-agent color (matches the AI Workforce seed palette).
const AGENT_COLORS: Record<string, string> = {
  faris:        '#8B5CF6',
  sayed:        '#10B981',
  al_mukhadram: '#F59E0B',
  hassan:       '#EF4444',
  fatima:       '#EC4899',
  dhai:         '#6366F1',
  hussein:      '#0EA5E9',
  mohammed:     '#D4AF37',
};

// Quiet, looping micro-motions per agent so the room feels "alive".
// Amplitudes stay small — the room shouldn't read as busy.
const SIGNATURE: Record<string, { rotate?: number[]; y?: number[]; x?: number[]; scale?: number[]; duration: number }> = {
  sipping_coffee:     { rotate: [0, -1.2, -1.5, 0],        duration: 5.2 },
  pointing_at_screen: { x: [0, 2, 0, -1, 0],                duration: 3.4 },
  gentle_nod:         { y: [0, -1.5, 0, 1, 0],              duration: 4.0 },
  leaning_forward:    { scale: [1, 1.025, 1.02, 1],         duration: 3.6 },
  adjusting_glasses:  { rotate: [0, 0, 0.8, 0, 0],          duration: 6.0 },
  arms_crossed:       { x: [0, 0.4, 0, -0.4, 0],            duration: 8.0 },
  staring_at_logs:    { rotate: [0, 0.6, 0, -0.4, 0],       duration: 7.0 },
  calculating:        { y: [0, -0.8, 0, -0.5, 0],           duration: 2.6 },
};

const ROLE_AR: Record<string, string> = {
  faris: 'COO', sayed: 'إبداع', al_mukhadram: 'المخضرم', hassan: 'مبيعات',
  fatima: 'تحليل', dhai: 'التزام', hussein: 'تقنية', mohammed: 'مالية',
};
const ROLE_EN: Record<string, string> = {
  faris: 'COO', sayed: 'Creative', al_mukhadram: 'Veteran', hassan: 'Sales',
  fatima: 'Analyst', dhai: 'Compliance', hussein: 'Tech', mohammed: 'Finance',
};

export default function AgentPortrait({
  agentId,
  nameAr,
  nameEn,
  age,
  language,
  status,
  signatureAnimation,
  accentColor,
}: AgentPortraitProps) {
  const color = accentColor || AGENT_COLORS[agentId] || '#D4AF37';
  const sig = signatureAnimation ? SIGNATURE[signatureAnimation] : null;
  const displayName = language === 'ar' ? nameAr : nameEn;
  const role = (language === 'ar' ? ROLE_AR : ROLE_EN)[agentId] || '';
  const avatarUrl = isAgentId(agentId) ? getAgentAvatarUrl(agentId) : '';

  const sigAnimate = sig
    ? {
        ...(sig.rotate ? { rotate: sig.rotate } : {}),
        ...(sig.y      ? { y: sig.y }           : {}),
        ...(sig.x      ? { x: sig.x }           : {}),
        ...(sig.scale  ? { scale: sig.scale }   : {}),
      }
    : {};

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        userSelect: 'none',
      }}
    >
      <motion.div
        animate={sigAnimate}
        transition={sig ? { duration: sig.duration, repeat: Infinity, ease: 'easeInOut' } : {}}
        style={{ position: 'relative', width: 120, height: 120 }}
      >
        {/* Speaking glow ring */}
        {status === 'speaking' && (
          <motion.div
            animate={{ scale: [1, 1.10, 1], opacity: [0.55, 0.25, 0.55] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            aria-hidden
            style={{
              position: 'absolute',
              top: -10,
              left: -10,
              width: 140,
              height: 140,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${color}66 0%, ${color}00 65%)`,
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />
        )}

        {/* DiceBear avatar — cropped to circle, brass ring border */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 120,
            height: 120,
            borderRadius: '50%',
            overflow: 'hidden',
            border: '2.5px solid #D4AF37',
            boxShadow:
              status === 'speaking'
                ? `0 0 18px ${color}aa, 0 6px 16px rgba(0,0,0,0.45)`
                : '0 6px 16px rgba(0,0,0,0.55)',
            transition: 'box-shadow 250ms ease',
            zIndex: 1,
            background: '#0f172a',
          }}
        >
          {avatarUrl && (
            <img
              src={avatarUrl}
              alt={displayName}
              width={120}
              height={120}
              loading="lazy"
              decoding="async"
              style={{
                display: 'block',
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                filter: status === 'thinking' ? 'brightness(0.82) saturate(0.9)' : 'none',
                transition: 'filter 200ms ease',
              }}
            />
          )}
        </div>

        {/* Status dot — speaking green / thinking amber / idle slate */}
        <span
          aria-hidden
          style={{
            position: 'absolute',
            bottom: 4,
            insetInlineEnd: 4,
            width: 14,
            height: 14,
            borderRadius: '50%',
            background:
              status === 'speaking' ? '#10B981' :
              status === 'thinking' ? '#F59E0B' :
              '#475569',
            border: '2px solid #0a0a0a',
            boxShadow:
              status === 'speaking'
                ? '0 0 10px rgba(16,185,129,0.7)'
                : 'none',
            transition: 'background 200ms ease, box-shadow 200ms ease',
            zIndex: 2,
          }}
        />
      </motion.div>

      {/* Name + role + age */}
      <div
        style={{
          textAlign: 'center',
          fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
          lineHeight: 1.15,
          textShadow: '0 2px 6px rgba(0,0,0,0.85)',
        }}
      >
        <div style={{ color: '#D4AF37', fontWeight: 700, fontSize: 14 }}>{displayName}</div>
        <div style={{ color: '#cbd5e1', fontWeight: 500, fontSize: 11, marginTop: 1 }}>{role}</div>
        <div style={{ color: '#94a3b8', fontWeight: 400, fontSize: 10, marginTop: 1 }}>{age}</div>
      </div>
    </div>
  );
}

export { AGENT_COLORS };
