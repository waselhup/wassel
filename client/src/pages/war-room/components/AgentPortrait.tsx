import { motion } from 'framer-motion';

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
  /** signature animation key from agent_personalities */
  signatureAnimation?: string | null;
  /** ring color (matches the existing agent palette in PersonaSwitcher) */
  accentColor?: string;
}

// Per-agent color (matches the palette from 20260526_ai_workforce.sql seed)
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

/**
 * Per-expression mouth + brow positions on the SVG face.
 * Keep numbers minimal — the agent's identity comes from color + initial.
 */
const FACE: Record<Expression, { mouth: string; brow: string }> = {
  neutral:    { mouth: 'M 35,62 Q 50,65 65,62',  brow: 'M 30,38 L 42,36 M 58,36 L 70,38' },
  happy:      { mouth: 'M 32,60 Q 50,72 68,60',  brow: 'M 30,36 L 42,34 M 58,34 L 70,36' },
  thinking:   { mouth: 'M 38,63 Q 50,60 62,63',  brow: 'M 28,38 L 42,34 M 58,38 L 70,40' },
  concerned:  { mouth: 'M 35,65 Q 50,58 65,65',  brow: 'M 30,40 L 42,36 M 58,36 L 70,40' },
  excited:    { mouth: 'M 30,58 Q 50,75 70,58',  brow: 'M 28,34 L 42,32 M 58,32 L 72,34' },
  frustrated: { mouth: 'M 35,66 Q 50,62 65,66',  brow: 'M 28,42 L 42,38 M 58,38 L 72,42' },
};

const SIGNATURE_TRANSFORMS: Record<string, any> = {
  sipping_coffee:      { rotate: [0, -2, 0, 0], duration: 4 },
  pointing_at_screen:  { x: [0, 2, 0], duration: 2 },
  gentle_nod:          { y: [0, -1, 0, 1, 0], duration: 3 },
  leaning_forward:     { scale: [1, 1.03, 1], duration: 3 },
  adjusting_glasses:   { rotate: [0, 0, 1, 0], duration: 5 },
  arms_crossed:        { x: [0, 0, 0], duration: 6 }, // mostly still
  staring_at_logs:     { rotate: [0, 0.5, 0, -0.5, 0], duration: 8 },
  calculating:         { y: [0, -1, 0], duration: 2 },
};

function initialsFor(agentId: string): string {
  const map: Record<string, string> = {
    faris: 'ف', sayed: 'س', al_mukhadram: 'م', hassan: 'ح',
    fatima: 'ف', dhai: 'ض', hussein: 'ح', mohammed: 'م',
  };
  return map[agentId] || '?';
}

export default function AgentPortrait({
  agentId,
  nameAr,
  nameEn,
  age,
  language,
  expression,
  status,
  signatureAnimation,
  accentColor,
}: AgentPortraitProps) {
  const color = accentColor || AGENT_COLORS[agentId] || '#94A3B8';
  const face = FACE[expression] || FACE.neutral;
  const sig = signatureAnimation ? SIGNATURE_TRANSFORMS[signatureAnimation] : null;
  const displayName = language === 'ar' ? nameAr : nameEn;
  const initial = initialsFor(agentId);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        userSelect: 'none',
      }}
    >
      <motion.div
        animate={sig || {}}
        transition={sig ? { duration: sig.duration, repeat: Infinity, ease: 'easeInOut' } : {}}
        style={{ position: 'relative' }}
      >
        {/* Speaking glow ring */}
        {status === 'speaking' && (
          <motion.div
            animate={{ scale: [1, 1.08, 1], opacity: [0.6, 0.3, 0.6] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              position: 'absolute',
              inset: -8,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${color}66, transparent 65%)`,
              pointerEvents: 'none',
            }}
          />
        )}

        {/* Portrait — stylized SVG circle face */}
        <svg
          viewBox="0 0 100 100"
          width={84}
          height={84}
          style={{
            display: 'block',
            filter: status === 'thinking' ? 'brightness(0.85)' : 'none',
            transition: 'filter 200ms ease',
          }}
        >
          {/* Halo / background ring */}
          <circle cx="50" cy="50" r="46" fill={color} opacity="0.18" />
          {/* Head */}
          <circle cx="50" cy="50" r="38" fill={color} stroke={color} strokeWidth="2" />
          {/* Eyes */}
          <circle cx="38" cy="46" r="3" fill="#0F172A" />
          <circle cx="62" cy="46" r="3" fill="#0F172A" />
          {/* Brows */}
          <path d={face.brow} stroke="#0F172A" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          {/* Mouth (animated by expression) */}
          <motion.path
            d={face.mouth}
            stroke="#0F172A"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
            animate={status === 'speaking' ? { d: [face.mouth, 'M 35,62 Q 50,68 65,62', face.mouth] } : { d: face.mouth }}
            transition={status === 'speaking' ? { duration: 0.4, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3 }}
          />
          {/* Initial badge (small Arabic letter) */}
          <text
            x="50"
            y="93"
            textAnchor="middle"
            fill="#FFFFFF"
            fontSize="11"
            fontWeight="700"
            fontFamily='"Thmanyah Sans", system-ui, sans-serif'
            opacity="0.9"
          >
            {initial}
          </text>
        </svg>

        {/* Status dot */}
        <span
          aria-hidden
          style={{
            position: 'absolute',
            bottom: 4,
            insetInlineEnd: 4,
            width: 12,
            height: 12,
            borderRadius: '50%',
            background:
              status === 'speaking' ? '#10B981' :
              status === 'thinking' ? '#F59E0B' :
              '#475569',
            border: '2px solid #0F172A',
            boxShadow: status === 'speaking' ? '0 0 8px #10B98199' : 'none',
            transition: 'background 200ms ease, box-shadow 200ms ease',
          }}
        />
      </motion.div>

      {/* Name + age */}
      <div
        style={{
          color: '#E2E8F0',
          fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
          fontSize: 12,
          fontWeight: 700,
          textShadow: '0 1px 2px rgba(0,0,0,0.6)',
          textAlign: 'center',
          lineHeight: 1.2,
        }}
      >
        {displayName}
        <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 400, marginTop: 1 }}>{age}</div>
      </div>
    </div>
  );
}

export { AGENT_COLORS };
