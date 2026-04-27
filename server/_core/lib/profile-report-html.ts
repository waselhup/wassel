/**
 * Branded HTML report template for the profile analysis export.
 *
 * Outputs a self-contained HTML document (Cairo variable font embedded
 * as a data URI to avoid the Google Fonts network hop at render time —
 * Vercel cold-starts can otherwise race the font load) with inline
 * styles, suitable for `puppeteer.setContent()`. The same data shape
 * is consumed by the DOCX generator so the two outputs stay in lockstep
 * visually and editorially.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { ReportOptions } from './profile-report-generator';

// Load Cairo at module-init time. ~600KB embedded once per cold start.
// We probe several locations because the bundled CJS file (api/index.js)
// and the dev TS file end up in very different cwd contexts:
//   - dev (tsx):    .../server/_core/lib/profile-report-html.ts → __dirname is server/_core/lib
//   - prod Vercel:  .../api/index.js with cwd = /var/task → look for /var/task/api/fonts
//   - prod local:   process.cwd() = repo root → look for server/_core/lib/fonts
let CAIRO_DATA_URI = '';
function tryLoadCairo(): Buffer | null {
  const candidates: string[] = [];
  // ESM __dirname (TS dev mode)
  try {
    const dir = typeof __dirname !== 'undefined'
      ? __dirname
      : dirname(fileURLToPath(import.meta.url));
    candidates.push(join(dir, 'fonts', 'Cairo.ttf'));
  } catch { /* swallow */ }
  // Vercel deploy: /var/task/api/fonts/Cairo.ttf
  candidates.push(join(process.cwd(), 'api', 'fonts', 'Cairo.ttf'));
  // Local repo root
  candidates.push(join(process.cwd(), 'server', '_core', 'lib', 'fonts', 'Cairo.ttf'));
  // Sibling of bundle (api/index.js + api/fonts/Cairo.ttf)
  candidates.push(join(process.cwd(), 'fonts', 'Cairo.ttf'));

  for (const p of candidates) {
    try {
      return readFileSync(p);
    } catch { /* try next */ }
  }
  return null;
}
const cairoBuf = tryLoadCairo();
if (cairoBuf) {
  CAIRO_DATA_URI = `data:font/ttf;base64,${cairoBuf.toString('base64')}`;
} else {
  console.warn('[profile-report-html] Cairo.ttf not found — Chromium will use system Arabic fallback');
}

const ESCAPE: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
};

function esc(s: string | null | undefined): string {
  if (s === null || s === undefined) return '';
  return String(s).replace(/[&<>"']/g, (c) => ESCAPE[c] ?? c);
}

function scoreColor(score: number | null | undefined): string {
  if (typeof score !== 'number') return '#64748b';
  if (score >= 70) return '#16a34a';
  if (score >= 50) return '#ca8a04';
  return '#dc2626';
}

function gradeFor(score: number | null | undefined, lang: 'ar' | 'en'): string {
  if (typeof score !== 'number') return lang === 'ar' ? 'غير مقيّم' : 'Unrated';
  if (score >= 90) return lang === 'ar' ? 'استثنائي' : 'Outstanding';
  if (score >= 80) return lang === 'ar' ? 'ممتاز' : 'Excellent';
  if (score >= 70) return lang === 'ar' ? 'جيد جداً' : 'Very good';
  if (score >= 60) return lang === 'ar' ? 'جيد' : 'Good';
  if (score >= 50) return lang === 'ar' ? 'مقبول' : 'Fair';
  return lang === 'ar' ? 'يحتاج تحسيناً' : 'Needs improvement';
}

const SECTION_LABELS: Record<string, { ar: string; en: string }> = {
  headline: { ar: 'العنوان الرئيسي', en: 'Headline' },
  about: { ar: 'نبذة عني', en: 'About' },
  experience: { ar: 'الخبرات', en: 'Experience' },
  skills: { ar: 'المهارات', en: 'Skills' },
  education: { ar: 'التعليم', en: 'Education' },
  recommendations: { ar: 'التوصيات', en: 'Recommendations' },
  activity: { ar: 'النشاط', en: 'Activity' },
  profile_completeness: { ar: 'اكتمال البروفايل', en: 'Profile completeness' },
  stranger_legibility: { ar: 'وضوح البروفايل للغرباء', en: 'Stranger legibility' },
  discoverability: { ar: 'قابلية الاكتشاف', en: 'Discoverability' },
  ats_readiness: { ar: 'جاهزية ATS', en: 'ATS readiness' },
  skills_architecture: { ar: 'هيكلية المهارات', en: 'Skills architecture' },
  social_proof: { ar: 'الإثبات الاجتماعي', en: 'Social proof' },
  narrative_coherence: { ar: 'ترابط السرد', en: 'Narrative coherence' },
};

function sectionLabel(key: string, lang: 'ar' | 'en', explicitAr?: string, explicitEn?: string): string {
  const fromMap = SECTION_LABELS[key.toLowerCase()];
  if (lang === 'ar') return explicitAr || fromMap?.ar || key;
  return explicitEn || fromMap?.en || key;
}

function effortLabel(effort: string | undefined, lang: 'ar' | 'en'): string {
  if (!effort) return '';
  const map: Record<string, { ar: string; en: string }> = {
    quick:    { ar: 'سريع',     en: 'Quick' },
    moderate: { ar: 'متوسط',    en: 'Moderate' },
    deep:     { ar: 'عميق',     en: 'Deep' },
  };
  const e = map[effort.toLowerCase()];
  if (!e) return effort;
  return lang === 'ar' ? e.ar : e.en;
}

function effortColor(effort: string | undefined): string {
  switch (effort?.toLowerCase()) {
    case 'quick':    return '#16a34a';
    case 'moderate': return '#ca8a04';
    case 'deep':     return '#dc2626';
    default:         return '#64748b';
  }
}

export function buildAnalysisReportHtml(opts: ReportOptions): string {
  const { language, analysisData, userName, targetGoal, industry, targetRole, targetCompany } = opts;
  const isAr = language === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';
  const fontStack = isAr
    ? `'Cairo', 'Tajawal', 'Helvetica Neue', Arial, sans-serif`
    : `'Inter', 'Helvetica Neue', Arial, sans-serif`;

  const overall = analysisData.overall_score;
  const verdict = analysisData.verdict || '';
  const sections = (analysisData.sections && analysisData.sections.length)
    ? analysisData.sections
    : (analysisData.dimensions || []).map((d) => ({
        key: d.name,
        score: d.score,
        framework: d.framework,
        framework_label: d.framework_label,
        assessment: d.observations?.[0]?.what || d.feedback,
        current: d.recommendations?.[0]?.current,
        suggested: d.recommendations?.[0]?.suggested,
        why: d.observations?.[0]?.why || d.recommendations?.[0]?.rationale,
      }));

  const priorities = (analysisData.top_priorities && analysisData.top_priorities.length)
    ? analysisData.top_priorities
    : null;

  const generatedAt = new Date().toLocaleDateString(isAr ? 'ar-SA' : 'en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const L = isAr ? {
    title: 'تقرير تحليل البروفايل المهني',
    subtitle: 'تحليل ذكي مدعوم بمنصة وصّل',
    score: 'الدرجة الإجمالية',
    grade: 'التصنيف',
    generatedOn: 'تاريخ الإنشاء',
    profileFor: 'البروفايل',
    target: 'الهدف',
    industry: 'المجال',
    targetRole: 'الدور المستهدف',
    targetCompany: 'الشركة المستهدفة',
    executiveSummary: 'الملخص التنفيذي',
    topPriorities: 'الأولويات الكبرى',
    sectionsTitle: 'تحليل تفصيلي للأقسام',
    section: 'القسم',
    sectionScore: 'الدرجة',
    framework: 'الإطار',
    effort: 'الجهد',
    assessment: 'التقييم',
    current: 'الحالي',
    suggested: 'المقترح',
    why: 'المبرر',
    actionPlan: 'خطة العمل',
    immediate: 'فوراً (هذا الأسبوع)',
    shortTerm: 'قريباً (شهر)',
    longTerm: 'لاحقاً (٣ أشهر)',
    expectedImpact: 'الأثر المتوقع',
    rank: '#',
    action: 'الإجراء',
    impact: 'الأثر',
    footer: 'تم إنشاؤه بواسطة منصّة وصّل · wasselhub.com',
  } : {
    title: 'Professional Profile Analysis Report',
    subtitle: 'AI-powered analysis by Wassel',
    score: 'Overall Score',
    grade: 'Grade',
    generatedOn: 'Generated',
    profileFor: 'Profile',
    target: 'Goal',
    industry: 'Industry',
    targetRole: 'Target role',
    targetCompany: 'Target company',
    executiveSummary: 'Executive Summary',
    topPriorities: 'Top Priorities',
    sectionsTitle: 'Detailed Section Analysis',
    section: 'Section',
    sectionScore: 'Score',
    framework: 'Framework',
    effort: 'Effort',
    assessment: 'Assessment',
    current: 'Current',
    suggested: 'Suggested',
    why: 'Why',
    actionPlan: 'Action Plan',
    immediate: 'Immediate (this week)',
    shortTerm: 'Short term (this month)',
    longTerm: 'Long term (3 months)',
    expectedImpact: 'Expected impact',
    rank: '#',
    action: 'Action',
    impact: 'Impact',
    footer: 'Generated by Wassel · wasselhub.com',
  };

  const grade = gradeFor(overall, language);
  const ovColor = scoreColor(overall);

  // ───────────────────────────── COVER ─────────────────────────────
  const coverHtml = `
    <section class="cover">
      <div class="brand">
        <div class="brand-mark">و</div>
        <div class="brand-text">${isAr ? 'وصّل' : 'Wassel'}</div>
      </div>
      <h1 class="title">${esc(L.title)}</h1>
      <p class="subtitle">${esc(L.subtitle)}</p>
      <div class="score-card">
        <div class="score-ring" style="--score-color:${ovColor};--score-pct:${Math.max(0, Math.min(100, overall))}">
          <span class="score-value">${overall}</span>
          <span class="score-of">/100</span>
        </div>
        <div class="score-meta">
          <div class="grade" style="background:${ovColor}1a;color:${ovColor};">${esc(grade)}</div>
          <div class="cover-row"><span>${esc(L.profileFor)}</span><strong>${esc(userName || '—')}</strong></div>
          <div class="cover-row"><span>${esc(L.target)}</span><strong>${esc(targetGoal || '—')}</strong></div>
          <div class="cover-row"><span>${esc(L.industry)}</span><strong>${esc(industry || '—')}</strong></div>
          ${targetRole ? `<div class="cover-row"><span>${esc(L.targetRole)}</span><strong>${esc(targetRole)}</strong></div>` : ''}
          ${targetCompany ? `<div class="cover-row"><span>${esc(L.targetCompany)}</span><strong>${esc(targetCompany)}</strong></div>` : ''}
          <div class="cover-row"><span>${esc(L.generatedOn)}</span><strong>${esc(generatedAt)}</strong></div>
        </div>
      </div>
    </section>`;

  // ──────────────────── EXECUTIVE SUMMARY ────────────────────
  const summaryHtml = `
    <section class="block">
      <h2>${esc(L.executiveSummary)}</h2>
      <p class="lead">${esc(verdict)}</p>
    </section>`;

  // ──────────────────── TOP PRIORITIES TABLE ────────────────────
  let prioritiesHtml = '';
  if (priorities && priorities.length) {
    const rows = priorities.map((p, i) => {
      const rank = p.rank ?? i + 1;
      const action = p.action || '';
      const impact = p.expected_impact || '';
      const fw = p.framework_label || p.framework || '';
      return `<tr>
        <td class="num">${rank}</td>
        <td><strong>${esc(action)}</strong>${fw ? `<div class="meta">${esc(fw)}</div>` : ''}</td>
        <td class="impact">${esc(impact)}</td>
      </tr>`;
    }).join('');
    prioritiesHtml = `
      <section class="block">
        <h2>${esc(L.topPriorities)}</h2>
        <table class="priorities">
          <thead><tr>
            <th class="num">${esc(L.rank)}</th>
            <th>${esc(L.action)}</th>
            <th>${esc(L.impact)}</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </section>`;
  } else if (analysisData.top_3_priorities && analysisData.top_3_priorities.length) {
    const items = analysisData.top_3_priorities.map((p) => `<li>${esc(p)}</li>`).join('');
    prioritiesHtml = `
      <section class="block">
        <h2>${esc(L.topPriorities)}</h2>
        <ol class="priorities-list">${items}</ol>
      </section>`;
  }

  // ──────────────────── SECTIONS ────────────────────
  const sectionsHtml = sections.length
    ? `<section class="block">
        <h2>${esc(L.sectionsTitle)}</h2>
        ${sections.map((s) => {
          const name = sectionLabel(String(s.key), language, (s as any).name_ar, (s as any).name_en);
          const sc = typeof s.score === 'number' ? s.score : null;
          const scText = sc === null ? '—' : `${sc}/100`;
          const c = scoreColor(sc);
          const widthPct = sc === null ? 0 : Math.max(0, Math.min(100, sc));
          const fw = (s as any).framework_label || (s as any).framework || '';
          const eff = (s as any).effort as string | undefined;
          const effLbl = effortLabel(eff, language);
          const effClr = effortColor(eff);
          return `<article class="section-card">
            <header class="section-head">
              <div class="section-title">
                <h3>${esc(name)}</h3>
                ${fw ? `<span class="chip">${esc(fw)}</span>` : ''}
                ${effLbl ? `<span class="chip" style="background:${effClr}1a;color:${effClr};border-color:${effClr}33">${esc(L.effort)} · ${esc(effLbl)}</span>` : ''}
              </div>
              <div class="section-score" style="color:${c}">${esc(scText)}</div>
            </header>
            <div class="section-bar"><span style="background:${c};width:${widthPct}%"></span></div>
            ${(s as any).assessment ? `<p class="lead small">${esc((s as any).assessment)}</p>` : ''}
            ${(s as any).current ? `<div class="kv"><span class="k">${esc(L.current)}</span><div class="v">${esc((s as any).current)}</div></div>` : ''}
            ${(s as any).suggested ? `<div class="kv good"><span class="k">${esc(L.suggested)}</span><div class="v">${esc((s as any).suggested)}</div></div>` : ''}
            ${(s as any).why ? `<div class="kv muted"><span class="k">${esc(L.why)}</span><div class="v">${esc((s as any).why)}</div></div>` : ''}
          </article>`;
        }).join('')}
      </section>`
    : '';

  // ──────────────────── ACTION PLAN ────────────────────
  // Group priorities into 3 horizons by index. If only 3 priorities exist
  // we put them on rows 1/2/3; otherwise we split them evenly.
  let actionHtml = '';
  if (priorities && priorities.length) {
    const horizons = [
      { label: L.immediate, items: [] as string[] },
      { label: L.shortTerm, items: [] as string[] },
      { label: L.longTerm,  items: [] as string[] },
    ];
    priorities.forEach((p, i) => {
      const bucket = Math.min(2, Math.floor((i / priorities.length) * 3));
      horizons[bucket].items.push(p.action || '');
    });
    actionHtml = `
      <section class="block">
        <h2>${esc(L.actionPlan)}</h2>
        <table class="timeline">
          <thead>
            <tr>
              <th>${esc(L.immediate)}</th>
              <th>${esc(L.shortTerm)}</th>
              <th>${esc(L.longTerm)}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              ${horizons.map((h) => `<td><ul>${h.items.map((it) => `<li>${esc(it)}</li>`).join('') || '<li class="muted">—</li>'}</ul></td>`).join('')}
            </tr>
          </tbody>
        </table>
      </section>`;
  }

  // ──────────────────── DOCUMENT ────────────────────
  return `<!DOCTYPE html>
<html lang="${isAr ? 'ar' : 'en'}" dir="${dir}">
<head>
  <meta charset="utf-8" />
  <title>${esc(L.title)}</title>
  <style>
    ${CAIRO_DATA_URI ? `@font-face {
      font-family: 'Cairo';
      font-style: normal;
      font-weight: 400 800;
      font-display: block;
      src: url('${CAIRO_DATA_URI}') format('truetype');
    }` : ''}
    @page { size: A4; margin: 18mm 16mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: ${fontStack};
      color: #0f172a;
      background: #ffffff;
      font-size: 11pt;
      line-height: 1.6;
      direction: ${dir};
    }
    h1, h2, h3 { color: #0f172a; margin: 0; line-height: 1.25; }
    h1 { font-size: 26pt; font-weight: 800; letter-spacing: -0.02em; }
    h2 { font-size: 16pt; font-weight: 700; letter-spacing: -0.01em; margin: 0 0 12px; padding-bottom: 8px; border-bottom: 2px solid #0d9488; }
    h3 { font-size: 12pt; font-weight: 700; }
    p  { margin: 0 0 8px; }

    .cover {
      page-break-after: always;
      padding: 30mm 0 10mm;
      text-align: ${isAr ? 'right' : 'left'};
    }
    .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 22mm; }
    .brand-mark {
      width: 38px; height: 38px; border-radius: 50%;
      background: linear-gradient(135deg, #0d9488, #14b8a6);
      color: #fff; font-weight: 800; font-size: 18pt;
      display: flex; align-items: center; justify-content: center;
    }
    .brand-text { font-weight: 800; font-size: 14pt; color: #0f766e; }
    .title { margin-bottom: 6px; }
    .subtitle { color: #64748b; font-size: 12pt; margin-bottom: 14mm; }

    .score-card {
      display: flex;
      align-items: center;
      gap: 8mm;
      padding: 8mm;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      background: linear-gradient(135deg, #f8fafc, #ffffff);
      ${isAr ? 'flex-direction: row-reverse;' : ''}
    }
    .score-ring {
      width: 36mm; height: 36mm;
      border-radius: 50%;
      background: conic-gradient(var(--score-color) calc(var(--score-pct) * 1%), #e2e8f0 0);
      display: flex; align-items: center; justify-content: center;
      position: relative;
      flex-shrink: 0;
    }
    .score-ring::before {
      content: ''; position: absolute; inset: 4mm;
      background: #fff; border-radius: 50%;
    }
    .score-value, .score-of { position: relative; z-index: 1; }
    .score-value { font-size: 28pt; font-weight: 800; color: var(--score-color); }
    .score-of { font-size: 11pt; color: #64748b; margin-${isAr ? 'right' : 'left'}: 2px; }

    .score-meta { flex: 1; }
    .grade {
      display: inline-block;
      padding: 6px 14px;
      border-radius: 999px;
      font-weight: 700; font-size: 11pt;
      margin-bottom: 8px;
    }
    .cover-row {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 4px 0;
      border-bottom: 1px dashed #e2e8f0;
      font-size: 10pt;
    }
    .cover-row:last-child { border-bottom: 0; }
    .cover-row span { color: #64748b; }
    .cover-row strong { color: #0f172a; font-weight: 700; }

    .block { margin: 14mm 0; page-break-inside: avoid; }
    .lead { font-size: 11pt; color: #334155; line-height: 1.7; }
    .lead.small { font-size: 10pt; }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10pt;
      margin-top: 8px;
    }
    th, td {
      padding: 10px 12px;
      border: 1px solid #e2e8f0;
      vertical-align: top;
      text-align: ${isAr ? 'right' : 'left'};
    }
    thead th {
      background: #0f766e;
      color: #fff;
      font-weight: 700;
      border-color: #0d9488;
    }
    .priorities .num { width: 36px; text-align: center; font-weight: 700; color: #0f766e; }
    .priorities td.impact { color: #475569; }
    .priorities .meta { color: #64748b; font-size: 9pt; margin-top: 4px; }
    .priorities-list { padding-${isAr ? 'right' : 'left'}: 24px; }
    .priorities-list li { padding: 4px 0; }

    .timeline thead th { background: #0d9488; }
    .timeline ul { margin: 0; padding-${isAr ? 'right' : 'left'}: 18px; }
    .timeline li { padding: 2px 0; }
    .timeline .muted { color: #94a3b8; list-style: none; padding-${isAr ? 'right' : 'left'}: 0; }

    .section-card {
      padding: 10mm 8mm;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      margin-bottom: 6mm;
      page-break-inside: avoid;
      background: #fff;
    }
    .section-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 8px; ${isAr ? 'flex-direction: row-reverse;' : ''} }
    .section-title { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
    .section-score { font-size: 16pt; font-weight: 800; }
    .section-bar { height: 5px; background: #f1f5f9; border-radius: 3px; overflow: hidden; margin-bottom: 10px; }
    .section-bar span { display: block; height: 100%; }
    .chip {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 9pt;
      background: #f1f5f9;
      color: #475569;
      border: 1px solid #e2e8f0;
    }
    .kv {
      display: grid;
      grid-template-columns: 90px 1fr;
      gap: 8px;
      padding: 6px 0;
      font-size: 10pt;
      border-top: 1px dashed #e2e8f0;
    }
    .kv .k { color: #64748b; font-weight: 600; }
    .kv.good .v { color: #0f766e; }
    .kv.muted .v { color: #475569; font-style: italic; }

    .footer {
      position: running(footer);
      font-size: 9pt;
      color: #94a3b8;
      text-align: center;
      padding-top: 6mm;
      border-top: 1px solid #e2e8f0;
      margin-top: 14mm;
    }
  </style>
</head>
<body>
  ${coverHtml}
  ${summaryHtml}
  ${prioritiesHtml}
  ${sectionsHtml}
  ${actionHtml}
  <div class="footer">${esc(L.footer)}</div>
</body>
</html>`;
}
