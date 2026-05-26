import type { ReactNode } from 'react';

/**
 * 2.5D virtual office — pure CSS + SVG. No 3D engine.
 *
 *   ┌───────────── PROJECTOR ─────────────┐
 *   │                                    │
 *   │     (slot 1)   FARIS   (slot 2)    │
 *   │                                    │
 *   │  (slot 8)    U-TABLE    (slot 3)   │
 *   │  (slot 7)               (slot 4)   │
 *   │     (slot 6)           (slot 5)    │
 *   │                                    │
 *   └───── perspective floor gradient ───┘
 */
export interface RoomSceneProps {
  /** Slot 1..8 maps to the agent's table_seat. Optional render fn lets the
   *  parent inject AgentPortrait + SpeechBubble for that seat. */
  renderSeat: (seat: number) => ReactNode;
  /** Optional projector screen content (passed as React node). */
  projector?: ReactNode;
  /** Active speaker's seat (1..8), used for room-level focus. */
  activeSeat?: number | null;
}

// (left%, top%, transform) — clockwise around the U-table starting top-left.
// Slot 1 (faris) is bottom-center / "head of the table" facing the projector.
const SEAT_LAYOUT: Record<number, { left: string; top: string; scale: number }> = {
  1: { left: '50%', top: '78%', scale: 1.08 }, // Faris — head of table
  2: { left: '24%', top: '70%', scale: 1.0 },  // Sayed — left of Faris
  3: { left: '76%', top: '70%', scale: 1.0 },  // Al-Mukhadram — right of Faris
  4: { left: '12%', top: '55%', scale: 0.96 }, // Hassan — far left
  5: { left: '88%', top: '55%', scale: 0.96 }, // Fatima — far right
  6: { left: '20%', top: '40%', scale: 0.92 }, // Dhai — upper left
  7: { left: '80%', top: '40%', scale: 0.92 }, // Hussein — upper right
  8: { left: '50%', top: '36%', scale: 0.94 }, // Mohammed — upper middle
};

export function getSeatLayout(seat: number) {
  return SEAT_LAYOUT[seat] || { left: '50%', top: '50%', scale: 1.0 };
}

export default function RoomScene({ renderSeat, projector, activeSeat }: RoomSceneProps) {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: '100vh',
        background:
          'radial-gradient(ellipse at top, #1E293B 0%, #0F172A 60%, #020617 100%)',
        overflow: 'hidden',
      }}
    >
      {/* Ambient warm glow from projector */}
      <div
        style={{
          position: 'absolute',
          top: '8%',
          left: '50%',
          width: '60vw',
          height: '50vh',
          transform: 'translateX(-50%)',
          background: 'radial-gradient(ellipse, rgba(250, 200, 120, 0.18) 0%, rgba(250, 200, 120, 0) 70%)',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />

      {/* Floor gradient with perspective */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '45%',
          background:
            'linear-gradient(to bottom, rgba(15, 23, 42, 0) 0%, rgba(15, 23, 42, 0.4) 40%, rgba(2, 6, 23, 0.85) 100%)',
          transform: 'perspective(800px) rotateX(40deg)',
          transformOrigin: 'bottom',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* Projector screen — slot at top-back */}
      <div
        style={{
          position: 'absolute',
          top: '4%',
          left: '50%',
          width: 'min(640px, 50vw)',
          height: 'min(220px, 30vh)',
          transform: 'translateX(-50%)',
          background: projector
            ? 'linear-gradient(135deg, #FCD34D 0%, #F59E0B 100%)'
            : 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)',
          border: `1px solid ${projector ? '#FCD34D' : '#334155'}`,
          borderRadius: 12,
          boxShadow: projector
            ? '0 0 40px rgba(250, 200, 120, 0.45), inset 0 1px 0 rgba(255,255,255,0.15)'
            : '0 4px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)',
          padding: 16,
          overflow: 'hidden',
          transition: 'background 400ms ease, box-shadow 400ms ease',
          zIndex: 2,
        }}
      >
        {projector ? (
          <div style={{ width: '100%', height: '100%', color: '#0F172A' }}>{projector}</div>
        ) : (
          <div
            aria-hidden
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#475569',
              fontSize: 12,
              opacity: 0.4,
            }}
          >
            ◐
          </div>
        )}
      </div>

      {/* SVG U-table — centered */}
      <svg
        viewBox="0 0 800 400"
        preserveAspectRatio="xMidYMid meet"
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -45%) perspective(1000px) rotateX(50deg)',
          width: 'min(70vw, 900px)',
          height: 'auto',
          pointerEvents: 'none',
          zIndex: 1,
          opacity: 0.85,
        }}
      >
        <defs>
          <linearGradient id="table-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3E2723" />
            <stop offset="100%" stopColor="#1A0E0A" />
          </linearGradient>
        </defs>
        <path
          d="M 100,80 L 700,80 Q 720,80 720,100 L 720,300 Q 720,320 700,320 L 560,320 Q 560,200 400,200 Q 240,200 240,320 L 100,320 Q 80,320 80,300 L 80,100 Q 80,80 100,80 Z"
          fill="url(#table-gradient)"
          stroke="#5C2E0E"
          strokeWidth="2"
        />
      </svg>

      {/* 8 seat slots */}
      {[1, 2, 3, 4, 5, 6, 7, 8].map((seat) => {
        const pos = SEAT_LAYOUT[seat];
        const isActive = activeSeat === seat;
        return (
          <div
            key={seat}
            style={{
              position: 'absolute',
              left: pos.left,
              top: pos.top,
              transform: `translate(-50%, -50%) scale(${pos.scale})`,
              zIndex: isActive ? 30 : 10,
              transition: 'transform 300ms ease, z-index 300ms',
              pointerEvents: 'auto',
            }}
          >
            {renderSeat(seat)}
          </div>
        );
      })}
    </div>
  );
}
