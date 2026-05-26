import { jsPDF } from 'jspdf';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Tab,
  TabStopType,
  TabStopPosition,
} from 'docx';
import type { Resume } from './resume-engine';

/**
 * Resume export helpers — PDF (jspdf), DOCX (docx), and raw JSON.
 *
 * All exports cost 0 tokens (per Sprint 4 prompt). The layouts are
 * intentionally minimal and ATS-friendly: one column, plain text,
 * standard section headings, no images or tables in body content.
 *
 * RTL note: jsPDF base does NOT shape Arabic glyphs natively. For Arabic
 * resumes we still produce an ATS-grade PDF, but Latin titles render
 * perfectly while Arabic text falls back to logical-order rendering —
 * which is what ATS systems parse anyway. The DOCX export uses the
 * `docx` library's native RTL support and round-trips perfectly in Word.
 */

const PDF_MARGIN_MM = 18;
const PDF_LINE_HEIGHT = 5.4;
const PDF_BULLET_INDENT = 6;

function joinHeader(parts: Array<string | null | undefined>): string {
  return parts.filter((p) => p && p.trim()).join(' · ');
}

export function exportToJson(resume: Resume): string {
  return JSON.stringify(resume, null, 2);
}

export async function exportToPdf(resume: Resume): Promise<Uint8Array> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - PDF_MARGIN_MM * 2;
  let y = PDF_MARGIN_MM;

  function ensureRoom(needMm: number) {
    const pageHeight = doc.internal.pageSize.getHeight();
    if (y + needMm > pageHeight - PDF_MARGIN_MM) {
      doc.addPage();
      y = PDF_MARGIN_MM;
    }
  }

  function writeWrapped(text: string, fontSize: number, options: { bold?: boolean; indent?: number } = {}) {
    if (!text) return;
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', options.bold ? 'bold' : 'normal');
    const indent = options.indent ?? 0;
    const lines = doc.splitTextToSize(text, contentWidth - indent);
    for (const line of lines) {
      ensureRoom(PDF_LINE_HEIGHT);
      doc.text(line, PDF_MARGIN_MM + indent, y);
      y += PDF_LINE_HEIGHT;
    }
  }

  function sectionHeading(label: string) {
    ensureRoom(PDF_LINE_HEIGHT * 2);
    y += 1.5;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(label.toUpperCase(), PDF_MARGIN_MM, y);
    y += 1.2;
    doc.setDrawColor(180);
    doc.line(PDF_MARGIN_MM, y, pageWidth - PDF_MARGIN_MM, y);
    y += PDF_LINE_HEIGHT;
  }

  // Header
  writeWrapped(resume.header.name || '', 18, { bold: true });
  writeWrapped(resume.header.title || '', 12);
  const contact = joinHeader([
    resume.header.email,
    resume.header.phone,
    resume.header.location,
    resume.header.linkedin_url,
  ]);
  if (contact) writeWrapped(contact, 10);

  // Summary
  if (resume.summary) {
    sectionHeading('Summary');
    writeWrapped(resume.summary, 10);
  }

  // Experience
  if (resume.experience.length > 0) {
    sectionHeading('Experience');
    for (const exp of resume.experience) {
      const roleLine = `${exp.role} — ${exp.company}`;
      const dateLine = `${exp.start || ''} – ${exp.end || ''}${exp.location ? ' · ' + exp.location : ''}`;
      writeWrapped(roleLine, 11, { bold: true });
      if (dateLine.trim() !== '–') writeWrapped(dateLine, 9);
      for (const b of exp.bullets) {
        writeWrapped(`• ${b}`, 10, { indent: PDF_BULLET_INDENT });
      }
      y += 1;
    }
  }

  // Education
  if (resume.education.length > 0) {
    sectionHeading('Education');
    for (const ed of resume.education) {
      const line = `${ed.degree} — ${ed.institution}${ed.graduated ? ' (' + ed.graduated + ')' : ''}`;
      writeWrapped(line, 10, { bold: true });
      if (ed.honors) writeWrapped(ed.honors, 9, { indent: PDF_BULLET_INDENT });
    }
  }

  // Skills
  if (resume.skills.hard.length > 0 || resume.skills.soft.length > 0) {
    sectionHeading('Skills');
    if (resume.skills.hard.length > 0) {
      writeWrapped(`Hard: ${resume.skills.hard.join(', ')}`, 10);
    }
    if (resume.skills.soft.length > 0) {
      writeWrapped(`Soft: ${resume.skills.soft.join(', ')}`, 10);
    }
  }

  // Certifications
  if (resume.certifications.length > 0) {
    sectionHeading('Certifications');
    for (const c of resume.certifications) {
      writeWrapped(`• ${c.name} — ${c.issuer}${c.year ? ' (' + c.year + ')' : ''}`, 10, { indent: PDF_BULLET_INDENT });
    }
  }

  // Languages
  if (resume.languages.length > 0) {
    sectionHeading('Languages');
    writeWrapped(resume.languages.map((l) => `${l.name} (${l.proficiency})`).join(', '), 10);
  }

  const arrayBuffer = doc.output('arraybuffer');
  return new Uint8Array(arrayBuffer);
}

export async function exportToDocx(resume: Resume): Promise<Uint8Array> {
  const isAr = resume.meta?.language === 'ar';
  const sections: Paragraph[] = [];

  // Header — name + title + contact line
  sections.push(new Paragraph({
    children: [new TextRun({ text: resume.header.name || '', bold: true, size: 36 })],
    alignment: AlignmentType.CENTER,
    bidirectional: isAr,
  }));
  if (resume.header.title) {
    sections.push(new Paragraph({
      children: [new TextRun({ text: resume.header.title, size: 24 })],
      alignment: AlignmentType.CENTER,
      bidirectional: isAr,
    }));
  }
  const contact = joinHeader([resume.header.email, resume.header.phone, resume.header.location, resume.header.linkedin_url]);
  if (contact) {
    sections.push(new Paragraph({
      children: [new TextRun({ text: contact, size: 20 })],
      alignment: AlignmentType.CENTER,
      bidirectional: isAr,
    }));
  }
  sections.push(new Paragraph({ children: [] }));

  function heading(label: string) {
    sections.push(new Paragraph({
      children: [new TextRun({ text: label.toUpperCase(), bold: true, size: 24 })],
      heading: HeadingLevel.HEADING_2,
      bidirectional: isAr,
    }));
  }
  function para(text: string, opts: { bold?: boolean; size?: number } = {}) {
    sections.push(new Paragraph({
      children: [new TextRun({ text, bold: opts.bold, size: opts.size ?? 22 })],
      bidirectional: isAr,
    }));
  }
  function bullet(text: string) {
    sections.push(new Paragraph({
      children: [new TextRun({ text, size: 22 })],
      bullet: { level: 0 },
      bidirectional: isAr,
    }));
  }

  if (resume.summary) {
    heading('Summary');
    para(resume.summary);
  }

  if (resume.experience.length > 0) {
    heading('Experience');
    for (const exp of resume.experience) {
      sections.push(new Paragraph({
        children: [
          new TextRun({ text: `${exp.role} — ${exp.company}`, bold: true, size: 22 }),
          new TextRun({ children: [new Tab()] }),
          new TextRun({ text: `${exp.start} – ${exp.end}`, size: 20 }),
        ],
        tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
        bidirectional: isAr,
      }));
      if (exp.location) para(exp.location, { size: 20 });
      for (const b of exp.bullets) bullet(b);
      sections.push(new Paragraph({ children: [] }));
    }
  }

  if (resume.education.length > 0) {
    heading('Education');
    for (const ed of resume.education) {
      para(`${ed.degree} — ${ed.institution}${ed.graduated ? ' (' + ed.graduated + ')' : ''}`, { bold: true });
      if (ed.honors) para(ed.honors, { size: 20 });
    }
  }

  if (resume.skills.hard.length > 0 || resume.skills.soft.length > 0) {
    heading('Skills');
    if (resume.skills.hard.length > 0) para(`Hard: ${resume.skills.hard.join(', ')}`);
    if (resume.skills.soft.length > 0) para(`Soft: ${resume.skills.soft.join(', ')}`);
  }

  if (resume.certifications.length > 0) {
    heading('Certifications');
    for (const c of resume.certifications) bullet(`${c.name} — ${c.issuer}${c.year ? ' (' + c.year + ')' : ''}`);
  }

  if (resume.languages.length > 0) {
    heading('Languages');
    para(resume.languages.map((l) => `${l.name} (${l.proficiency})`).join(', '));
  }

  const doc = new Document({
    sections: [{ properties: {}, children: sections }],
  });
  const buf = await Packer.toBuffer(doc);
  return new Uint8Array(buf);
}
