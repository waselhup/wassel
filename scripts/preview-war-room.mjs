import { createAvatar } from '@dicebear/core';
import { notionists } from '@dicebear/collection';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', '.tmp', 'war-room-preview');
mkdirSync(OUT, { recursive: true });

const BG = { faris:'1e293b', sayed:'10b981', al_mukhadram:'78350f', hassan:'dc2626', fatima:'ec4899', dhai:'6366f1', hussein:'0ea5e9', mohammed:'d4af37' };

const AGENTS = {
  faris:        { hair:'variant16', beard:'variant04', beardP:100, glassesP:0,   glasses:'variant01', eyes:'variant02', brows:'variant05', lips:'variant10', nose:'variant03', body:'variant05', nameAr:'فارس', nameEn:'Faris', age:40, role:'COO', seat:1, sig:'sipping_coffee', color:'#8B5CF6' },
  sayed:        { hair:'variant09', beard:'variant02', beardP:100, glassesP:0,   glasses:'variant01', eyes:'variant04', brows:'variant03', lips:'variant05', nose:'variant02', body:'variant12', nameAr:'سيد', nameEn:'Sayed', age:28, role:'إبداع', seat:2, sig:'pointing_at_screen', color:'#10B981' },
  al_mukhadram: { hair:'variant05', beard:'variant07', beardP:100, glassesP:0,   glasses:'variant03', eyes:'variant01', brows:'variant07', lips:'variant03', nose:'variant05', body:'variant08', nameAr:'المخضرم', nameEn:'Al-Mukhadram', age:55, role:'المخضرم', seat:3, sig:'gentle_nod', color:'#F59E0B' },
  hassan:       { hair:'variant07', beard:'variant01', beardP:100, glassesP:0,   glasses:'variant01', eyes:'variant03', brows:'variant11', lips:'variant02', nose:'variant01', body:'variant02', nameAr:'حسن', nameEn:'Hassan', age:32, role:'مبيعات', seat:4, sig:'leaning_forward', color:'#EF4444' },
  fatima:       { hair:'variant40', beard:'variant01', beardP:0,   glassesP:100, glasses:'variant03', eyes:'variant02', brows:'variant02', lips:'variant07', nose:'variant02', body:'variant04', nameAr:'فاطمة', nameEn:'Fatima', age:35, role:'تحليل', seat:5, sig:'adjusting_glasses', color:'#EC4899' },
  dhai:         { hair:'variant03', beard:'variant05', beardP:100, glassesP:100, glasses:'variant02', eyes:'variant01', brows:'variant09', lips:'variant01', nose:'variant04', body:'variant06', nameAr:'ضي', nameEn:'Dhai', age:45, role:'التزام', seat:6, sig:'arms_crossed', color:'#6366F1' },
  hussein:      { hair:'variant21', beard:'variant03', beardP:100, glassesP:0,   glasses:'variant01', eyes:'variant05', brows:'variant04', lips:'variant06', nose:'variant02', body:'variant14', nameAr:'حسين', nameEn:'Hussein', age:38, role:'تقنية', seat:7, sig:'staring_at_logs', color:'#0EA5E9' },
  mohammed:     { hair:'variant04', beard:'variant06', beardP:100, glassesP:100, glasses:'variant04', eyes:'variant02', brows:'variant06', lips:'variant04', nose:'variant03', body:'variant07', nameAr:'محمد', nameEn:'Mohammed', age:50, role:'مالية', seat:8, sig:'calculating', color:'#D4AF37' },
};

const seatById = {};
for (const [id, a] of Object.entries(AGENTS)) {
  const opts = {
    seed: `${id}-seed`,
    backgroundColor: [BG[id]],
    backgroundType: ['gradientLinear'],
    hair: [a.hair], beard: [a.beard], beardProbability: a.beardP,
    glasses: [a.glasses], glassesProbability: a.glassesP,
    eyes: [a.eyes], brows: [a.brows], lips: [a.lips], nose: [a.nose],
    body: [a.body], gestureProbability: 0, bodyIconProbability: 0,
  };
  seatById[a.seat] = { ...a, id, svg: createAvatar(notionists, opts).toString() };
}

const SEAT_LAYOUT = {
  1: { left: '50%', top: '82%', scale: 1.10 },
  2: { left: '24%', top: '74%', scale: 1.02 },
  3: { left: '76%', top: '74%', scale: 1.02 },
  4: { left: '13%', top: '60%', scale: 0.96 },
  5: { left: '87%', top: '60%', scale: 0.96 },
  6: { left: '22%', top: '48%', scale: 0.92 },
  7: { left: '78%', top: '48%', scale: 0.92 },
  8: { left: '50%', top: '46%', scale: 0.94 },
};

const STAR_TILE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="80" height="80"><g fill="none" stroke="rgba(212,175,55,0.6)" stroke-width="0.6"><path d="M40 4 L48 24 L68 24 L52 38 L60 60 L40 46 L20 60 L28 38 L12 24 L32 24 Z"/><path d="M40 16 L46 28 L60 28 L50 36 L54 50 L40 42 L26 50 L30 36 L20 28 L34 28 Z"/><circle cx="40" cy="40" r="2.5"/></g></svg>';
const STAR_TILE = encodeURIComponent(STAR_TILE_SVG);

// Chairs and seats are SIBLINGS (matches LuxuryRoom.tsx render order).
// Chair sits behind the seat with z-index 5 vs 10. Chair top is offset
// `${pos.top} + 60px` so it sits visually under the avatar.
const chairs = [];
const portraits = [];
for (let seat = 1; seat <= 8; seat++) {
  const a = seatById[seat];
  if (!a) continue;
  const pos = SEAT_LAYOUT[seat];
  chairs.push(`<div class="chair" style="left:${pos.left};top:calc(${pos.top} + 60px);transform:translate(-50%,-50%) scale(${pos.scale});"><svg viewBox="0 0 96 64" width="96" height="64"><defs><linearGradient id="leather-${seat}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#2b1810"/><stop offset="60%" stop-color="#150b06"/><stop offset="100%" stop-color="#070302"/></linearGradient></defs><path d="M14 4 L82 4 Q88 4 88 12 L88 44 Q88 52 82 52 L14 52 Q8 52 8 44 L8 12 Q8 4 14 4 Z" fill="url(#leather-${seat})" stroke="rgba(212,175,55,0.18)" stroke-width="0.8"/><circle cx="28" cy="20" r="1.2" fill="rgba(212,175,55,0.25)"/><circle cx="48" cy="20" r="1.2" fill="rgba(212,175,55,0.25)"/><circle cx="68" cy="20" r="1.2" fill="rgba(212,175,55,0.25)"/><circle cx="28" cy="36" r="1.2" fill="rgba(212,175,55,0.25)"/><circle cx="48" cy="36" r="1.2" fill="rgba(212,175,55,0.25)"/><circle cx="68" cy="36" r="1.2" fill="rgba(212,175,55,0.25)"/></svg></div>`);
  portraits.push(`<div class="seat" style="left:${pos.left};top:${pos.top};transform:translate(-50%,-50%) scale(${pos.scale});"><div class="portrait"><div class="avatar-wrap"><img src="${a.id}.svg" width="120" height="120" alt="${a.nameEn}"/></div><div class="label"><div class="name">${a.nameAr}</div><div class="role">${a.role}</div><div class="age">${a.age}</div></div></div></div>`);
}

const css = `
* { box-sizing:border-box }
body { margin:0; padding:0; min-height:100vh; font-family:"Thmanyah Sans",system-ui,sans-serif; overflow:hidden; background:#000 }
.room { position:relative; width:100vw; height:100vh; overflow:hidden; background: linear-gradient(to bottom, #0a1a2e 0%, #1a2238 35%, #2d2017 70%, #3d2817 100%); isolation:isolate }
.pattern { position:absolute; inset:0; background-image:url("data:image/svg+xml;utf8,${STAR_TILE}"); background-size:120px 120px; opacity:0.07; mix-blend-mode:screen; pointer-events:none; z-index:1 }
.wall-l { position:absolute; top:0; left:0; width:14%; height:100%; background: linear-gradient(to right, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 100%); z-index:2 }
.wall-r { position:absolute; top:0; right:0; width:14%; height:100%; background: linear-gradient(to left, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 100%); z-index:2 }
.ceiling { position:absolute; top:0; left:0; right:0; height:22%; background: radial-gradient(ellipse at 50% 0%, rgba(255,200,120,0.28) 0%, rgba(255,200,120,0.08) 40%, transparent 70%); z-index:3 }
.floor { position:absolute; bottom:0; left:0; right:0; height:38%; background: linear-gradient(to bottom, rgba(61,40,23,0) 0%, rgba(40,25,15,0.7) 40%, rgba(15,10,6,0.95) 100%); transform: perspective(900px) rotateX(48deg); transform-origin: bottom; z-index:1 }
.planks { position:absolute; bottom:0; left:0; right:0; height:38%; background-image: repeating-linear-gradient(90deg, rgba(255,220,160,0.04) 0px, rgba(255,220,160,0.04) 2px, transparent 2px, transparent 60px); transform: perspective(900px) rotateX(48deg); transform-origin: bottom; z-index:2; opacity:0.6 }
.lightpool { position:absolute; top:30%; left:50%; width:70vw; height:55vh; transform: translateX(-50%); background: radial-gradient(ellipse, rgba(255,198,120,0.20) 0%, rgba(255,198,120,0.08) 35%, transparent 70%); z-index:4; mix-blend-mode:screen }
.projector { position:absolute; top:5%; left:50%; width:min(600px,46vw); height:min(200px,26vh); transform:translateX(-50%); padding:4px; border-radius:14px; background: linear-gradient(135deg,#f6d365 0%,#c9a040 30%,#8b6914 55%,#d4af37 100%); box-shadow: 0 8px 24px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.2); z-index:5 }
.projector-inner { width:100%; height:100%; border-radius:10px; background: linear-gradient(180deg, #050810 0%, #0e1626 100%); box-shadow: inset 0 4px 16px rgba(0,0,0,0.75); display:flex; align-items:center; justify-content:center; color: rgba(212,175,55,0.35); font-size:11px; letter-spacing:2px }
.table { position:absolute; left:50%; top:50%; transform: translate(-50%,-40%) perspective(1100px) rotateX(54deg); width:min(78vw,980px); height:auto; pointer-events:none; z-index:4; filter: drop-shadow(0 30px 40px rgba(0,0,0,0.7)) }
.seat { position:absolute; z-index:10 }
.chair { position:absolute; width:96px; height:64px; pointer-events:none; z-index:5 }
.portrait { display:flex; flex-direction:column; align-items:center; gap:8px }
.avatar-wrap { width:120px; height:120px; border-radius:50%; overflow:hidden; border:2.5px solid #D4AF37; background:#0f172a; box-shadow: 0 6px 16px rgba(0,0,0,0.55) }
.avatar-wrap img { display:block; width:100%; height:100%; object-fit:cover }
.label { text-align:center; line-height:1.15; text-shadow: 0 2px 6px rgba(0,0,0,0.85) }
.name { color:#D4AF37; font-weight:700; font-size:14px }
.role { color:#cbd5e1; font-weight:500; font-size:11px; margin-top:1px }
.age { color:#94a3b8; font-weight:400; font-size:10px; margin-top:1px }
`;

const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8"/>
<title>War Room — Luxury Preview</title>
<style>${css}</style>
</head>
<body>
<div class="room">
  <div class="pattern"></div>
  <div class="wall-l"></div>
  <div class="wall-r"></div>
  <div class="ceiling"></div>
  <div class="floor"></div>
  <div class="planks"></div>
  <div class="lightpool"></div>
  <div class="projector"><div class="projector-inner">●</div></div>
  <svg class="table" viewBox="0 0 800 420" preserveAspectRatio="xMidYMid meet" aria-hidden>
    <defs>
      <linearGradient id="wood-top" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#5c3924"/><stop offset="40%" stop-color="#3d2817"/><stop offset="100%" stop-color="#1d120a"/></linearGradient>
      <linearGradient id="wood-edge" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#7a4a2c"/><stop offset="50%" stop-color="#5c3924"/><stop offset="100%" stop-color="#7a4a2c"/></linearGradient>
      <linearGradient id="glass-sheen" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="rgba(255,255,255,0.22)"/><stop offset="55%" stop-color="rgba(255,255,255,0.04)"/><stop offset="100%" stop-color="rgba(255,255,255,0.0)"/></linearGradient>
      <pattern id="grain" x="0" y="0" width="120" height="14" patternUnits="userSpaceOnUse"><path d="M0 7 Q 30 4, 60 7 T 120 7" stroke="rgba(255,200,140,0.12)" stroke-width="0.6" fill="none"/><path d="M0 11 Q 40 8, 80 11 T 120 11" stroke="rgba(255,200,140,0.08)" stroke-width="0.4" fill="none"/></pattern>
    </defs>
    <path d="M 110 90 L 690 90 Q 712 90 712 112 L 712 310 Q 712 332 690 332 L 545 332 Q 545 210 400 210 Q 255 210 255 332 L 110 332 Q 88 332 88 310 L 88 112 Q 88 90 110 90 Z" fill="url(#wood-top)" stroke="url(#wood-edge)" stroke-width="3"/>
    <path d="M 110 90 L 690 90 Q 712 90 712 112 L 712 310 Q 712 332 690 332 L 545 332 Q 545 210 400 210 Q 255 210 255 332 L 110 332 Q 88 332 88 310 L 88 112 Q 88 90 110 90 Z" fill="url(#grain)" opacity="0.55"/>
    <path d="M 110 90 L 690 90 Q 712 90 712 112 L 712 200 L 88 200 L 88 112 Q 88 90 110 90 Z" fill="url(#glass-sheen)"/>
    <path d="M 110 90 L 690 90" stroke="rgba(212,175,55,0.55)" stroke-width="1.2"/>
  </svg>
  ${chairs.join('\n  ')}
  ${portraits.join('\n  ')}
</div>
</body></html>`;

writeFileSync(join(OUT, 'checkpoint3.html'), html);

// Regenerate avatar SVGs with the new seeds used by agent-avatars.ts
const SEEDS = { faris:'faris-coo-calm', sayed:'sayed-creative-energy', al_mukhadram:'almukhadram-warm-dad', hassan:'hassan-sales-killer', fatima:'fatima-analyst-thoughtful', dhai:'dhai-compliance-stoic', hussein:'hussein-tech-casual', mohammed:'mohammed-finance-formal' };
for (const [id, a] of Object.entries(AGENTS)) {
  const opts = {
    seed: SEEDS[id],
    backgroundColor: [BG[id]],
    backgroundType: ['gradientLinear'],
    hair: [a.hair], beard: [a.beard], beardProbability: a.beardP,
    glasses: [a.glasses], glassesProbability: a.glassesP,
    eyes: [a.eyes], brows: [a.brows], lips: [a.lips], nose: [a.nose],
    body: [a.body], gestureProbability: 0, bodyIconProbability: 0,
  };
  writeFileSync(join(OUT, `${id}.svg`), createAvatar(notionists, opts).toString());
}

console.log(`OK: checkpoint3.html + 8 SVGs written to ${OUT}`);
