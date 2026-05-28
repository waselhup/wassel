import type { ReactNode } from 'react';

/**
 * War Room — luxurious executive boardroom backdrop.
 *
 * Eight layered planes, all CSS + SVG (no 3D engine, no images):
 *   1. Back wall      — deep navy → warm brown gradient
 *   2. Geometric pat. — subtle Islamic 8-point star tiled across the wall
 *   3. Side walls     — trapezoidal shadows for depth
 *   4. Ceiling        — dark with warm spotlight bloom
 *   5. Light overlay  — radial warm glow over the table
 *   6. Projector slot — brass frame, dark mirror when idle
 *   7. U-shape table  — mahogany gradient + grain + glass sheen
 *   8. Chair anchors  — leather silhouettes per seat (rendered by parent)
 *
 * Seat positions follow the existing table_seat numbering (1..8). Faris is
 * seat 1 (head of table, closest to camera) and Mohammed is seat 8 (back).
 */

export interface LuxuryRoomProps {
  /** Render the agent + bubble that lives at this seat (1..8). */
  renderSeat: (seat: number) => ReactNode;
  /** Optional projector screen content. */
  projector?: ReactNode;
  /** Active speaker's seat — used for soft room-level focus. */
  activeSeat?: number | null;
}

// ─── Seat layout ──────────────────────────────────────────────────────────
// Percentages around the U-table. Back-row seats (6/7/8) sit below the
// projector slot so they never collide with it at narrow desktop widths.
const SEAT_LAYOUT: Record<number, { left: string; top: string; scale: number }> = {
  1: { left: '50%', top: '82%', scale: 1.10 }, // Faris    — head, closest
  2: { left: '24%', top: '74%', scale: 1.02 }, // Sayed
  3: { left: '76%', top: '74%', scale: 1.02 }, // Al-Mukhadram
  4: { left: '13%', top: '60%', scale: 0.96 }, // Hassan
  5: { left: '87%', top: '60%', scale: 0.96 }, // Fatima
  6: { left: '22%', top: '48%', scale: 0.92 }, // Dhai
  7: { left: '78%', top: '48%', scale: 0.92 }, // Hussein
  8: { left: '50%', top: '46%', scale: 0.94 }, // Mohammed — far end, below projector
};

export function getSeatLayout(seat: number) {
  return SEAT_LAYOUT[seat] || { left: '50%', top: '50%', scale: 1.0 };
}

// ─── Islamic 8-point star pattern ─────────────────────────────────────────
// 80×80 tile, ultra low opacity. Inline data-URI keeps it self-contained.
const STAR_TILE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="80" height="80">
  <g fill="none" stroke="rgba(212,175,55,0.6)" stroke-width="0.6">
    <path d="M40 4 L48 24 L68 24 L52 38 L60 60 L40 46 L20 60 L28 38 L12 24 L32 24 Z"/>
    <path d="M40 16 L46 28 L60 28 L50 36 L54 50 L40 42 L26 50 L30 36 L20 28 L34 28 Z"/>
    <circle cx="40" cy="40" r="2.5"/>
  </g>
</svg>`.trim();

const STAR_TILE_URI = `data:image/svg+xml;utf8,${encodeURIComponent(STAR_TILE_SVG)}`;

export default function LuxuryRoom({ renderSeat, projector, activeSeat }: LuxuryRoomProps) {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: '100vh',
        overflow: 'hidden',
        // Layer 1 — back wall: deep navy at top, warm brown at floor line
        background:
          'linear-gradient(to bottom, #0a1a2e 0%, #1a2238 35%, #2d2017 70%, #3d2817 100%)',
        isolation: 'isolate',
      }}
    >
      {/* Layer 2 — Islamic geometric pattern, very subtle */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url("${STAR_TILE_URI}")`,
          backgroundSize: '120px 120px',
          backgroundRepeat: 'repeat',
          opacity: 0.07,
          mixBlendMode: 'screen',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />

      {/* Layer 3a — left side wall (trapezoid shadow) */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '14%',
          height: '100%',
          background:
            'linear-gradient(to right, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 100%)',
          pointerEvents: 'none',
          zIndex: 2,
        }}
      />

      {/* Layer 3b — right side wall */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '14%',
          height: '100%',
          background:
            'linear-gradient(to left, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 100%)',
          pointerEvents: 'none',
          zIndex: 2,
        }}
      />

      {/* Layer 4 — ceiling band with warm spotlight bloom */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '22%',
          background:
            'radial-gradient(ellipse at 50% 0%, rgba(255, 200, 120, 0.28) 0%, rgba(255, 200, 120, 0.08) 40%, transparent 70%)',
          pointerEvents: 'none',
          zIndex: 3,
        }}
      />

      {/* Layer 4b — perspective wood floor */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '38%',
          background:
            'linear-gradient(to bottom, rgba(61, 40, 23, 0) 0%, rgba(40, 25, 15, 0.7) 40%, rgba(15, 10, 6, 0.95) 100%)',
          transform: 'perspective(900px) rotateX(48deg)',
          transformOrigin: 'bottom',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '38%',
          backgroundImage:
            'repeating-linear-gradient(90deg, rgba(255,220,160,0.04) 0px, rgba(255,220,160,0.04) 2px, transparent 2px, transparent 60px)',
          transform: 'perspective(900px) rotateX(48deg)',
          transformOrigin: 'bottom',
          pointerEvents: 'none',
          zIndex: 2,
          opacity: 0.6,
        }}
      />

      {/* Layer 5 — warm radial light pool over the table */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: '30%',
          left: '50%',
          width: '70vw',
          height: '55vh',
          transform: 'translateX(-50%)',
          background:
            'radial-gradient(ellipse, rgba(255, 198, 120, 0.20) 0%, rgba(255, 198, 120, 0.08) 35%, transparent 70%)',
          pointerEvents: 'none',
          zIndex: 4,
          mixBlendMode: 'screen',
        }}
      />

      {/* Layer 6 — projector screen with brass frame */}
      <div
        style={{
          position: 'absolute',
          top: '5%',
          left: '50%',
          width: 'min(600px, 46vw)',
          height: 'min(200px, 26vh)',
          transform: 'translateX(-50%)',
          padding: 4,
          borderRadius: 14,
          // brass / gold frame
          background:
            'linear-gradient(135deg, #f6d365 0%, #c9a040 30%, #8b6914 55%, #d4af37 100%)',
          boxShadow:
            projector
              ? '0 0 60px rgba(255, 198, 120, 0.55), 0 12px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.25)'
              : '0 8px 24px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.2)',
          zIndex: 5,
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: 10,
            background: projector
              ? 'linear-gradient(180deg, #fdf6e3 0%, #f5e6c8 100%)'
              : 'linear-gradient(180deg, #050810 0%, #0e1626 100%)',
            boxShadow: projector
              ? 'inset 0 0 60px rgba(255,220,150,0.5)'
              : 'inset 0 4px 16px rgba(0,0,0,0.75)',
            overflow: 'hidden',
            padding: projector ? 14 : 0,
            color: '#1f1306',
            transition: 'background 400ms ease, box-shadow 400ms ease',
          }}
        >
          {projector ? (
            projector
          ) : (
            <div
              aria-hidden
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'rgba(212, 175, 55, 0.35)',
                fontSize: 11,
                fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                letterSpacing: 2,
              }}
            >
              ●
            </div>
          )}
        </div>
      </div>

      {/* Layer 7 — U-shape mahogany table with glass top */}
      <svg
        viewBox="0 0 800 420"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -40%) perspective(1100px) rotateX(54deg)',
          width: 'min(78vw, 980px)',
          height: 'auto',
          pointerEvents: 'none',
          zIndex: 4,
          filter: 'drop-shadow(0 30px 40px rgba(0,0,0,0.7))',
        }}
      >
        <defs>
          <linearGradient id="wood-top" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5c3924" />
            <stop offset="40%" stopColor="#3d2817" />
            <stop offset="100%" stopColor="#1d120a" />
          </linearGradient>
          <linearGradient id="wood-edge" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#7a4a2c" />
            <stop offset="50%" stopColor="#5c3924" />
            <stop offset="100%" stopColor="#7a4a2c" />
          </linearGradient>
          <linearGradient id="glass-sheen" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.22)" />
            <stop offset="55%" stopColor="rgba(255,255,255,0.04)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.0)" />
          </linearGradient>
          <pattern id="grain" x="0" y="0" width="120" height="14" patternUnits="userSpaceOnUse">
            <path d="M0 7 Q 30 4, 60 7 T 120 7" stroke="rgba(255,200,140,0.12)" strokeWidth="0.6" fill="none"/>
            <path d="M0 11 Q 40 8, 80 11 T 120 11" stroke="rgba(255,200,140,0.08)" strokeWidth="0.4" fill="none"/>
          </pattern>
        </defs>

        {/* Table body (U-shape opening toward viewer/camera) */}
        <path
          d="M 110,90 L 690,90 Q 712,90 712,112 L 712,310 Q 712,332 690,332 L 545,332 Q 545,210 400,210 Q 255,210 255,332 L 110,332 Q 88,332 88,310 L 88,112 Q 88,90 110,90 Z"
          fill="url(#wood-top)"
          stroke="url(#wood-edge)"
          strokeWidth="3"
        />
        {/* Grain overlay */}
        <path
          d="M 110,90 L 690,90 Q 712,90 712,112 L 712,310 Q 712,332 690,332 L 545,332 Q 545,210 400,210 Q 255,210 255,332 L 110,332 Q 88,332 88,310 L 88,112 Q 88,90 110,90 Z"
          fill="url(#grain)"
          opacity="0.55"
        />
        {/* Glass top sheen */}
        <path
          d="M 110,90 L 690,90 Q 712,90 712,112 L 712,200 L 88,200 L 88,112 Q 88,90 110,90 Z"
          fill="url(#glass-sheen)"
        />
        {/* Edge highlight (brass-ish) */}
        <path
          d="M 110,90 L 690,90"
          stroke="rgba(212,175,55,0.55)"
          strokeWidth="1.2"
        />
      </svg>

      {/* Layer 8 — leather chair silhouettes anchored under each seat */}
      {[1, 2, 3, 4, 5, 6, 7, 8].map((seat) => {
        const pos = SEAT_LAYOUT[seat];
        return (
          <div
            key={`chair-${seat}`}
            aria-hidden
            style={{
              position: 'absolute',
              left: pos.left,
              top: `calc(${pos.top} + 60px)`,
              transform: `translate(-50%, -50%) scale(${pos.scale})`,
              width: 96,
              height: 64,
              zIndex: 5,
              pointerEvents: 'none',
            }}
          >
            <svg viewBox="0 0 96 64" width="96" height="64">
              <defs>
                <linearGradient id={`leather-${seat}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2b1810" />
                  <stop offset="60%" stopColor="#150b06" />
                  <stop offset="100%" stopColor="#070302" />
                </linearGradient>
              </defs>
              {/* chair back */}
              <path
                d="M 14,4 L 82,4 Q 88,4 88,12 L 88,44 Q 88,52 82,52 L 14,52 Q 8,52 8,44 L 8,12 Q 8,4 14,4 Z"
                fill={`url(#leather-${seat})`}
                stroke="rgba(212,175,55,0.18)"
                strokeWidth="0.8"
              />
              {/* tufting buttons */}
              <circle cx="28" cy="20" r="1.2" fill="rgba(212,175,55,0.25)" />
              <circle cx="48" cy="20" r="1.2" fill="rgba(212,175,55,0.25)" />
              <circle cx="68" cy="20" r="1.2" fill="rgba(212,175,55,0.25)" />
              <circle cx="28" cy="36" r="1.2" fill="rgba(212,175,55,0.25)" />
              <circle cx="48" cy="36" r="1.2" fill="rgba(212,175,55,0.25)" />
              <circle cx="68" cy="36" r="1.2" fill="rgba(212,175,55,0.25)" />
            </svg>
          </div>
        );
      })}

      {/* 8 seat slots — agent portraits are mounted here by parent */}
      {[1, 2, 3, 4, 5, 6, 7, 8].map((seat) => {
        const pos = SEAT_LAYOUT[seat];
        const isActive = activeSeat === seat;
        return (
          <div
            key={`seat-${seat}`}
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
