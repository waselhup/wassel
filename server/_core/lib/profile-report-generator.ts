/**
 * Profile-analysis report generator.
 *
 * Two output formats:
 *  - DOCX  (this file's `generateDocxReport`) — Word handles Arabic
 *    rendering correctly out of the box, so we focus on a structured,
 *    branded layout.
 *  - PDF   (delegated to ./arabic-pdf-renderer + ./profile-report-html)
 *    — jsPDF cannot shape Arabic glyphs, so we render an HTML document
 *    in headless Chromium and let the browser do the typography.
 *
 * The two formats consume the same `ReportOptions` shape so they stay
 * in lockstep editorially. Each section in the DOCX mirrors the
 * corresponding HTML block 1:1.
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  HeightRule,
  LevelFormat,
  PageBreak,
} from 'docx';
import { renderHtmlToPdf } from './arabic-pdf-renderer';
import { buildAnalysisReportHtml } from './profile-report-html';

interface AnalysisObservation {
  what?: string;
  why?: string;
  citation?: string;
  impact?: 'high' | 'medium' | 'low';
}

interface AnalysisRecommendation {
  current?: string;
  suggested?: string;
  rationale?: string;
  effort?: 'quick' | 'moderate' | 'deep';
}

interface AnalysisDimension {
  name: string;
  score: number | null;
  framework?: string;
  framework_label?: string | null;
  observations?: AnalysisObservation[];
  recommendations?: AnalysisRecommendation[];
  feedback?: string;
}

interface AnalysisSection {
  key: string;
  name_ar?: string;
  name_en?: string;
  score: number | null;
  assessment?: string;
  current?: string;
  suggested?: string;
  why?: string;
  framework?: string;
  framework_label?: string | null;
  effort?: string;
}

interface TopPriority {
  rank?: number;
  action?: string;
  dimension?: string;
  framework?: string;
  framework_label?: string | null;
  expected_impact?: string;
}

interface AnalysisData {
  overall_score: number;
  confidence?: 'high' | 'medium' | 'low';
  data_completeness?: number;
  verdict: string;
  dimensions?: AnalysisDimension[];
  sections?: AnalysisSection[];
  target_alignment?: { goal_match_score?: number; notes?: string };
  top_priorities?: TopPriority[];
  recommendations?: string[];
  top_3_priorities?: string[];
  evidence_bundle?: {
    profile_quotes_used?: string[];
    frameworks_referenced?: string[];
    missing_data_flags?: string[];
  };
}

export interface ReportOptions {
  language: 'ar' | 'en';
  userName?: string;
  targetGoal: string;
  industry: string;
  targetRole?: string;
  targetCompany?: string;
  analysisData: AnalysisData;
}

// ─── Brand colors (hex without leading #, docx requirement) ─────────────────
const TEAL_DEEP   = '0F766E';
const TEAL        = '0D9488';
const TEAL_TINT   = 'CCFBF1';
const SLATE_INK   = '0F172A';
const SLATE_BODY  = '334155';
const SLATE_DIM   = '64748B';
const SLATE_LINE  = 'E2E8F0';
const GREEN       = '16A34A';
const AMBER       = 'CA8A04';
const RED         = 'DC2626';

function scoreColor(score: number | null | undefined): string {
  if (typeof score !== 'number') return SLATE_DIM;
  if (score >= 70) return GREEN;
  if (score >= 50) return AMBER;
  return RED;
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
  const fromMap = SECTION_LABELS[String(key || '').toLowerCase()];
  if (lang === 'ar') return explicitAr || fromMap?.ar || key;
  return explicitEn || fromMap?.en || key;
}

function fontFor(lang: 'ar' | 'en'): string {
  // Cairo is the primary AR family used in the rest of the product UI.
  // Word substitutes a fallback if the user lacks Cairo locally.
  return lang === 'ar' ? 'Cairo' : 'Calibri';
}

// ─── helpers for cell styling ────────────────────────────────────────────────
function shadedCell(opts: {
  text: string;
  fill: string;
  color: string;
  bold?: boolean;
  font: string;
  align: AlignmentType;
  width?: number;
}) {
  return new TableCell({
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    shading: { type: 'clear' as any, color: 'auto', fill: opts.fill },
    children: [new Paragraph({
      alignment: opts.align,
      children: [new TextRun({ text: opts.text, bold: opts.bold ?? true, color: opts.color, font: opts.font })],
    })],
  });
}

function bodyCell(opts: {
  paragraphs: Paragraph[];
  width?: number;
  shading?: string;
}) {
  return new TableCell({
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    shading: opts.shading
      ? { type: 'clear' as any, color: 'auto', fill: opts.shading }
      : undefined,
    children: opts.paragraphs,
  });
}

// ─── DOCX entry point ────────────────────────────────────────────────────────
export async function generateDocxReport(opts: ReportOptions): Promise<Buffer> {
  const { language, analysisData, userName, targetGoal, industry, targetRole, targetCompany } = opts;
  const isAr = language === 'ar';
  const align = isAr ? AlignmentType.RIGHT : AlignmentType.LEFT;
  const font = fontFor(language);

  const L = isAr ? {
    title: 'تقرير تحليل البروفايل المهني',
    subtitle: 'تحليل ذكي مدعوم بمنصّة وصّل',
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
    footer: 'منصّة وصّل · wasselhub.com',
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
    footer: 'Wassel platform · wasselhub.com',
  };

  const overall = analysisData.overall_score;
  const grade = gradeFor(overall, language);
  const ovColor = scoreColor(overall);
  const generatedAt = new Date().toLocaleDateString(isAr ? 'ar-SA' : 'en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const children: (Paragraph | Table)[] = [];

  // ─── COVER ────────────────────────────────────────────────────────────────
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 600, after: 200 },
      children: [new TextRun({ text: isAr ? 'وصّل' : 'Wassel', bold: true, size: 36, color: TEAL_DEEP, font })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [new TextRun({ text: L.title, bold: true, size: 44, color: SLATE_INK, font })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
      children: [new TextRun({ text: L.subtitle, italics: true, size: 22, color: SLATE_DIM, font })],
    }),
  );

  // Cover key/value table
  const coverRows: TableRow[] = [];
  const pushCoverRow = (k: string, v: string, opts?: { color?: string; bold?: boolean }) => {
    coverRows.push(new TableRow({
      children: [
        bodyCell({
          width: 35,
          shading: 'F8FAFC',
          paragraphs: [new Paragraph({ alignment: align, children: [new TextRun({ text: k, bold: true, color: SLATE_DIM, font })] })],
        }),
        bodyCell({
          width: 65,
          paragraphs: [new Paragraph({
            alignment: align,
            children: [new TextRun({ text: v, bold: opts?.bold ?? false, color: opts?.color ?? SLATE_INK, font, size: 24 })],
          })],
        }),
      ],
    }));
  };
  pushCoverRow(L.profileFor, userName || '—', { bold: true });
  pushCoverRow(L.score, `${overall}/100`, { color: ovColor, bold: true });
  pushCoverRow(L.grade, grade, { color: ovColor, bold: true });
  pushCoverRow(L.target, targetGoal || '—');
  pushCoverRow(L.industry, industry || '—');
  if (targetRole)    pushCoverRow(L.targetRole, targetRole);
  if (targetCompany) pushCoverRow(L.targetCompany, targetCompany);
  pushCoverRow(L.generatedOn, generatedAt);

  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: coverRows,
    borders: {
      top:    { style: BorderStyle.SINGLE, size: 4, color: SLATE_LINE },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: SLATE_LINE },
      left:   { style: BorderStyle.SINGLE, size: 4, color: SLATE_LINE },
      right:  { style: BorderStyle.SINGLE, size: 4, color: SLATE_LINE },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: SLATE_LINE },
      insideVertical:   { style: BorderStyle.SINGLE, size: 2, color: SLATE_LINE },
    },
  }));

  // Page break before the body
  children.push(new Paragraph({ children: [new PageBreak()] }));

  // ─── EXECUTIVE SUMMARY ────────────────────────────────────────────────────
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: align,
      spacing: { before: 200, after: 120 },
      border: { bottom: { color: TEAL_DEEP, space: 4, style: BorderStyle.SINGLE, size: 12 } },
      children: [new TextRun({ text: L.executiveSummary, bold: true, size: 32, color: SLATE_INK, font })],
    }),
    new Paragraph({
      alignment: align,
      spacing: { after: 240 },
      children: [new TextRun({ text: analysisData.verdict || '', size: 22, color: SLATE_BODY, font })],
    }),
  );

  // ─── TOP PRIORITIES TABLE ─────────────────────────────────────────────────
  const priorities = (analysisData.top_priorities && analysisData.top_priorities.length)
    ? analysisData.top_priorities
    : null;
  if (priorities) {
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: align,
      spacing: { before: 200, after: 120 },
      border: { bottom: { color: TEAL_DEEP, space: 4, style: BorderStyle.SINGLE, size: 12 } },
      children: [new TextRun({ text: L.topPriorities, bold: true, size: 32, color: SLATE_INK, font })],
    }));

    const headerRow = new TableRow({
      tableHeader: true,
      children: [
        shadedCell({ text: L.rank,    fill: TEAL_DEEP, color: 'FFFFFF', font, align: AlignmentType.CENTER, width: 8 }),
        shadedCell({ text: L.action,  fill: TEAL_DEEP, color: 'FFFFFF', font, align, width: 52 }),
        shadedCell({ text: L.impact,  fill: TEAL_DEEP, color: 'FFFFFF', font, align, width: 40 }),
      ],
    });

    const dataRows = priorities.map((p, i) => {
      const rank = String(p.rank ?? i + 1);
      const action = p.action || '';
      const impact = p.expected_impact || '';
      const fw = p.framework_label || p.framework || '';

      const actionParas: Paragraph[] = [
        new Paragraph({ alignment: align, children: [new TextRun({ text: action, bold: true, size: 22, color: SLATE_INK, font })] }),
      ];
      if (fw) actionParas.push(new Paragraph({
        alignment: align,
        children: [new TextRun({ text: fw, italics: true, size: 18, color: SLATE_DIM, font })],
      }));

      return new TableRow({
        children: [
          bodyCell({
            paragraphs: [new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: rank, bold: true, size: 22, color: TEAL_DEEP, font })],
            })],
          }),
          bodyCell({ paragraphs: actionParas }),
          bodyCell({
            paragraphs: [new Paragraph({
              alignment: align,
              children: [new TextRun({ text: impact, size: 22, color: SLATE_BODY, font })],
            })],
          }),
        ],
      });
    });

    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [headerRow, ...dataRows],
      borders: {
        top:    { style: BorderStyle.SINGLE, size: 4, color: TEAL },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: TEAL },
        left:   { style: BorderStyle.SINGLE, size: 4, color: TEAL },
        right:  { style: BorderStyle.SINGLE, size: 4, color: TEAL },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: SLATE_LINE },
        insideVertical:   { style: BorderStyle.SINGLE, size: 2, color: SLATE_LINE },
      },
    }));
  } else if (analysisData.top_3_priorities && analysisData.top_3_priorities.length) {
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: align,
      spacing: { before: 200, after: 120 },
      border: { bottom: { color: TEAL_DEEP, space: 4, style: BorderStyle.SINGLE, size: 12 } },
      children: [new TextRun({ text: L.topPriorities, bold: true, size: 32, color: SLATE_INK, font })],
    }));
    for (const p of analysisData.top_3_priorities) {
      children.push(new Paragraph({
        alignment: align,
        spacing: { after: 100 },
        children: [new TextRun({ text: `• ${p}`, bold: true, size: 22, color: SLATE_INK, font })],
      }));
    }
  }

  // ─── SECTION-BY-SECTION TABLE ─────────────────────────────────────────────
  const sectionsToRender: AnalysisSection[] = Array.isArray(analysisData.sections) && analysisData.sections.length
    ? analysisData.sections
    : (analysisData.dimensions || []).map((d): AnalysisSection => ({
        key: d.name,
        score: d.score,
        framework: d.framework,
        framework_label: d.framework_label,
        assessment: d.observations?.[0]?.what || d.feedback,
        current: d.recommendations?.[0]?.current,
        suggested: d.recommendations?.[0]?.suggested,
        why: d.observations?.[0]?.why || d.recommendations?.[0]?.rationale,
      }));

  if (sectionsToRender.length) {
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: align,
      spacing: { before: 360, after: 120 },
      border: { bottom: { color: TEAL_DEEP, space: 4, style: BorderStyle.SINGLE, size: 12 } },
      children: [new TextRun({ text: L.sectionsTitle, bold: true, size: 32, color: SLATE_INK, font })],
    }));

    const sectionHeaderRow = new TableRow({
      tableHeader: true,
      children: [
        shadedCell({ text: L.section,      fill: TEAL_DEEP, color: 'FFFFFF', font, align, width: 30 }),
        shadedCell({ text: L.sectionScore, fill: TEAL_DEEP, color: 'FFFFFF', font, align: AlignmentType.CENTER, width: 14 }),
        shadedCell({ text: L.assessment,   fill: TEAL_DEEP, color: 'FFFFFF', font, align, width: 56 }),
      ],
    });

    const sectionRows = sectionsToRender.map((s) => {
      const name = sectionLabel(String(s.key), language, s.name_ar, s.name_en);
      const sc = typeof s.score === 'number' ? s.score : null;
      const scText = sc === null ? '—' : `${sc}/100`;
      const c = scoreColor(sc);
      const fw = s.framework_label || s.framework || '';

      const nameParas: Paragraph[] = [
        new Paragraph({ alignment: align, children: [new TextRun({ text: name, bold: true, size: 22, color: SLATE_INK, font })] }),
      ];
      if (fw) nameParas.push(new Paragraph({
        alignment: align,
        children: [new TextRun({ text: fw, italics: true, size: 18, color: SLATE_DIM, font })],
      }));

      const bodyParas: Paragraph[] = [];
      if (s.assessment) bodyParas.push(new Paragraph({
        alignment: align,
        children: [new TextRun({ text: s.assessment, size: 22, color: SLATE_BODY, font })],
      }));
      if (s.current) bodyParas.push(new Paragraph({
        alignment: align,
        spacing: { before: 60 },
        children: [
          new TextRun({ text: `${L.current}: `, bold: true, size: 20, color: SLATE_DIM, font }),
          new TextRun({ text: s.current, size: 20, color: SLATE_BODY, font }),
        ],
      }));
      if (s.suggested) bodyParas.push(new Paragraph({
        alignment: align,
        spacing: { before: 40 },
        children: [
          new TextRun({ text: `${L.suggested}: `, bold: true, size: 20, color: TEAL_DEEP, font }),
          new TextRun({ text: s.suggested, size: 20, color: TEAL_DEEP, font }),
        ],
      }));
      if (s.why) bodyParas.push(new Paragraph({
        alignment: align,
        spacing: { before: 40 },
        children: [
          new TextRun({ text: `${L.why}: `, italics: true, size: 18, color: SLATE_DIM, font }),
          new TextRun({ text: s.why, italics: true, size: 18, color: SLATE_DIM, font }),
        ],
      }));
      if (!bodyParas.length) bodyParas.push(new Paragraph({ alignment: align, children: [new TextRun({ text: '—', color: SLATE_DIM, font })] }));

      return new TableRow({
        children: [
          bodyCell({ paragraphs: nameParas }),
          bodyCell({
            paragraphs: [new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: scText, bold: true, size: 26, color: c, font })],
            })],
          }),
          bodyCell({ paragraphs: bodyParas }),
        ],
      });
    });

    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [sectionHeaderRow, ...sectionRows],
      borders: {
        top:    { style: BorderStyle.SINGLE, size: 4, color: TEAL },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: TEAL },
        left:   { style: BorderStyle.SINGLE, size: 4, color: TEAL },
        right:  { style: BorderStyle.SINGLE, size: 4, color: TEAL },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: SLATE_LINE },
        insideVertical:   { style: BorderStyle.SINGLE, size: 2, color: SLATE_LINE },
      },
    }));
  }

  // ─── ACTION PLAN TIMELINE ─────────────────────────────────────────────────
  if (priorities && priorities.length) {
    const horizons: { label: string; items: string[] }[] = [
      { label: L.immediate, items: [] },
      { label: L.shortTerm, items: [] },
      { label: L.longTerm,  items: [] },
    ];
    priorities.forEach((p, i) => {
      const bucket = Math.min(2, Math.floor((i / priorities.length) * 3));
      horizons[bucket].items.push(p.action || '');
    });

    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: align,
      spacing: { before: 360, after: 120 },
      border: { bottom: { color: TEAL_DEEP, space: 4, style: BorderStyle.SINGLE, size: 12 } },
      children: [new TextRun({ text: L.actionPlan, bold: true, size: 32, color: SLATE_INK, font })],
    }));

    const horizonHeader = new TableRow({
      tableHeader: true,
      children: horizons.map((h) =>
        shadedCell({ text: h.label, fill: TEAL, color: 'FFFFFF', font, align: AlignmentType.CENTER, width: 33 })),
    });

    const horizonBody = new TableRow({
      height: { value: 800, rule: HeightRule.ATLEAST },
      children: horizons.map((h) => bodyCell({
        paragraphs: h.items.length
          ? h.items.map((it) => new Paragraph({
              alignment: align,
              spacing: { after: 80 },
              children: [new TextRun({ text: `• ${it}`, size: 20, color: SLATE_BODY, font })],
            }))
          : [new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: '—', color: SLATE_DIM, font })],
            })],
      })),
    });

    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [horizonHeader, horizonBody],
      borders: {
        top:    { style: BorderStyle.SINGLE, size: 4, color: TEAL },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: TEAL },
        left:   { style: BorderStyle.SINGLE, size: 4, color: TEAL },
        right:  { style: BorderStyle.SINGLE, size: 4, color: TEAL },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: SLATE_LINE },
        insideVertical:   { style: BorderStyle.SINGLE, size: 2, color: SLATE_LINE },
      },
    }));
  }

  // ─── FOOTER LINE ──────────────────────────────────────────────────────────
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 600 },
    children: [new TextRun({ text: L.footer, italics: true, size: 18, color: SLATE_DIM, font })],
  }));

  const doc = new Document({
    creator: 'Wassel',
    title: L.title,
    description: L.subtitle,
    styles: {
      default: {
        document: {
          run: { font, size: 22 },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
        },
      },
      children,
    }],
  });

  return await Packer.toBuffer(doc);
}

// ─── PDF entry point — delegates to puppeteer-based renderer ─────────────────
export async function generatePdfReport(opts: ReportOptions): Promise<Buffer> {
  const html = buildAnalysisReportHtml(opts);
  return await renderHtmlToPdf({
    html,
    dir: opts.language === 'ar' ? 'rtl' : 'ltr',
    format: 'A4',
  });
}
