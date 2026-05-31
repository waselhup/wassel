import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  Tab,
  TabStopType,
  TabStopPosition,
} from 'docx';
import { CAIRO_FONT_BASE64 } from './cairo-font-data';
import { renderHtmlToPdf } from './arabic-pdf-renderer';
import type { Resume } from './resume-engine';

/**
 * Resume export helpers — PDF (headless Chromium) + DOCX (docx).
 *
 * All exports cost 0 tokens. The layouts are ATS-friendly (single column,
 * standard headings, no images/tables in body) but M3 makes the two surviving
 * templates render GENUINELY differently — Harvard ≠ MIT — instead of sharing
 * one renderer:
 *
 *   • Harvard (layout 'classic'): a centered name block, serif type, section
 *     headers as full-width underlined small-caps, role-first experience
 *     lines ("Role — Company  …… dates"). The traditional one-pager.
 *   • MIT (layout 'modern'): a left-aligned name with an accent rule, sans
 *     type, compact UPPERCASE section labels with a short accent underline,
 *     COMPANY-first experience lines with the role italic beneath, and a
 *     monospace tint on dates/skills — an engineer's layout.
 *
 * Any other / legacy template_id falls back to the Harvard classic layout.
 *
 * RTL note: the PDF renders HTML through headless Chromium (Arabic shaped,
 * ligated, bidi-correct) with Cairo embedded as a base64 data URI. The DOCX
 * uses the `docx` library's native RTL support.
 */

const CAIRO_DATA_URI = `data:font/ttf;base64,${CAIRO_FONT_BASE64}`;

const FONT_FACE = `@font-face {
  font-family: 'Cairo';
  font-style: normal;
  font-weight: 100 900;
  font-display: block;
  src: url('${CAIRO_DATA_URI}') format('truetype');
}`;

// Latin display fonts differ per layout to reinforce the visual identity. For
// Arabic, Cairo carries both (no Latin serif/mono exists in the embedded set),
// so the divergence on Arabic resumes is layout/structure, not typeface.
const HARVARD_FONT = `'Cairo', 'Georgia', 'Times New Roman', serif`;
const MIT_FONT = `'Cairo', 'Helvetica Neue', Arial, sans-serif`;
const MONO_FONT = `'JetBrains Mono', 'Courier New', monospace`;

export type ResumeLayout = 'classic' | 'modern';

/**
 * Map the stored template_id to a renderer layout. Kept here (not a DB read)
 * so export stays a pure function of the cached Resume. harvard_classic →
 * classic; mit_technical → modern; anything else → classic (safe default).
 */
export function layoutForTemplate(templateId: string | undefined | null): ResumeLayout {
  if (templateId === 'mit_technical') return 'modern';
  return 'classic';
}

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

/**
 * Build a single-column, ATS-friendly HTML document for the resume. The layout
 * (classic = Harvard, modern = MIT) drives typography, the name block, section
 * headers, and the experience line order so the two templates are visually
 * distinct (M3 acceptance gate: Harvard ≠ MIT).
 */
export function buildResumeHtml(resume: Resume): string {
  const isRTL = resume.meta?.language === 'ar';
  const dir: 'rtl' | 'ltr' = isRTL ? 'rtl' : 'ltr';
  const lang = isRTL ? 'ar' : 'en';
  const h = HEADINGS[lang];
  const layout = layoutForTemplate(resume.meta?.template_id);
  const isMit = layout === 'modern';

  // Both layouts emit the same `.sh` element; the visual divergence (Harvard's
  // full-width underlined header vs MIT's inline accent-underlined label) is
  // driven entirely by the per-layout `.sh` CSS below.
  const sectionHeader = (title: string): string => `<div class="sh">${esc(title)}</div>`;

  let sections = '';

  // Summary
  if (resume.summary) {
    sections += sectionHeader(h.summary) + `<p class="summary">${esc(resume.summary)}</p>`;
  }

  // Experience — Harvard: "Role — Company". MIT: "Company" bold, role italic beneath.
  if (resume.experience.length > 0) {
    let body = '';
    for (const exp of resume.experience) {
      const dates = [exp.start, exp.end].filter((p) => p && p.trim()).join(' – ');
      const bullets = exp.bullets.length
        ? `<ul>${exp.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>`
        : '';
      if (isMit) {
        body += `<div class="entry">
          <div class="row"><span class="company">${esc(exp.company)}</span><span class="right dates">${esc(dates)}</span></div>
          <div class="role-line"><span class="role-italic">${esc(exp.role)}</span>${exp.location ? `<span class="loc"> · ${esc(exp.location)}</span>` : ''}</div>
          ${bullets}
        </div>`;
      } else {
        body += `<div class="entry">
          <div class="row"><span class="bold">${esc(exp.role)} — ${esc(exp.company)}</span><span class="right muted">${esc(dates)}</span></div>
          ${exp.location ? `<p class="muted">${esc(exp.location)}</p>` : ''}
          ${bullets}
        </div>`;
      }
    }
    sections += sectionHeader(h.experience) + body;
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
    sections += sectionHeader(h.education) + body;
  }

  // Skills — MIT renders them as monospace "chips" inline; Harvard as prose.
  if (resume.skills.hard.length > 0 || resume.skills.soft.length > 0) {
    let body = '';
    if (isMit) {
      const all = [...resume.skills.hard, ...resume.skills.soft];
      body = `<p class="skills-mono">${all.map((s) => esc(s)).join('  ·  ')}</p>`;
    } else {
      if (resume.skills.hard.length > 0) body += `<p>${esc(resume.skills.hard.join(', '))}</p>`;
      if (resume.skills.soft.length > 0) body += `<p>${esc(resume.skills.soft.join(', '))}</p>`;
    }
    sections += sectionHeader(h.skills) + body;
  }

  // Certifications
  if (resume.certifications.length > 0) {
    const items = resume.certifications.map((c) => {
      const parts = [c.name, c.issuer, c.year ? `(${c.year})` : ''].filter(Boolean);
      return `<li>${esc(parts.join(' — '))}</li>`;
    }).join('');
    sections += sectionHeader(h.certifications) + `<ul>${items}</ul>`;
  }

  // Languages
  if (resume.languages.length > 0) {
    const text = resume.languages
      .map((l) => `${l.name}${l.proficiency ? ` (${l.proficiency})` : ''}`)
      .join(', ');
    sections += sectionHeader(h.languages) + `<p>${esc(text)}</p>`;
  }

  const contact = joinHeader([
    resume.header.email,
    resume.header.phone,
    resume.header.location,
    resume.header.linkedin_url,
  ]);

  // ── Layout-specific CSS + name block ────────────────────────────────
  const baseFont = isMit ? MIT_FONT : HARVARD_FONT;

  const harvardCss = `
  body { font-family: ${baseFont}; font-size: 10.5pt; line-height: 1.45; color: #111; direction: ${dir}; }
  .namewrap { text-align: center; margin-bottom: 12px; }
  .name { font-size: 21pt; font-weight: 700; letter-spacing: 0.5px; }
  .title { font-size: 12pt; color: #333; margin-top: 2px; }
  .contact { font-size: 9.5pt; color: #555; margin-top: 4px; }
  .sh {
    font-weight: 700; font-size: 10.5pt; letter-spacing: 1px; text-transform: uppercase;
    margin-top: 15px; margin-bottom: 7px; padding-bottom: 3px; border-bottom: 1.2px solid #222;
  }
  .summary { margin-bottom: 4px; }
  .entry { margin-bottom: 9px; }
  .row { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
  .bold { font-weight: 700; }
  .muted { color: #555; }
  .right { flex-shrink: 0; white-space: nowrap; }
  ul { padding-inline-start: 18px; margin: 4px 0 2px; }
  li { margin-bottom: 2px; line-height: 1.4; }
  p { margin-bottom: 4px; }`;

  const mitCss = `
  body { font-family: ${baseFont}; font-size: 10pt; line-height: 1.4; color: #1a1a1a; direction: ${dir}; }
  .namewrap { text-align: ${isRTL ? 'right' : 'left'}; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2.5px solid #6b1f1f; }
  .name { font-size: 20pt; font-weight: 800; letter-spacing: -0.3px; }
  .title { font-size: 11pt; color: #6b1f1f; font-weight: 600; margin-top: 1px; }
  .contact { font-family: ${MONO_FONT}; font-size: 8.5pt; color: #555; margin-top: 4px; }
  .sh {
    font-weight: 800; font-size: 9.5pt; letter-spacing: 2px; text-transform: uppercase; color: #6b1f1f;
    margin-top: 14px; margin-bottom: 6px; display: inline-block; border-bottom: 2px solid #6b1f1f; padding-bottom: 1px;
  }
  .summary { margin-bottom: 4px; }
  .entry { margin-bottom: 8px; }
  .row { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
  .company { font-weight: 800; }
  .role-line { margin-top: 1px; }
  .role-italic { font-style: italic; color: #333; }
  .loc { color: #777; }
  .dates { font-family: ${MONO_FONT}; font-size: 8.5pt; color: #555; }
  .right { flex-shrink: 0; white-space: nowrap; }
  .skills-mono { font-family: ${MONO_FONT}; font-size: 9pt; color: #222; }
  ul { padding-inline-start: 16px; margin: 3px 0 2px; }
  li { margin-bottom: 2px; line-height: 1.38; }
  p { margin-bottom: 4px; }`;

  const nameBlock = `<div class="namewrap">
    <div class="name">${esc(resume.header.name)}</div>
    ${resume.header.title ? `<div class="title">${esc(resume.header.title)}</div>` : ''}
    ${contact ? `<div class="contact">${esc(contact)}</div>` : ''}
  </div>`;

  return `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head>
<meta charset="utf-8" />
<title>${esc(resume.header.name)} — Resume</title>
<style>
  ${FONT_FACE}
  @page { size: A4; margin: 16mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  ${isMit ? mitCss : harvardCss}
</style>
</head>
<body>
  ${nameBlock}
  ${sections}
</body>
</html>`;
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

// MIT accent for DOCX (matches the PDF's maroon rule). Harvard stays black.
const MIT_ACCENT = '6B1F1F';

export async function exportToDocx(resume: Resume): Promise<Uint8Array> {
  const isAr = resume.meta?.language === 'ar';
  const layout = layoutForTemplate(resume.meta?.template_id);
  const isMit = layout === 'modern';
  const sections: Paragraph[] = [];

  // Header — Harvard centers the name; MIT left-aligns it with an accent rule.
  sections.push(new Paragraph({
    children: [new TextRun({ text: resume.header.name || '', bold: true, size: isMit ? 34 : 36, color: isMit ? '1A1A1A' : '000000' })],
    alignment: isMit ? AlignmentType.START : AlignmentType.CENTER,
    bidirectional: isAr,
  }));
  if (resume.header.title) {
    sections.push(new Paragraph({
      children: [new TextRun({ text: resume.header.title, size: 24, color: isMit ? MIT_ACCENT : '333333', bold: isMit })],
      alignment: isMit ? AlignmentType.START : AlignmentType.CENTER,
      bidirectional: isAr,
    }));
  }
  const contact = joinHeader([resume.header.email, resume.header.phone, resume.header.location, resume.header.linkedin_url]);
  if (contact) {
    sections.push(new Paragraph({
      children: [new TextRun({ text: contact, size: 18, font: isMit ? 'Courier New' : undefined, color: '555555' })],
      alignment: isMit ? AlignmentType.START : AlignmentType.CENTER,
      bidirectional: isAr,
      // MIT: an accent rule under the header block.
      border: isMit ? { bottom: { style: BorderStyle.SINGLE, size: 18, color: MIT_ACCENT, space: 4 } } : undefined,
    }));
  }
  sections.push(new Paragraph({ children: [] }));

  function heading(label: string) {
    sections.push(new Paragraph({
      children: [new TextRun({
        text: label.toUpperCase(),
        bold: true,
        size: isMit ? 20 : 24,
        color: isMit ? MIT_ACCENT : '222222',
        // letter-spacing isn't a docx run prop; the visual difference comes
        // from color + size + the underline border below.
      })],
      heading: HeadingLevel.HEADING_2,
      bidirectional: isAr,
      border: { bottom: { style: BorderStyle.SINGLE, size: isMit ? 12 : 8, color: isMit ? MIT_ACCENT : '222222', space: 2 } },
    }));
  }
  function para(text: string, opts: { bold?: boolean; size?: number; italics?: boolean; font?: string; color?: string } = {}) {
    sections.push(new Paragraph({
      children: [new TextRun({ text, bold: opts.bold, italics: opts.italics, size: opts.size ?? 22, font: opts.font, color: opts.color })],
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
    heading(HEADINGS[isAr ? 'ar' : 'en'].summary);
    para(resume.summary);
  }

  if (resume.experience.length > 0) {
    heading(HEADINGS[isAr ? 'ar' : 'en'].experience);
    for (const exp of resume.experience) {
      if (isMit) {
        // MIT: company-first bold line + dates (mono); role italic beneath.
        sections.push(new Paragraph({
          children: [
            new TextRun({ text: exp.company, bold: true, size: 22 }),
            new TextRun({ children: [new Tab()] }),
            new TextRun({ text: `${exp.start} – ${exp.end}`, size: 18, font: 'Courier New', color: '555555' }),
          ],
          tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
          bidirectional: isAr,
        }));
        para(exp.location ? `${exp.role} · ${exp.location}` : exp.role, { italics: true, size: 20, color: '333333' });
      } else {
        // Harvard: role — company bold line + dates.
        sections.push(new Paragraph({
          children: [
            new TextRun({ text: `${exp.role} — ${exp.company}`, bold: true, size: 22 }),
            new TextRun({ children: [new Tab()] }),
            new TextRun({ text: `${exp.start} – ${exp.end}`, size: 20, color: '555555' }),
          ],
          tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
          bidirectional: isAr,
        }));
        if (exp.location) para(exp.location, { size: 20, color: '555555' });
      }
      for (const b of exp.bullets) bullet(b);
      sections.push(new Paragraph({ children: [] }));
    }
  }

  if (resume.education.length > 0) {
    heading(HEADINGS[isAr ? 'ar' : 'en'].education);
    for (const ed of resume.education) {
      para(`${ed.degree} — ${ed.institution}${ed.graduated ? ' (' + ed.graduated + ')' : ''}`, { bold: true });
      if (ed.honors) para(ed.honors, { size: 20, color: '555555' });
    }
  }

  if (resume.skills.hard.length > 0 || resume.skills.soft.length > 0) {
    heading(HEADINGS[isAr ? 'ar' : 'en'].skills);
    if (isMit) {
      // MIT: one monospace line of all skills, dot-separated.
      para([...resume.skills.hard, ...resume.skills.soft].join('  ·  '), { font: 'Courier New', size: 20 });
    } else {
      if (resume.skills.hard.length > 0) para(`${isAr ? 'تقنية' : 'Hard'}: ${resume.skills.hard.join(', ')}`);
      if (resume.skills.soft.length > 0) para(`${isAr ? 'ناعمة' : 'Soft'}: ${resume.skills.soft.join(', ')}`);
    }
  }

  if (resume.certifications.length > 0) {
    heading(HEADINGS[isAr ? 'ar' : 'en'].certifications);
    for (const c of resume.certifications) bullet(`${c.name} — ${c.issuer}${c.year ? ' (' + c.year + ')' : ''}`);
  }

  if (resume.languages.length > 0) {
    heading(HEADINGS[isAr ? 'ar' : 'en'].languages);
    para(resume.languages.map((l) => `${l.name} (${l.proficiency})`).join(', '));
  }

  const doc = new Document({
    sections: [{ properties: {}, children: sections }],
  });
  const buf = await Packer.toBuffer(doc);
  return new Uint8Array(buf);
}
