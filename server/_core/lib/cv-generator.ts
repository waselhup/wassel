import {
  Document, Paragraph, TextRun, AlignmentType, TabStopType,
  BorderStyle, convertInchesToTwip, Packer, LevelFormat,
} from 'docx';
import { jsPDF } from 'jspdf';

export interface CVData {
  fullName: string;
  contact: { phone: string; email: string; location: string; linkedinUrl?: string };
  summary: string;
  experience: Array<{
    title: string; company: string; location: string; dates: string; bullets: string[];
  }>;
  education: Array<{
    school: string; location: string; degree: string; year: string; achievements: string[];
  }>;
  certifications: Array<{ name: string; issuer: string; year: string }>;
  skills: Array<{ categoryName: string; items: string[] }>;
  achievements: string[];
  languages: Array<{ name: string; proficiency: string }>;
}

export type CVTemplate = 'mit-classic' | 'harvard-executive';

// ─── MIT Classic DOCX ───────────────────────────────────────────────────────

/**
 * Mirror of the Mohammad Al-Ali gold-standard format:
 *  - Name: centered, UPPERCASE, 16pt bold Calibri
 *  - Contact line: centered, 10pt, " • " separators
 *  - Section headers: UPPERCASE, 11pt bold, single black bottom border
 *  - Company: 11pt bold, location right-aligned via tab
 *  - Title: 10pt italic, dates right-aligned italic via tab
 *  - Bullets: 10pt, indented 0.25"
 *  - Margins: 0.6" top/bottom, 0.7" L/R
 *  - Font: Calibri throughout (ATS-safe, universal on Word/Google Docs)
 */
export async function buildMITClassicDocx(cv: CVData): Promise<Buffer> {
  const children: Paragraph[] = [];
  const RIGHT_TAB = 9360; // ≈ 6.5" at 1440 twips/inch

  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({
      text: (cv.fullName || '').toUpperCase(),
      bold: true, size: 32, font: 'Calibri',
    })],
    spacing: { after: 80 },
  }));

  const contactParts = [
    cv.contact.location, cv.contact.phone, cv.contact.email, cv.contact.linkedinUrl,
  ].filter((p) => !!p && p.trim()) as string[];
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({
      text: contactParts.join(' • '), size: 20, font: 'Calibri',
    })],
    spacing: { after: 240 },
  }));

  const sectionHeader = (title: string, topSpacing = 160) => new Paragraph({
    children: [new TextRun({
      text: title.toUpperCase(), bold: true, size: 22, font: 'Calibri',
    })],
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000', space: 1 },
    },
    spacing: { before: topSpacing, after: 100 },
  });

  const bullet = (text: string) => new Paragraph({
    children: [new TextRun({ text, size: 20, font: 'Calibri' })],
    bullet: { level: 0 },
    indent: { left: 360 },
    spacing: { after: 40 },
  });

  if (cv.summary) {
    children.push(sectionHeader('Professional Summary', 0));
    children.push(new Paragraph({
      children: [new TextRun({ text: cv.summary, size: 20, font: 'Calibri' })],
      spacing: { after: 120 },
      alignment: AlignmentType.JUSTIFIED,
    }));
  }

  if (cv.experience.length) {
    children.push(sectionHeader('Professional Experience'));
    cv.experience.forEach((exp) => {
      children.push(new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: RIGHT_TAB }],
        children: [
          new TextRun({ text: exp.company || '', bold: true, size: 22, font: 'Calibri' }),
          new TextRun({ text: `\t${exp.location || ''}`, size: 20, font: 'Calibri' }),
        ],
        spacing: { before: 140, after: 40 },
      }));
      children.push(new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: RIGHT_TAB }],
        children: [
          new TextRun({ text: exp.title || '', italics: true, size: 20, font: 'Calibri' }),
          new TextRun({ text: `\t${exp.dates || ''}`, italics: true, size: 20, font: 'Calibri' }),
        ],
        spacing: { after: 60 },
      }));
      (exp.bullets || []).forEach((b) => children.push(bullet(b)));
    });
  }

  if (cv.education.length) {
    children.push(sectionHeader('Education'));
    cv.education.forEach((edu) => {
      children.push(new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: RIGHT_TAB }],
        children: [
          new TextRun({ text: edu.school || '', bold: true, size: 22, font: 'Calibri' }),
          new TextRun({ text: `\t${edu.location || ''}`, size: 20, font: 'Calibri' }),
        ],
        spacing: { before: 120, after: 40 },
      }));
      children.push(new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: RIGHT_TAB }],
        children: [
          new TextRun({ text: edu.degree || '', italics: true, size: 20, font: 'Calibri' }),
          new TextRun({ text: `\t${edu.year || ''}`, italics: true, size: 20, font: 'Calibri' }),
        ],
        spacing: { after: 40 },
      }));
      (edu.achievements || []).forEach((a) => children.push(bullet(a)));
    });
  }

  if (cv.certifications.length) {
    children.push(sectionHeader('Certifications & Licenses'));
    cv.certifications.forEach((cert) => {
      const parts = [cert.name, cert.issuer, cert.year ? `(${cert.year})` : ''].filter(Boolean);
      children.push(bullet(parts.join(' — ')));
    });
  }

  if (cv.skills.length) {
    children.push(sectionHeader('Technical Skills'));
    cv.skills.forEach((group) => {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: `${group.categoryName}: `, bold: true, size: 20, font: 'Calibri' }),
          new TextRun({ text: (group.items || []).join(', '), size: 20, font: 'Calibri' }),
        ],
        spacing: { after: 60 },
        indent: { left: 360, hanging: 360 },
      }));
    });
  }

  if (cv.languages.length) {
    children.push(new Paragraph({
      children: [
        new TextRun({ text: 'Languages: ', bold: true, size: 20, font: 'Calibri' }),
        new TextRun({
          text: cv.languages
            .map((l) => `${l.name}${l.proficiency ? ` (${l.proficiency})` : ''}`)
            .join(', '),
          size: 20, font: 'Calibri',
        }),
      ],
      spacing: { after: 60 },
      indent: { left: 360, hanging: 360 },
    }));
  }

  if (cv.achievements.length) {
    children.push(sectionHeader('Key Achievements'));
    cv.achievements.forEach((a) => children.push(bullet(a)));
  }

  const doc = new Document({
    creator: 'Wassel',
    title: `${cv.fullName} — CV`,
    styles: { default: { document: { run: { font: 'Calibri' } } } },
    sections: [{
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(0.6),
            bottom: convertInchesToTwip(0.6),
            left: convertInchesToTwip(0.7),
            right: convertInchesToTwip(0.7),
          },
        },
      },
      children,
    }],
  });

  return await Packer.toBuffer(doc);
}

// ─── Harvard Executive DOCX ─────────────────────────────────────────────────

/**
 * Modern executive template with navy accents, still single-column ATS-safe.
 *  - Name: 18pt bold Calibri, left-aligned, navy
 *  - Contact: under name, 10pt, " | " separators
 *  - Section headers: 12pt bold, navy #1e3a5f, navy bottom border
 *  - Title bolded + navy, dates right-aligned grey
 *  - Bullets: first 3-4 words bolded as metric-forward hook
 */
export async function buildHarvardExecutiveDocx(cv: CVData): Promise<Buffer> {
  const children: Paragraph[] = [];
  const NAVY = '1E3A5F';
  const GREY = '666666';
  const SUB = '555555';
  const RIGHT_TAB = 9360;

  children.push(new Paragraph({
    children: [new TextRun({
      text: cv.fullName || '', bold: true, size: 36, font: 'Calibri', color: NAVY,
    })],
    spacing: { after: 60 },
  }));

  const contactParts = [
    cv.contact.location, cv.contact.phone, cv.contact.email, cv.contact.linkedinUrl,
  ].filter((p) => !!p && p.trim()) as string[];
  children.push(new Paragraph({
    children: [new TextRun({
      text: contactParts.join(' | '), size: 20, font: 'Calibri', color: SUB,
    })],
    spacing: { after: 280 },
  }));

  const sectionHeader = (title: string, topSpacing = 200) => new Paragraph({
    children: [new TextRun({
      text: title.toUpperCase(), bold: true, size: 24, font: 'Calibri', color: NAVY,
    })],
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 8, color: NAVY, space: 2 },
    },
    spacing: { before: topSpacing, after: 120 },
  });

  const metricBullet = (text: string) => {
    const t = text.trim();
    const words = t.split(/\s+/);
    const lead = Math.min(4, Math.max(2, Math.ceil(words.length * 0.25)));
    const boldPart = words.slice(0, lead).join(' ');
    const restPart = words.length > lead ? ' ' + words.slice(lead).join(' ') : '';
    return new Paragraph({
      children: [
        new TextRun({ text: boldPart, bold: true, size: 20, font: 'Calibri' }),
        new TextRun({ text: restPart, size: 20, font: 'Calibri' }),
      ],
      bullet: { level: 0 },
      indent: { left: 360 },
      spacing: { after: 40 },
    });
  };

  const plainBullet = (text: string) => new Paragraph({
    children: [new TextRun({ text, size: 20, font: 'Calibri' })],
    bullet: { level: 0 },
    indent: { left: 360 },
    spacing: { after: 40 },
  });

  if (cv.summary) {
    children.push(sectionHeader('Executive Summary', 0));
    children.push(new Paragraph({
      children: [new TextRun({ text: cv.summary, size: 22, font: 'Calibri' })],
      spacing: { after: 140 },
    }));
  }

  if (cv.experience.length) {
    children.push(sectionHeader('Professional Experience'));
    cv.experience.forEach((exp) => {
      children.push(new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: RIGHT_TAB }],
        children: [
          new TextRun({ text: exp.title || '', bold: true, size: 22, font: 'Calibri', color: NAVY }),
          new TextRun({ text: `\t${exp.dates || ''}`, size: 20, font: 'Calibri', color: GREY }),
        ],
        spacing: { before: 160, after: 40 },
      }));
      const compLoc = [exp.company, exp.location].filter(Boolean).join(' | ');
      children.push(new Paragraph({
        children: [new TextRun({
          text: compLoc, italics: true, size: 20, font: 'Calibri', color: SUB,
        })],
        spacing: { after: 80 },
      }));
      (exp.bullets || []).forEach((b) => children.push(metricBullet(b)));
    });
  }

  if (cv.education.length) {
    children.push(sectionHeader('Education'));
    cv.education.forEach((edu) => {
      children.push(new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: RIGHT_TAB }],
        children: [
          new TextRun({ text: edu.school || '', bold: true, size: 22, font: 'Calibri', color: NAVY }),
          new TextRun({ text: `\t${edu.year || ''}`, size: 20, font: 'Calibri', color: GREY }),
        ],
        spacing: { before: 120, after: 40 },
      }));
      const line2 = [edu.degree, edu.location].filter(Boolean).join(' | ');
      children.push(new Paragraph({
        children: [new TextRun({ text: line2, italics: true, size: 20, font: 'Calibri', color: SUB })],
        spacing: { after: 60 },
      }));
      (edu.achievements || []).forEach((a) => children.push(plainBullet(a)));
    });
  }

  if (cv.certifications.length) {
    children.push(sectionHeader('Certifications & Licenses'));
    cv.certifications.forEach((cert) => {
      const parts = [cert.name, cert.issuer, cert.year ? `(${cert.year})` : ''].filter(Boolean);
      children.push(plainBullet(parts.join(' — ')));
    });
  }

  if (cv.skills.length) {
    children.push(sectionHeader('Core Competencies'));
    cv.skills.forEach((group) => {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: `${group.categoryName}: `, bold: true, size: 20, font: 'Calibri', color: NAVY }),
          new TextRun({ text: (group.items || []).join(', '), size: 20, font: 'Calibri' }),
        ],
        spacing: { after: 60 },
        indent: { left: 360, hanging: 360 },
      }));
    });
  }

  if (cv.languages.length) {
    children.push(new Paragraph({
      children: [
        new TextRun({ text: 'Languages: ', bold: true, size: 20, font: 'Calibri', color: NAVY }),
        new TextRun({
          text: cv.languages
            .map((l) => `${l.name}${l.proficiency ? ` (${l.proficiency})` : ''}`)
            .join(', '),
          size: 20, font: 'Calibri',
        }),
      ],
      spacing: { after: 60 },
      indent: { left: 360, hanging: 360 },
    }));
  }

  if (cv.achievements.length) {
    children.push(sectionHeader('Signature Achievements'));
    cv.achievements.forEach((a) => children.push(metricBullet(a)));
  }

  const doc = new Document({
    creator: 'Wassel',
    title: `${cv.fullName} — Executive CV`,
    styles: { default: { document: { run: { font: 'Calibri' } } } },
    sections: [{
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(0.6),
            bottom: convertInchesToTwip(0.6),
            left: convertInchesToTwip(0.75),
            right: convertInchesToTwip(0.75),
          },
        },
      },
      children,
    }],
  });

  return await Packer.toBuffer(doc);
}

// ─── PDF output (jsPDF, Letter, helvetica) ──────────────────────────────────

/**
 * Render the same CV as a paginated PDF. Works for both templates —
 * MIT is centered black-and-white, Harvard is left-aligned with navy.
 */
export function buildCVPDF(cv: CVData, template: CVTemplate): Buffer {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const W = doc.internal.pageSize.width;
  const H = doc.internal.pageSize.height;
  const marginX = template === 'mit-classic' ? 50 : 54;
  const marginY = 50;
  let y = marginY;

  const NAVY: [number, number, number] = [30, 58, 95];
  const GREY: [number, number, number] = [102, 102, 102];
  const BLACK: [number, number, number] = [0, 0, 0];

  const ensureRoom = (needed: number) => {
    if (y + needed > H - 50) {
      doc.addPage();
      y = marginY;
    }
  };

  // NAME + CONTACT
  if (template === 'mit-classic') {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...BLACK);
    doc.text((cv.fullName || '').toUpperCase(), W / 2, y, { align: 'center' });
    y += 20;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const contact = [cv.contact.location, cv.contact.phone, cv.contact.email, cv.contact.linkedinUrl]
      .filter(Boolean).join(' • ');
    doc.text(contact, W / 2, y, { align: 'center' });
    y += 22;
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(...NAVY);
    doc.text(cv.fullName || '', marginX, y);
    y += 18;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(85, 85, 85);
    const contact = [cv.contact.location, cv.contact.phone, cv.contact.email, cv.contact.linkedinUrl]
      .filter(Boolean).join(' | ');
    doc.text(contact, marginX, y);
    y += 22;
  }

  const sectionHeader = (title: string) => {
    ensureRoom(30);
    y += 10;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    if (template === 'mit-classic') {
      doc.setTextColor(...BLACK);
      doc.text(title.toUpperCase(), marginX, y);
      y += 4;
      doc.setDrawColor(...BLACK);
      doc.setLineWidth(0.8);
    } else {
      doc.setTextColor(...NAVY);
      doc.text(title.toUpperCase(), marginX, y);
      y += 4;
      doc.setDrawColor(...NAVY);
      doc.setLineWidth(1.2);
    }
    doc.line(marginX, y, W - marginX, y);
    y += 12;
    doc.setTextColor(...BLACK);
  };

  const paragraph = (text: string, size = 10, indent = 0, style: 'normal' | 'bold' | 'italic' = 'normal') => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    const maxWidth = W - marginX * 2 - indent;
    const lines = doc.splitTextToSize(text, maxWidth);
    const lineHeight = size * 1.3;
    lines.forEach((line: string) => {
      ensureRoom(lineHeight);
      doc.text(line, marginX + indent, y);
      y += lineHeight;
    });
  };

  const bulletLine = (text: string) => {
    const size = 10;
    const lineHeight = size * 1.3;
    const indent = 18;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(size);
    doc.setTextColor(...BLACK);
    ensureRoom(lineHeight);
    doc.text('•', marginX + 8, y);
    const maxWidth = W - marginX * 2 - indent;
    const lines = doc.splitTextToSize(text, maxWidth);
    lines.forEach((line: string, i: number) => {
      if (i > 0) ensureRoom(lineHeight);
      doc.text(line, marginX + indent, y);
      y += lineHeight;
    });
    y += 2;
  };

  const rightAlignedRow = (leftText: string, rightText: string, leftStyle: 'bold' | 'italic' = 'bold', leftColor: [number, number, number] = BLACK, rightStyle: 'normal' | 'italic' = 'normal', rightColor: [number, number, number] = BLACK) => {
    const size = leftStyle === 'bold' ? 11 : 10;
    const lineHeight = size * 1.3;
    ensureRoom(lineHeight);
    doc.setFont('helvetica', leftStyle);
    doc.setFontSize(size);
    doc.setTextColor(...leftColor);
    doc.text(leftText, marginX, y);
    doc.setFont('helvetica', rightStyle);
    doc.setFontSize(10);
    doc.setTextColor(...rightColor);
    doc.text(rightText, W - marginX, y, { align: 'right' });
    y += lineHeight;
    doc.setTextColor(...BLACK);
  };

  // SUMMARY
  if (cv.summary) {
    sectionHeader(template === 'mit-classic' ? 'Professional Summary' : 'Executive Summary');
    paragraph(cv.summary, 10);
    y += 4;
  }

  // EXPERIENCE
  if (cv.experience.length) {
    sectionHeader('Professional Experience');
    cv.experience.forEach((exp) => {
      ensureRoom(40);
      if (template === 'mit-classic') {
        rightAlignedRow(exp.company || '', exp.location || '', 'bold', BLACK, 'normal', BLACK);
        rightAlignedRow(exp.title || '', exp.dates || '', 'italic', BLACK, 'italic', BLACK);
      } else {
        rightAlignedRow(exp.title || '', exp.dates || '', 'bold', NAVY, 'normal', GREY);
        paragraph([exp.company, exp.location].filter(Boolean).join(' | '), 10, 0, 'italic');
      }
      (exp.bullets || []).forEach((b) => bulletLine(b));
      y += 6;
    });
  }

  // EDUCATION
  if (cv.education.length) {
    sectionHeader('Education');
    cv.education.forEach((edu) => {
      ensureRoom(30);
      if (template === 'mit-classic') {
        rightAlignedRow(edu.school || '', edu.location || '', 'bold', BLACK, 'normal', BLACK);
        rightAlignedRow(edu.degree || '', edu.year || '', 'italic', BLACK, 'italic', BLACK);
      } else {
        rightAlignedRow(edu.school || '', edu.year || '', 'bold', NAVY, 'normal', GREY);
        paragraph([edu.degree, edu.location].filter(Boolean).join(' | '), 10, 0, 'italic');
      }
      (edu.achievements || []).forEach((a) => bulletLine(a));
      y += 6;
    });
  }

  // CERTIFICATIONS
  if (cv.certifications.length) {
    sectionHeader('Certifications & Licenses');
    cv.certifications.forEach((cert) => {
      const parts = [cert.name, cert.issuer, cert.year ? `(${cert.year})` : ''].filter(Boolean);
      bulletLine(parts.join(' — '));
    });
    y += 4;
  }

  // SKILLS
  if (cv.skills.length) {
    sectionHeader(template === 'mit-classic' ? 'Technical Skills' : 'Core Competencies');
    cv.skills.forEach((group) => {
      const size = 10;
      const lineHeight = size * 1.3;
      ensureRoom(lineHeight);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(size);
      doc.setTextColor(...(template === 'harvard-executive' ? NAVY : BLACK));
      const label = `${group.categoryName}: `;
      const labelWidth = doc.getTextWidth(label);
      doc.text(label, marginX, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...BLACK);
      const itemsText = (group.items || []).join(', ');
      const maxWidth = W - marginX * 2 - labelWidth;
      const lines = doc.splitTextToSize(itemsText, maxWidth);
      lines.forEach((line: string, i: number) => {
        if (i > 0) {
          ensureRoom(lineHeight);
          doc.text(line, marginX, y);
          y += lineHeight;
        } else {
          doc.text(line, marginX + labelWidth, y);
          y += lineHeight;
        }
      });
      y += 2;
    });
  }

  // LANGUAGES
  if (cv.languages.length) {
    const size = 10;
    const lineHeight = size * 1.3;
    ensureRoom(lineHeight);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(size);
    doc.setTextColor(...(template === 'harvard-executive' ? NAVY : BLACK));
    const label = 'Languages: ';
    const labelWidth = doc.getTextWidth(label);
    doc.text(label, marginX, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...BLACK);
    const text = cv.languages
      .map((l) => `${l.name}${l.proficiency ? ` (${l.proficiency})` : ''}`)
      .join(', ');
    const lines = doc.splitTextToSize(text, W - marginX * 2 - labelWidth);
    lines.forEach((line: string, i: number) => {
      if (i > 0) {
        ensureRoom(lineHeight);
        doc.text(line, marginX, y);
        y += lineHeight;
      } else {
        doc.text(line, marginX + labelWidth, y);
        y += lineHeight;
      }
    });
    y += 6;
  }

  // ACHIEVEMENTS
  if (cv.achievements.length) {
    sectionHeader(template === 'harvard-executive' ? 'Signature Achievements' : 'Key Achievements');
    cv.achievements.forEach((a) => bulletLine(a));
  }

  const ab = doc.output('arraybuffer');
  return Buffer.from(ab as ArrayBuffer);
}
