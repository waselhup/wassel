import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { jsPDF } from 'jspdf';

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
  // legacy support
  feedback?: string;
}

// v6 — 8-section shape
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
  target_alignment?: {
    goal_match_score?: number;
    notes?: string;
  };
  top_priorities?: TopPriority[];
  // legacy fields for historical rows
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

const DIM_LABELS: Record<string, { en: string; ar: string }> = {
  // v6 sections
  headline: { en: 'Headline', ar: 'العنوان الرئيسي' },
  about: { en: 'About', ar: 'نبذة عني' },
  experience: { en: 'Experience', ar: 'الخبرات' },
  skills: { en: 'Skills', ar: 'المهارات' },
  education: { en: 'Education', ar: 'التعليم' },
  recommendations: { en: 'Recommendations', ar: 'التوصيات' },
  activity: { en: 'Activity', ar: 'النشاط' },
  profile_completeness: { en: 'Profile Completeness', ar: 'اكتمال البروفايل' },
  // v5 dimensions (legacy rows)
  stranger_legibility: { en: 'Stranger Legibility', ar: 'وضوح البروفايل للغرباء' },
  discoverability: { en: 'Discoverability', ar: 'قابلية الاكتشاف' },
  ats_readiness: { en: 'ATS-Readiness', ar: 'جاهزية ATS' },
  skills_architecture: { en: 'Skills Architecture', ar: 'هيكلية المهارات' },
  social_proof: { en: 'Social Proof', ar: 'الإثبات الاجتماعي' },
  narrative_coherence: { en: 'Narrative Coherence', ar: 'ترابط السرد' },
};

function humanizeDimension(name: string, language: 'ar' | 'en'): string {
  const key = String(name || '').toLowerCase();
  const labels = DIM_LABELS[key];
  if (labels) return language === 'ar' ? labels.ar : labels.en;
  return name;
}

function scoreValue(score: number | null | undefined): number | null {
  if (typeof score !== 'number' || Number.isNaN(score)) return null;
  // Legacy rows used 0-10. Normalize to 0-100 only for label purposes — keep raw value too.
  return score;
}

export async function generateDocxReport(opts: ReportOptions): Promise<Buffer> {
  const { language, analysisData, userName } = opts;

  const L = language === 'ar' ? {
    title: 'تحليل البروفايل',
    score: 'الدرجة الإجمالية',
    verdict: 'التقييم',
    dimensions: 'الأبعاد التفصيلية',
    recommendations: 'التوصيات',
    observations: 'الملاحظات',
    framework: 'الإطار البحثي',
    target: 'الهدف',
    industry: 'المجال',
    topPriorities: 'أولويات عليا',
    confidence: 'مستوى الثقة',
    completeness: 'اكتمال البيانات',
    evidence: 'أدلة الاستناد',
    current: 'الحالي',
    suggested: 'المقترح',
    rationale: 'المبرر',
    expectedImpact: 'الأثر المتوقع',
  } : {
    title: 'Profile Analysis Report',
    score: 'Overall Score',
    verdict: 'Verdict',
    dimensions: 'Detailed Dimensions',
    recommendations: 'Recommendations',
    observations: 'Observations',
    framework: 'Framework',
    target: 'Target Goal',
    industry: 'Industry',
    topPriorities: 'Top Priorities',
    confidence: 'Confidence',
    completeness: 'Data Completeness',
    evidence: 'Evidence Bundle',
    current: 'Current',
    suggested: 'Suggested',
    rationale: 'Rationale',
    expectedImpact: 'Expected Impact',
  };

  const align = language === 'ar' ? AlignmentType.RIGHT : AlignmentType.LEFT;

  const children: Paragraph[] = [];

  children.push(new Paragraph({
    text: L.title,
    heading: HeadingLevel.TITLE,
    alignment: align,
  }));

  if (userName) {
    children.push(new Paragraph({
      text: userName,
      heading: HeadingLevel.HEADING_2,
      alignment: align,
    }));
  }

  children.push(new Paragraph({
    children: [
      new TextRun({ text: `${L.score}: `, bold: true, size: 28 }),
      new TextRun({ text: `${analysisData.overall_score}/100`, bold: true, size: 32 }),
    ],
    alignment: align,
  }));

  if (analysisData.confidence) {
    children.push(new Paragraph({
      children: [
        new TextRun({ text: `${L.confidence}: `, bold: true }),
        new TextRun({ text: analysisData.confidence }),
      ],
      alignment: align,
    }));
  }
  if (typeof analysisData.data_completeness === 'number') {
    children.push(new Paragraph({
      children: [
        new TextRun({ text: `${L.completeness}: `, bold: true }),
        new TextRun({ text: `${analysisData.data_completeness}%` }),
      ],
      alignment: align,
    }));
  }

  children.push(new Paragraph({ text: '', alignment: align }));

  children.push(new Paragraph({
    text: L.verdict,
    heading: HeadingLevel.HEADING_2,
    alignment: align,
  }));
  children.push(new Paragraph({
    text: analysisData.verdict || '',
    alignment: align,
  }));

  // New-schema top_priorities (array of objects)
  const priorities = (analysisData.top_priorities && analysisData.top_priorities.length)
    ? analysisData.top_priorities
    : null;
  if (priorities) {
    children.push(new Paragraph({
      text: L.topPriorities,
      heading: HeadingLevel.HEADING_2,
      alignment: align,
    }));
    for (const p of priorities) {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: `${p.rank || ''}. `, bold: true }),
          new TextRun({ text: p.action || '', bold: true }),
        ],
        alignment: align,
      }));
      if (p.framework_label || p.framework) {
        children.push(new Paragraph({
          children: [
            new TextRun({ text: `${L.framework}: `, bold: true }),
            new TextRun({ text: p.framework_label || p.framework || '' }),
          ],
          alignment: align,
        }));
      }
      if (p.expected_impact) {
        children.push(new Paragraph({
          children: [
            new TextRun({ text: `${L.expectedImpact}: `, bold: true }),
            new TextRun({ text: p.expected_impact }),
          ],
          alignment: align,
        }));
      }
    }
  } else if (analysisData.top_3_priorities && analysisData.top_3_priorities.length) {
    // Legacy rendering for historical rows
    children.push(new Paragraph({
      text: L.topPriorities,
      heading: HeadingLevel.HEADING_2,
      alignment: align,
    }));
    for (const p of analysisData.top_3_priorities) {
      children.push(new Paragraph({
        children: [new TextRun({ text: `• ${p}`, bold: true })],
        alignment: align,
      }));
    }
  }

  children.push(new Paragraph({
    text: L.dimensions,
    heading: HeadingLevel.HEADING_2,
    alignment: align,
  }));

  // v6 — 8 sections. Fall back to legacy dimensions loop if the row is older.
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

  for (const section of sectionsToRender) {
    const displayName = language === 'ar'
      ? (section.name_ar || humanizeDimension(section.key, 'ar'))
      : (section.name_en || humanizeDimension(section.key, 'en'));
    const val = scoreValue(section.score);
    const scoreText = val === null ? '—' : `${val}/100`;
    const color = val === null ? '64748b' : val >= 70 ? '16a34a' : val >= 50 ? 'ca8a04' : 'dc2626';
    children.push(new Paragraph({
      children: [
        new TextRun({ text: `${displayName}: `, bold: true }),
        new TextRun({ text: scoreText, bold: true, color }),
      ],
      alignment: align,
    }));
    if (section.framework_label || section.framework) {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: `${L.framework}: `, italics: true }),
          new TextRun({ text: section.framework_label || section.framework || '', italics: true }),
        ],
        alignment: align,
      }));
    }
    if (section.assessment) {
      children.push(new Paragraph({ text: section.assessment, alignment: align }));
    }
    if (section.current) {
      children.push(new Paragraph({
        children: [new TextRun({ text: `${L.current}: `, bold: true }), new TextRun({ text: section.current })],
        alignment: align,
      }));
    }
    if (section.suggested) {
      children.push(new Paragraph({
        children: [new TextRun({ text: `${L.suggested}: `, bold: true }), new TextRun({ text: section.suggested })],
        alignment: align,
      }));
    }
    if (section.why) {
      children.push(new Paragraph({
        children: [new TextRun({ text: `${L.rationale}: `, italics: true }), new TextRun({ text: section.why, italics: true })],
        alignment: align,
      }));
    }
    children.push(new Paragraph({ text: '', alignment: align }));
  }

  // Legacy recommendations (flat strings from older analyses)
  if (analysisData.recommendations && analysisData.recommendations.length) {
    children.push(new Paragraph({
      text: L.recommendations,
      heading: HeadingLevel.HEADING_2,
      alignment: align,
    }));
    for (const rec of analysisData.recommendations) {
      children.push(new Paragraph({
        text: `• ${rec}`,
        alignment: align,
      }));
    }
  }

  // Evidence bundle footer
  if (analysisData.evidence_bundle) {
    const eb = analysisData.evidence_bundle;
    children.push(new Paragraph({
      text: L.evidence,
      heading: HeadingLevel.HEADING_2,
      alignment: align,
    }));
    if (Array.isArray(eb.frameworks_referenced) && eb.frameworks_referenced.length) {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: `${L.framework}: `, bold: true }),
          new TextRun({ text: eb.frameworks_referenced.join(', ') }),
        ],
        alignment: align,
      }));
    }
    if (Array.isArray(eb.profile_quotes_used) && eb.profile_quotes_used.length) {
      for (const q of eb.profile_quotes_used.slice(0, 8)) {
        children.push(new Paragraph({
          children: [new TextRun({ text: `“${q}”`, italics: true })],
          alignment: align,
        }));
      }
    }
  }

  const doc = new Document({
    sections: [{ properties: {}, children }],
  });

  return await Packer.toBuffer(doc);
}

export function generatePdfReport(opts: ReportOptions): Buffer {
  const { language, analysisData, userName } = opts;
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const isArabic = language === 'ar';
  let y = 20;
  const lineHeight = 7;
  const marginLeft = isArabic ? 190 : 20;
  const align = isArabic ? 'right' : 'left';

  const L = isArabic ? {
    title: 'Profile Analysis',
    score: 'Overall Score',
    dimensions: 'Dimensions',
    recommendations: 'Recommendations',
    verdict: 'Verdict',
    topPriorities: 'Top Priorities',
  } : {
    title: 'Profile Analysis Report',
    score: 'Overall Score',
    dimensions: 'Detailed Dimensions',
    recommendations: 'Recommendations',
    verdict: 'Verdict',
    topPriorities: 'Top Priorities',
  };

  pdf.setFontSize(20);
  pdf.text(L.title, marginLeft, y, { align });
  y += lineHeight * 2;

  if (userName) {
    pdf.setFontSize(14);
    pdf.text(userName, marginLeft, y, { align });
    y += lineHeight * 2;
  }

  pdf.setFontSize(16);
  pdf.text(`${L.score}: ${analysisData.overall_score}/100`, marginLeft, y, { align });
  y += lineHeight * 2;

  pdf.setFontSize(13);
  pdf.text(L.verdict, marginLeft, y, { align });
  y += lineHeight;

  pdf.setFontSize(11);
  const verdictLines = pdf.splitTextToSize(analysisData.verdict || '', 170);
  for (const line of verdictLines) {
    pdf.text(line, marginLeft, y, { align });
    y += lineHeight;
    if (y > 280) { pdf.addPage(); y = 20; }
  }
  y += lineHeight;

  const priorities = analysisData.top_priorities && analysisData.top_priorities.length
    ? analysisData.top_priorities.map((p) => p.action || '')
    : (analysisData.top_3_priorities || []);

  if (priorities.length) {
    if (y > 250) { pdf.addPage(); y = 20; }
    pdf.setFontSize(13);
    pdf.text(L.topPriorities, marginLeft, y, { align });
    y += lineHeight;
    pdf.setFontSize(11);
    for (const p of priorities) {
      const lines = pdf.splitTextToSize(`- ${p}`, 170);
      for (const line of lines) {
        if (y > 280) { pdf.addPage(); y = 20; }
        pdf.text(line, marginLeft, y, { align });
        y += lineHeight;
      }
    }
    y += lineHeight;
  }

  if (y > 250) { pdf.addPage(); y = 20; }
  pdf.setFontSize(13);
  pdf.text(L.dimensions, marginLeft, y, { align });
  y += lineHeight;

  pdf.setFontSize(11);
  const pdfSections: Array<{ key: string; score: number | null; body: string }> = (
    Array.isArray(analysisData.sections) && analysisData.sections.length
      ? analysisData.sections.map((s) => ({
          key: s.key,
          score: typeof s.score === 'number' ? s.score : null,
          body: [s.assessment, s.current ? `${L.current}: ${s.current}` : '', s.suggested ? `${L.suggested}: ${s.suggested}` : '', s.why ? `${L.rationale}: ${s.why}` : ''].filter(Boolean).join('\n'),
        }))
      : (analysisData.dimensions || []).map((d) => ({
          key: d.name,
          score: typeof d.score === 'number' ? d.score : null,
          body: Array.isArray(d.observations) && d.observations.length
            ? d.observations.map((o) => [o.what, o.why, o.citation].filter(Boolean).join(' — ')).join('\n')
            : (d.feedback || ''),
        }))
  );
  for (const item of pdfSections) {
    if (y > 270) { pdf.addPage(); y = 20; }
    pdf.setFont(undefined as any, 'bold');
    const displayName = humanizeDimension(item.key, language);
    pdf.text(`${displayName}: ${item.score === null ? '—' : `${item.score}/100`}`, marginLeft, y, { align });
    pdf.setFont(undefined as any, 'normal');
    y += lineHeight;
    const feedbackLines = pdf.splitTextToSize(item.body, 170);
    for (const line of feedbackLines) {
      pdf.text(line, marginLeft, y, { align });
      y += lineHeight;
      if (y > 280) { pdf.addPage(); y = 20; }
    }
    y += lineHeight / 2;
  }

  if (analysisData.recommendations && analysisData.recommendations.length) {
    if (y > 250) { pdf.addPage(); y = 20; }
    pdf.setFontSize(13);
    pdf.text(L.recommendations, marginLeft, y, { align });
    y += lineHeight;
    pdf.setFontSize(11);
    for (const rec of analysisData.recommendations) {
      const recLines = pdf.splitTextToSize(`- ${rec}`, 170);
      for (const line of recLines) {
        if (y > 280) { pdf.addPage(); y = 20; }
        pdf.text(line, marginLeft, y, { align });
        y += lineHeight;
      }
    }
    y += lineHeight;
  }

  return Buffer.from(pdf.output('arraybuffer'));
}
