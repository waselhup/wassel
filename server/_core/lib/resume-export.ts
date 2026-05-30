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
import { CAIRO_FONT_BASE64 } from './cairo-font-data';
import { renderHtmlToPdf } from './arabic-pdf-renderer';
import type { Resume } from './resume-engine';

/**
 * Resume export helpers — PDF (headless Chromium), DOCX (docx), and raw JSON.
 *
 * All exports cost 0 tokens (per Sprint 4 prompt). The layouts are
 * intentionally minimal and ATS-friendly: one column, plain text,
 * standard section headings, no images or tables in body content.
 *
 * RTL note: the PDF export renders an HTML document through headless
 * Chromium (the same proven path the CV builder uses), so Arabic is
 * shaped, ligated, and bidi-ordered correctly — no "tofu" boxes. The
 * Cairo font is embedded as a base64 data URI so the render needs no
 * network. The DOCX export uses the `docx` library's native RTL support
 * and round-trips perfectly in Word.
 */

const CAIRO_DATA_URI = `data:font/ttf;base64,${CAIRO_FONT_BASE64}`;

const FONT_FACE = `@font-face {
  font-family: 'Cairo';
  font-style: normal;
  font-weight: 100 900;
  font-display: block;
  src: url('${CAIRO_DATA_URI}') format('truetype');
}`;

const BASE_FONT = `'Cairo', 'Noto Sans Arabic', 'Calibri', Arial, sans-serif`;

const ESCAPE: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
};
function esc(s: string | null | undefined): string {
  if (!s) return '';
  return String(s).replace(/[&<>"']/g, (c) => ESCAPE[c] ?? c);
}

type Headings = {
  summary: string;
  experience: string;
  education: string;
  skills: string;
  certifications: string;
  languages: string;
};

const HEADINGS: Record<'ar' | 'en', Headings> = {
  ar: {
    summary: 'الملخص',
    experience: 'الخبرة',
    education: 'التعليم',
    skills: 'المهارات',
    certifications: 'الشهادات',
    languages: 'اللغات',
  },
  en: {
    summary: 'Summary',
    experience: 'Experience',
    education: 'Education',
    skills: 'Skills',
    certifications: 'Certifications',
    languages: 'Languages',
  },
};

function joinHeader(parts: Array<string | null | undefined>): string {
  return parts.filter((p) => p && p.trim()).join(' · ');
}

export function exportToJson(resume: Resume): string {
  return JSON.stringify(resume, null, 2);
}

/**
 * Build a single-column, ATS-friendly HTML document for the resume, with
 * the Cairo font embedded so headless Chromium can shape Arabic correctly.
 */
export function buildResumeHtml(resume: Resume): string {
  const isRTL = resume.meta?.language === 'ar';
  const dir: 'rtl' | 'ltr' = isRTL ? 'rtl' : 'ltr';
  const lang = isRTL ? 'ar' : 'en';
  const h = HEADINGS[lang];

  let sections = '';

  // Summary
  if (resume.summary) {
    sections += section(h.summary, `<p>${esc(resume.summary)}</p>`);
  }

  // Experience
  if (resume.experience.length > 0) {
    let body = '';
    for (const exp of resume.experience) {
      const dateParts = [exp.start, exp.end].filter((p) => p && p.trim());
      const dates = dateParts.join(' – ');
      const bullets = exp.bullets.length
        ? `<ul>${exp.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>`
        : '';
      body += `<div class="entry">
        <div class="row"><span class="bold">${esc(exp.role)} — ${esc(exp.company)}</span><span class="right muted">${esc(dates)}</span></div>
        ${exp.location ? `<p class="muted">${esc(exp.location)}</p>` : ''}
        ${bullets}
      </div>`;
    }
    sections += section(h.experience, body);
  }

  // Education
  if (resume.education.length > 0) {
    let body = '';
    for (const ed of resume.education) {
      body += `<div class="entry">
        <div class="row"><span class="bold">${esc(ed.degree)} — ${esc(ed.institution)}</span><span class="right muted">${esc(ed.graduated)}</span></div>
        ${ed.honors ? `<p class="muted">${esc(ed.honors)}</p>` : ''}
      </div>`;
    }
    sections += section(h.education, body);
  }

  // Skills
  if (resume.skills.hard.length > 0 || resume.skills.soft.length > 0) {
    let body = '';
    if (resume.skills.hard.length > 0) {
      body += `<p>${esc(resume.skills.hard.join(', '))}</p>`;
    }
    if (resume.skills.soft.length > 0) {
      body += `<p>${esc(resume.skills.soft.join(', '))}</p>`;
    }
    sections += section(h.skills, body);
  }

  // Certifications
  if (resume.certifications.length > 0) {
    const items = resume.certifications.map((c) => {
      const parts = [c.name, c.issuer, c.year ? `(${c.year})` : ''].filter(Boolean);
      return `<li>${esc(parts.join(' — '))}</li>`;
    }).join('');
    sections += section(h.certifications, `<ul>${items}</ul>`);
  }

  // Languages
  if (resume.languages.length > 0) {
    const text = resume.languages
      .map((l) => `${l.name}${l.proficiency ? ` (${l.proficiency})` : ''}`)
      .join(', ');
    sections += section(h.languages, `<p>${esc(text)}</p>`);
  }

  const contact = joinHeader([
    resume.header.email,
    resume.header.phone,
    resume.header.location,
    resume.header.linkedin_url,
  ]);

  return `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head>
<meta charset="utf-8" />
<title>${esc(resume.header.name)} — Resume</title>
<style>
  ${FONT_FACE}
  @page { size: A4; margin: 16mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: ${BASE_FONT};
    font-size: 10.5pt;
    line-height: 1.45;
    color: #000;
    direction: ${dir};
  }
  .name {
    font-size: 18pt;
    font-weight: 700;
    margin-bottom: 2px;
  }
  .title {
    font-size: 12pt;
    color: #333;
    margin-bottom: 4px;
  }
  .contact {
    font-size: 9.5pt;
    color: #555;
    margin-bottom: 14px;
  }
  .section-header {
    font-weight: 700;
    font-size: 11pt;
    margin-top: 14px;
    padding-bottom: 3px;
    border-bottom: 1px solid #444;
    margin-bottom: 8px;
  }
  .entry { margin-bottom: 8px; }
  .row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12px;
  }
  .bold { font-weight: 700; }
  .muted { color: #555; }
  .right { flex-shrink: 0; white-space: nowrap; }
  ul {
    padding-inline-start: 18px;
    margin: 4px 0 2px;
  }
  li { margin-bottom: 2px; line-height: 1.4; }
  p { margin-bottom: 4px; }
</style>
</head>
<body>
  <div class="name">${esc(resume.header.name)}</div>
  ${resume.header.title ? `<div class="title">${esc(resume.header.title)}</div>` : ''}
  ${contact ? `<div class="contact">${esc(contact)}</div>` : ''}
  ${sections}
</body>
</html>`;
}

function section(title: string, body: string): string {
  return `<div class="section-header">${esc(title)}</div>${body}`;
}

export async function exportToPdf(resume: Resume): Promise<Uint8Array> {
  const html = buildResumeHtml(resume);
  const dir: 'rtl' | 'ltr' = resume.meta?.language === 'ar' ? 'rtl' : 'ltr';
  const pdfBuffer = await renderHtmlToPdf({
    html,
    dir,
    format: 'A4',
    margin: { top: '16mm', right: '16mm', bottom: '16mm', left: '16mm' },
  });
  return new Uint8Array(pdfBuffer);
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
