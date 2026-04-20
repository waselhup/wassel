import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import jsPDF from 'jspdf';

interface AnalysisDimension {
  name: string;
  score: number;
  feedback: string;
}

interface AnalysisData {
  overall_score: number;
  verdict: string;
  dimensions?: AnalysisDimension[];
  target_alignment?: {
    goal_match_score?: number;
    notes?: string;
  };
  recommendations?: string[];
  vision_2030_alignment?: string;
  top_3_priorities?: string[];
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

export async function generateDocxReport(opts: ReportOptions): Promise<Buffer> {
  const { language, analysisData, userName } = opts;

  const L = language === 'ar' ? {
    title: 'تحليل البروفايل',
    score: 'الدرجة الإجمالية',
    verdict: 'التقييم',
    dimensions: 'الأبعاد التفصيلية',
    recommendations: 'التوصيات',
    vision2030: 'توافق مع رؤية 2030',
    target: 'الهدف',
    industry: 'المجال',
    topPriorities: 'أولويات عليا',
  } : {
    title: 'Profile Analysis Report',
    score: 'Overall Score',
    verdict: 'Verdict',
    dimensions: 'Detailed Dimensions',
    recommendations: 'Recommendations',
    vision2030: 'Vision 2030 Alignment',
    target: 'Target Goal',
    industry: 'Industry',
    topPriorities: 'Top Priorities',
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

  if (analysisData.top_3_priorities && analysisData.top_3_priorities.length) {
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

  for (const dim of analysisData.dimensions || []) {
    const color = dim.score >= 7 ? '16a34a' : dim.score >= 5 ? 'ca8a04' : 'dc2626';
    children.push(new Paragraph({
      children: [
        new TextRun({ text: `${dim.name}: `, bold: true }),
        new TextRun({ text: `${dim.score}/10`, bold: true, color }),
      ],
      alignment: align,
    }));
    children.push(new Paragraph({
      text: dim.feedback || '',
      alignment: align,
    }));
  }

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

  if (analysisData.vision_2030_alignment) {
    children.push(new Paragraph({
      text: L.vision2030,
      heading: HeadingLevel.HEADING_2,
      alignment: align,
    }));
    children.push(new Paragraph({
      text: analysisData.vision_2030_alignment,
      alignment: align,
    }));
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
    vision2030: 'Vision 2030 Alignment',
  } : {
    title: 'Profile Analysis Report',
    score: 'Overall Score',
    dimensions: 'Detailed Dimensions',
    recommendations: 'Recommendations',
    verdict: 'Verdict',
    topPriorities: 'Top Priorities',
    vision2030: 'Vision 2030 Alignment',
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

  if (analysisData.top_3_priorities && analysisData.top_3_priorities.length) {
    if (y > 250) { pdf.addPage(); y = 20; }
    pdf.setFontSize(13);
    pdf.text(L.topPriorities, marginLeft, y, { align });
    y += lineHeight;
    pdf.setFontSize(11);
    for (const p of analysisData.top_3_priorities) {
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
  for (const dim of analysisData.dimensions || []) {
    if (y > 270) { pdf.addPage(); y = 20; }
    pdf.setFont(undefined as any, 'bold');
    pdf.text(`${dim.name}: ${dim.score}/10`, marginLeft, y, { align });
    pdf.setFont(undefined as any, 'normal');
    y += lineHeight;
    const feedbackLines = pdf.splitTextToSize(dim.feedback || '', 170);
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

  if (analysisData.vision_2030_alignment) {
    if (y > 250) { pdf.addPage(); y = 20; }
    pdf.setFontSize(13);
    pdf.text(L.vision2030, marginLeft, y, { align });
    y += lineHeight;
    pdf.setFontSize(11);
    const visionLines = pdf.splitTextToSize(analysisData.vision_2030_alignment, 170);
    for (const line of visionLines) {
      if (y > 280) { pdf.addPage(); y = 20; }
      pdf.text(line, marginLeft, y, { align });
      y += lineHeight;
    }
  }

  return Buffer.from(pdf.output('arraybuffer'));
}
