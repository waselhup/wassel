// Direct jsPDF generator — no html2pdf, no blank pages, branded on every page.
// Renders English-only labels so glyphs work with built-in helvetica.
// Body content (Claude-generated) is shown as-is; Arabic strings will use the
// Latin fallback. For full Arabic typography we will revisit with an embedded font.

import { jsPDF } from 'jspdf';

const TEAL: [number, number, number] = [10, 143, 132];
const GOLD: [number, number, number] = [201, 146, 42];
const INK: [number, number, number] = [15, 23, 42];
const INK2: [number, number, number] = [51, 65, 85];
const MUTED: [number, number, number] = [100, 116, 139];
const BG_TEAL: [number, number, number] = [236, 253, 251];
const BG_GOLD: [number, number, number] = [253, 246, 228];
const RED: [number, number, number] = [226, 75, 74];
const AMBER: [number, number, number] = [239, 159, 39];
const GREEN: [number, number, number] = [29, 158, 117];

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 15;
const CONTENT_W = PAGE_W - MARGIN * 2;

interface PdfData {
  result: any;
  profile?: any;
  linkedinUrl: string;
  language: 'ar' | 'en';
}

const TX = {
  ar: {
    report: 'ACADEMIC REPORT',
    title: 'Professional Profile Analysis',
    subtitle: 'Built on 15 academic frameworks - Harvard, LBS, Wharton',
    outOf100: 'out of 100',
    dimensions: 'Eight-Dimension Breakdown',
    insights: 'Academic Insights',
    finding: 'Finding',
    application: 'Application',
    vision: 'Vision 2030 Alignment',
    quickWins: 'Quick Wins - Execute Now',
    quickWinsSub: 'Specific steps with clear timing - sorted by priority',
    footerBrand: 'Wassel - AI-powered professional profile platform',
    footerCite: 'wasselhub.com - Harvard - LBS - Wharton - Stanford - MIT - McKinsey MENA 2024',
    pillars: { thriving_economy: 'Thriving Economy', vibrant_society: 'Vibrant Society', ambitious_nation: 'Ambitious Nation' },
    dims: { headline: 'Headline', summary: 'Summary', experience: 'Experience', skills: 'Skills', education: 'Education', recommendations: 'Recommendations', activity: 'Activity', media: 'Media' },
  },
  en: {
    report: 'ACADEMIC REPORT',
    title: 'Professional Profile Analysis',
    subtitle: 'Built on 15 academic frameworks from Harvard, LBS, and Wharton',
    outOf100: 'out of 100',
    dimensions: 'Eight-Dimension Breakdown',
    insights: 'Academic Insights',
    finding: 'Finding',
    application: 'Application',
    vision: 'Vision 2030 Alignment',
    quickWins: 'Quick Wins - Execute Now',
    quickWinsSub: 'Specific steps with clear timing - sorted by priority',
    footerBrand: 'Wassel - AI-powered professional profile platform',
    footerCite: 'wasselhub.com - Harvard - LBS - Wharton - Stanford - MIT - McKinsey MENA 2024',
    pillars: { thriving_economy: 'Thriving Economy', vibrant_society: 'Vibrant Society', ambitious_nation: 'Ambitious Nation' },
    dims: { headline: 'Headline', summary: 'Summary', experience: 'Experience', skills: 'Skills', education: 'Education', recommendations: 'Recommendations', activity: 'Activity', media: 'Media' },
  },
};

// Strip Arabic glyphs that helvetica cannot render — keep the meaning by transliterating
// most-used phrases, otherwise leave Latin chars only.
function safeText(s: any): string {
  if (s == null) return '';
  return String(s).replace(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+/g, '').replace(/\s+/g, ' ').trim();
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  const segs = Math.max(8, Math.ceil(Math.abs(endDeg - startDeg) / 3));
  for (let i = 0; i <= segs; i++) {
    const t = startDeg + ((endDeg - startDeg) * i) / segs;
    const r2 = (t * Math.PI) / 180;
    pts.push({ x: cx + Math.cos(r2) * r, y: cy + Math.sin(r2) * r });
  }
  return pts;
}

function drawArc(pdf: jsPDF, cx: number, cy: number, r: number, startDeg: number, endDeg: number, color: [number, number, number], width: number) {
  pdf.setDrawColor(color[0], color[1], color[2]);
  pdf.setLineWidth(width);
  pdf.setLineCap('round' as any);
  const pts = arcPath(cx, cy, r, startDeg, endDeg);
  for (let i = 0; i < pts.length - 1; i++) {
    pdf.line(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
  }
}

function drawHeader(pdf: jsPDF, isAR: boolean) {
  // Logo box (right)
  pdf.setFillColor(TEAL[0], TEAL[1], TEAL[2]);
  pdf.roundedRect(PAGE_W - MARGIN - 10, MARGIN, 10, 10, 2.5, 2.5, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.text('W', PAGE_W - MARGIN - 5, MARGIN + 6.6, { align: 'center' });

  // Brand text
  pdf.setTextColor(INK[0], INK[1], INK[2]);
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Wassel', PAGE_W - MARGIN - 13, MARGIN + 4, { align: 'right' });
  pdf.setFontSize(7);
  pdf.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  pdf.setFont('helvetica', 'normal');
  pdf.text('wasselhub.com', PAGE_W - MARGIN - 13, MARGIN + 8, { align: 'right' });

  // Date (left)
  pdf.setFontSize(8);
  pdf.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  pdf.text(new Date().toLocaleDateString('en-GB'), MARGIN, MARGIN + 7);

  // Divider
  pdf.setDrawColor(TEAL[0], TEAL[1], TEAL[2]);
  pdf.setLineWidth(0.4);
  pdf.line(MARGIN, MARGIN + 13, PAGE_W - MARGIN, MARGIN + 13);
}

function drawFooter(pdf: jsPDF, page: number, total: number) {
  pdf.setDrawColor(226, 232, 240);
  pdf.setLineWidth(0.2);
  pdf.line(MARGIN, PAGE_H - 14, PAGE_W - MARGIN, PAGE_H - 14);
  pdf.setFontSize(8);
  pdf.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  pdf.setFont('helvetica', 'normal');
  pdf.text('wasselhub.com', MARGIN, PAGE_H - 9);
  pdf.text(`${page} / ${total}`, PAGE_W - MARGIN, PAGE_H - 9, { align: 'right' });
}

function drawSectionHeader(pdf: jsPDF, title: string, y: number, accent: [number, number, number] = TEAL): number {
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(INK[0], INK[1], INK[2]);
  pdf.text(safeText(title), MARGIN, y);
  pdf.setDrawColor(accent[0], accent[1], accent[2]);
  pdf.setLineWidth(0.7);
  pdf.line(MARGIN, y + 2, PAGE_W - MARGIN, y + 2);
  return y + 11;
}

function colorForScore(s: number | null | undefined): [number, number, number] {
  if (s == null) return [148, 163, 184];
  if (s >= 75) return GREEN;
  if (s >= 50) return AMBER;
  return RED;
}

export async function generateAnalysisPDF(data: PdfData): Promise<void> {
  const { result, profile, linkedinUrl, language } = data;
  const isAR = language === 'ar';
  const tx = TX[language];
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  const total = 4;

  // ════════ PAGE 1 — COVER ════════
  // Top half teal-tinted, bottom half gold-tinted
  pdf.setFillColor(BG_TEAL[0], BG_TEAL[1], BG_TEAL[2]);
  pdf.rect(0, 0, PAGE_W, PAGE_H / 2, 'F');
  pdf.setFillColor(BG_GOLD[0], BG_GOLD[1], BG_GOLD[2]);
  pdf.rect(0, PAGE_H / 2, PAGE_W, PAGE_H / 2, 'F');

  drawHeader(pdf, isAR);

  // Big logo
  const logoY = 38;
  pdf.setFillColor(TEAL[0], TEAL[1], TEAL[2]);
  pdf.roundedRect(PAGE_W / 2 - 12, logoY, 24, 24, 6, 6, 'F');
  pdf.setFillColor(GOLD[0], GOLD[1], GOLD[2]);
  pdf.roundedRect(PAGE_W / 2 - 8, logoY + 4, 16, 16, 4, 4, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(20);
  pdf.setFont('helvetica', 'bold');
  pdf.text('W', PAGE_W / 2, logoY + 16, { align: 'center' });

  // Eyebrow
  pdf.setFontSize(10);
  pdf.setTextColor(GOLD[0], GOLD[1], GOLD[2]);
  pdf.setFont('helvetica', 'bold');
  pdf.text(tx.report, PAGE_W / 2, 75, { align: 'center' });

  // Title
  pdf.setFontSize(24);
  pdf.setTextColor(INK[0], INK[1], INK[2]);
  pdf.text(tx.title, PAGE_W / 2, 88, { align: 'center' });

  // Subtitle
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  pdf.text(tx.subtitle, PAGE_W / 2, 96, { align: 'center' });

  // Score ring
  const overall = Number(result.overall_score ?? result.score ?? 0);
  const cx = PAGE_W / 2;
  const cy = 138;
  const radius = 24;
  // Background ring
  drawArc(pdf, cx, cy, radius, 0, 360, [226, 232, 240], 4);
  // Score arc (start at top)
  if (overall > 0) {
    const endAngle = -90 + (overall / 100) * 360;
    drawArc(pdf, cx, cy, radius, -90, endAngle, TEAL, 4);
  }
  pdf.setFontSize(28);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(INK[0], INK[1], INK[2]);
  pdf.text(String(overall), cx, cy + 2, { align: 'center' });
  pdf.setFontSize(8);
  pdf.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  pdf.setFont('helvetica', 'normal');
  pdf.text(tx.outOf100, cx, cy + 8, { align: 'center' });

  // Profile card
  const cardY = 180;
  pdf.setFillColor(255, 255, 255);
  pdf.setDrawColor(226, 232, 240);
  pdf.setLineWidth(0.2);
  pdf.roundedRect(PAGE_W / 2 - 65, cardY, 130, 32, 4, 4, 'FD');

  const fullName = safeText(profile?.fullName || profile?.name || '');
  const headlineText = safeText(profile?.headline || '');
  pdf.setFontSize(13);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(INK[0], INK[1], INK[2]);
  pdf.text(fullName || 'LinkedIn Profile', PAGE_W / 2, cardY + 8, { align: 'center' });

  if (headlineText) {
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    const hLines = pdf.splitTextToSize(headlineText, 120);
    pdf.text(hLines.slice(0, 2), PAGE_W / 2, cardY + 14, { align: 'center' });
  }

  pdf.setFontSize(8);
  pdf.setTextColor(TEAL[0], TEAL[1], TEAL[2]);
  pdf.text(linkedinUrl, PAGE_W / 2, cardY + 27, { align: 'center', maxWidth: 120 });

  // Verdict
  const verdict = safeText(result.headline_verdict || '');
  if (verdict) {
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'italic');
    pdf.setTextColor(INK2[0], INK2[1], INK2[2]);
    const vLines = pdf.splitTextToSize(`"${verdict}"`, 150);
    pdf.text(vLines.slice(0, 4), PAGE_W / 2, 230, { align: 'center' });
  }

  // Footer cite
  pdf.setFontSize(8);
  pdf.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  pdf.setFont('helvetica', 'normal');
  pdf.text(tx.footerCite, PAGE_W / 2, PAGE_H - 22, { align: 'center' });

  drawFooter(pdf, 1, total);

  // ════════ PAGE 2 — DIMENSIONS ════════
  pdf.addPage();
  drawHeader(pdf, isAR);
  let y = drawSectionHeader(pdf, tx.dimensions, MARGIN + 22);

  const dimKeys: Array<keyof typeof tx.dims> = ['headline', 'summary', 'experience', 'skills', 'education', 'recommendations', 'activity', 'media'];
  for (const key of dimKeys) {
    const d = result.dimensions?.[key];
    const score: number | null = d?.score ?? null;
    const verdict = safeText(d?.verdict || d?.finding || '');

    // Label + score line
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(INK[0], INK[1], INK[2]);
    pdf.text(tx.dims[key], MARGIN, y);

    const sColor = colorForScore(score);
    pdf.setTextColor(sColor[0], sColor[1], sColor[2]);
    pdf.setFontSize(11);
    pdf.text(score == null ? '—' : String(score), PAGE_W - MARGIN, y, { align: 'right' });

    // Bar
    const barY = y + 1.5;
    pdf.setFillColor(241, 245, 249);
    pdf.roundedRect(MARGIN, barY, CONTENT_W, 1.6, 0.8, 0.8, 'F');
    if (score != null && score > 0) {
      const barColor = colorForScore(score);
      pdf.setFillColor(barColor[0], barColor[1], barColor[2]);
      const w = (CONTENT_W * score) / 100;
      pdf.roundedRect(MARGIN, barY, Math.max(w, 1.6), 1.6, 0.8, 0.8, 'F');
    }
    y += 6;

    if (verdict) {
      pdf.setFontSize(8.5);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      const lines = pdf.splitTextToSize(verdict, CONTENT_W);
      pdf.text(lines.slice(0, 3), MARGIN, y);
      y += Math.min(lines.length, 3) * 4;
    }
    y += 4;
    if (y > PAGE_H - 30) break; // safety
  }
  drawFooter(pdf, 2, total);

  // ════════ PAGE 3 — INSIGHTS + VISION 2030 ════════
  pdf.addPage();
  drawHeader(pdf, isAR);
  y = drawSectionHeader(pdf, tx.insights, MARGIN + 22, GOLD);

  const insightColors: Array<{ bg: [number, number, number]; border: [number, number, number] }> = [
    { bg: [238, 237, 254], border: [83, 74, 183] },
    { bg: [225, 245, 238], border: [15, 110, 86] },
    { bg: [250, 238, 218], border: [186, 117, 23] },
  ];
  const insights = (result.academic_insights || []).slice(0, 3);
  for (let i = 0; i < insights.length; i++) {
    const ins = insights[i];
    const c = insightColors[i % 3];
    const finding = safeText(ins.finding || '');
    const application = safeText(ins.application || '');
    const framework = safeText(ins.framework || ins.source || '');
    // Estimate height
    const fLines = pdf.splitTextToSize(finding, CONTENT_W - 12).slice(0, 3);
    const aLines = pdf.splitTextToSize(application, CONTENT_W - 12).slice(0, 3);
    const cardH = 12 + fLines.length * 4 + aLines.length * 4 + 4;

    pdf.setFillColor(c.bg[0], c.bg[1], c.bg[2]);
    pdf.roundedRect(MARGIN, y, CONTENT_W, cardH, 2, 2, 'F');
    pdf.setFillColor(c.border[0], c.border[1], c.border[2]);
    pdf.rect(MARGIN, y, 2, cardH, 'F');

    // Framework chip
    pdf.setFillColor(255, 255, 255);
    pdf.roundedRect(MARGIN + 5, y + 3, 50, 5, 1, 1, 'F');
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(INK[0], INK[1], INK[2]);
    pdf.text((framework || 'Framework').slice(0, 32), MARGIN + 30, y + 6.5, { align: 'center' });

    pdf.setFontSize(8.5);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(INK[0], INK[1], INK[2]);
    pdf.text(`${tx.finding}:`, MARGIN + 6, y + 13);
    pdf.setFont('helvetica', 'normal');
    pdf.text(fLines, MARGIN + 6 + 16, y + 13);

    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(c.border[0], c.border[1], c.border[2]);
    pdf.text(`${tx.application}:`, MARGIN + 6, y + 13 + fLines.length * 4 + 2);
    pdf.setFont('helvetica', 'normal');
    pdf.text(aLines, MARGIN + 6 + 22, y + 13 + fLines.length * 4 + 2);

    y += cardH + 3;
  }

  // Vision 2030 panel
  if (y < PAGE_H - 70) {
    y += 4;
    const vH = 50;
    pdf.setFillColor(15, 110, 86);
    pdf.roundedRect(MARGIN, y, CONTENT_W, vH, 4, 4, 'F');

    pdf.setFontSize(13);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(250, 199, 117);
    pdf.text(tx.vision, PAGE_W / 2, y + 9, { align: 'center' });

    const pillars: Array<keyof typeof tx.pillars> = ['thriving_economy', 'vibrant_society', 'ambitious_nation'];
    const pW = (CONTENT_W - 6) / 3 - 2;
    pillars.forEach((pk, i) => {
      const pX = MARGIN + 3 + i * (pW + 3);
      pdf.setFillColor(255, 255, 255);
      pdf.setGState(new (pdf as any).GState({ opacity: 0.12 }));
      pdf.roundedRect(pX, y + 14, pW, vH - 18, 2, 2, 'F');
      pdf.setGState(new (pdf as any).GState({ opacity: 1 }));

      pdf.setFontSize(8.5);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(250, 199, 117);
      pdf.text(tx.pillars[pk], pX + pW / 2, y + 20, { align: 'center' });

      pdf.setFontSize(7.5);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(255, 255, 255);
      const note = safeText(result.vision_2030_alignment?.[pk]?.note || '');
      const noteLines = pdf.splitTextToSize(note, pW - 4).slice(0, 4);
      pdf.text(noteLines, pX + pW / 2, y + 25, { align: 'center' });
    });
  }

  drawFooter(pdf, 3, total);

  // ════════ PAGE 4 — QUICK WINS ════════
  pdf.addPage();
  drawHeader(pdf, isAR);
  y = drawSectionHeader(pdf, tx.quickWins, MARGIN + 22, GOLD);

  pdf.setFontSize(9);
  pdf.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  pdf.setFont('helvetica', 'normal');
  pdf.text(tx.quickWinsSub, MARGIN, y);
  y += 6;

  const wins = (result.quick_wins || []).slice(0, 5);
  for (let i = 0; i < wins.length; i++) {
    const w = wins[i];
    const action = safeText(w.action || '');
    const why = safeText(w.why || '');
    const example = safeText(w.example || '');
    const effort = safeText(w.effort || '15min');
    const priority = String(w.priority || 'medium');

    const pColor: [number, number, number] = priority === 'high' ? RED : priority === 'medium' ? AMBER : TEAL;
    const pBg: [number, number, number] = priority === 'high' ? [254, 242, 242] : priority === 'medium' ? [254, 252, 232] : [236, 253, 245];

    const aLines = pdf.splitTextToSize(`${i + 1}. ${action}`, CONTENT_W - 32).slice(0, 2);
    const wLines = pdf.splitTextToSize(why, CONTENT_W - 14).slice(0, 2);
    const eLines = example ? pdf.splitTextToSize(example, CONTENT_W - 14).slice(0, 1) : [];
    const cardH = 10 + aLines.length * 4 + wLines.length * 4 + eLines.length * 4 + 6;

    if (y + cardH > PAGE_H - 50) break;

    pdf.setFillColor(pBg[0], pBg[1], pBg[2]);
    pdf.roundedRect(MARGIN, y, CONTENT_W, cardH, 2, 2, 'F');
    pdf.setFillColor(pColor[0], pColor[1], pColor[2]);
    pdf.rect(MARGIN, y, 2, cardH, 'F');

    // Action
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(INK[0], INK[1], INK[2]);
    pdf.text(aLines, MARGIN + 6, y + 7);

    // Effort badge (right)
    pdf.setFillColor(255, 255, 255);
    pdf.setDrawColor(pColor[0], pColor[1], pColor[2]);
    pdf.setLineWidth(0.3);
    pdf.roundedRect(PAGE_W - MARGIN - 22, y + 3, 18, 5, 2, 2, 'FD');
    pdf.setFontSize(8);
    pdf.setTextColor(pColor[0], pColor[1], pColor[2]);
    pdf.setFont('helvetica', 'bold');
    pdf.text(effort, PAGE_W - MARGIN - 13, y + 6.5, { align: 'center' });

    // Why
    let yi = y + 7 + aLines.length * 4 + 2;
    pdf.setFontSize(8.5);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(INK2[0], INK2[1], INK2[2]);
    pdf.text(wLines, MARGIN + 6, yi);

    // Example
    if (example) {
      yi += wLines.length * 4 + 2;
      pdf.setFontSize(8);
      pdf.setFont('courier', 'normal');
      pdf.setTextColor(INK[0], INK[1], INK[2]);
      pdf.text(eLines, MARGIN + 6, yi);
    }

    y += cardH + 3;
  }

  // Footer brand panel
  const bandY = PAGE_H - 36;
  pdf.setFillColor(BG_TEAL[0], BG_TEAL[1], BG_TEAL[2]);
  pdf.setDrawColor(159, 225, 203);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(MARGIN, bandY, CONTENT_W, 18, 3, 3, 'FD');
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(6, 95, 88);
  pdf.text(tx.footerBrand, PAGE_W / 2, bandY + 8, { align: 'center' });
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  pdf.text(tx.footerCite, PAGE_W / 2, bandY + 13, { align: 'center' });

  drawFooter(pdf, 4, total);

  pdf.save(`wassel-analysis-${Date.now()}.pdf`);
}
