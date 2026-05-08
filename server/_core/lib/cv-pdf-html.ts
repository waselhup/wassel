import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CVData, CVTemplate } from './cv-generator';
import type { CoverLetterContent, CandidateInfo } from './cover-letter-generator';

let CAIRO_DATA_URI = '';

function tryLoadCairo(): Buffer | null {
  const candidates: string[] = [];
  try {
    const dir = typeof __dirname !== 'undefined'
      ? __dirname
      : dirname(fileURLToPath(import.meta.url));
    candidates.push(join(dir, 'fonts', 'Cairo.ttf'));
  } catch { /* swallow */ }
  candidates.push(join(process.cwd(), 'api', 'fonts', 'Cairo.ttf'));
  candidates.push(join(process.cwd(), 'server', '_core', 'lib', 'fonts', 'Cairo.ttf'));
  candidates.push(join(process.cwd(), 'fonts', 'Cairo.ttf'));

  for (const p of candidates) {
    try { return readFileSync(p); } catch { /* next */ }
  }
  return null;
}

const cairoBuf = tryLoadCairo();
if (cairoBuf) {
  CAIRO_DATA_URI = `data:font/ttf;base64,${cairoBuf.toString('base64')}`;
} else {
  console.warn('[cv-pdf-html] Cairo.ttf not found — Arabic will use system fallback');
}

const ESCAPE: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
};
function esc(s: string | null | undefined): string {
  if (!s) return '';
  return String(s).replace(/[&<>"']/g, (c) => ESCAPE[c] ?? c);
}

const FONT_FACE = CAIRO_DATA_URI
  ? `@font-face {
      font-family: 'Cairo';
      font-style: normal;
      font-weight: 100 900;
      font-display: block;
      src: url('${CAIRO_DATA_URI}') format('truetype');
    }`
  : '';

const BASE_FONT = `'Cairo', 'Thmanyah Sans', 'Noto Sans Arabic', 'Calibri', 'Helvetica Neue', Arial, sans-serif`;

export function buildCVHtml(cv: CVData, template: CVTemplate): string {
  const isMIT = template === 'mit-classic';
  const NAVY = '#1e3a5f';

  const contactParts = [cv.contact.location, cv.contact.phone, cv.contact.email, cv.contact.linkedinUrl]
    .filter(Boolean).map(esc);
  const sep = isMIT ? ' &bull; ' : ' | ';

  let sections = '';

  if (cv.summary) {
    sections += sectionBlock(
      isMIT ? 'Professional Summary' : 'Executive Summary',
      `<p>${esc(cv.summary)}</p>`,
      isMIT, NAVY
    );
  }

  if (cv.experience.length) {
    let body = '';
    for (const exp of cv.experience) {
      if (isMIT) {
        body += `<div class="entry">
          <div class="row"><span class="bold">${esc(exp.company)}</span><span class="right">${esc(exp.location)}</span></div>
          <div class="row"><span class="italic">${esc(exp.title)}</span><span class="right italic">${esc(exp.dates)}</span></div>
          ${bulletList(exp.bullets)}
        </div>`;
      } else {
        body += `<div class="entry">
          <div class="row"><span class="bold" style="color:${NAVY}">${esc(exp.title)}</span><span class="right muted">${esc(exp.dates)}</span></div>
          <p class="italic muted">${esc([exp.company, exp.location].filter(Boolean).join(' | '))}</p>
          ${bulletList(exp.bullets)}
        </div>`;
      }
    }
    sections += sectionBlock('Professional Experience', body, isMIT, NAVY);
  }

  if (cv.education.length) {
    let body = '';
    for (const edu of cv.education) {
      if (isMIT) {
        body += `<div class="entry">
          <div class="row"><span class="bold">${esc(edu.school)}</span><span class="right">${esc(edu.location)}</span></div>
          <div class="row"><span class="italic">${esc(edu.degree)}</span><span class="right italic">${esc(edu.year)}</span></div>
          ${bulletList(edu.achievements)}
        </div>`;
      } else {
        body += `<div class="entry">
          <div class="row"><span class="bold" style="color:${NAVY}">${esc(edu.school)}</span><span class="right muted">${esc(edu.year)}</span></div>
          <p class="italic muted">${esc([edu.degree, edu.location].filter(Boolean).join(' | '))}</p>
          ${bulletList(edu.achievements)}
        </div>`;
      }
    }
    sections += sectionBlock('Education', body, isMIT, NAVY);
  }

  if (cv.certifications.length) {
    const body = cv.certifications.map((c) => {
      const parts = [c.name, c.issuer, c.year ? `(${c.year})` : ''].filter(Boolean);
      return `<li>${esc(parts.join(' — '))}</li>`;
    }).join('');
    sections += sectionBlock(
      isMIT ? 'Certifications & Licenses' : 'Certifications & Licenses',
      `<ul>${body}</ul>`, isMIT, NAVY
    );
  }

  if (cv.skills.length) {
    const body = cv.skills.map((g) =>
      `<p><span class="bold" ${!isMIT ? `style="color:${NAVY}"` : ''}>${esc(g.categoryName)}:</span> ${esc((g.items || []).join(', '))}</p>`
    ).join('');
    sections += sectionBlock(
      isMIT ? 'Technical Skills' : 'Core Competencies',
      body, isMIT, NAVY
    );
  }

  if (cv.languages.length) {
    const text = cv.languages
      .map((l) => `${l.name}${l.proficiency ? ` (${l.proficiency})` : ''}`)
      .join(', ');
    sections += `<p style="margin-top:8px"><span class="bold" ${!isMIT ? `style="color:${NAVY}"` : ''}>Languages:</span> ${esc(text)}</p>`;
  }

  if (cv.achievements.length) {
    const body = cv.achievements.map((a) => `<li>${esc(a)}</li>`).join('');
    sections += sectionBlock(
      isMIT ? 'Key Achievements' : 'Signature Achievements',
      `<ul>${body}</ul>`, isMIT, NAVY
    );
  }

  return `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8" />
<title>${esc(cv.fullName)} — CV</title>
<style>
  ${FONT_FACE}
  @page { size: letter; margin: 16mm 18mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: ${BASE_FONT};
    font-size: 10pt;
    line-height: 1.45;
    color: #000;
  }
  .name {
    font-size: ${isMIT ? '16pt' : '18pt'};
    font-weight: 700;
    ${isMIT ? 'text-align: center; text-transform: uppercase;' : `color: ${NAVY};`}
    margin-bottom: 4px;
  }
  .contact {
    font-size: 10pt;
    ${isMIT ? 'text-align: center;' : `color: #555;`}
    margin-bottom: 16px;
  }
  .section-header {
    text-transform: uppercase;
    font-weight: 700;
    font-size: 11pt;
    margin-top: 14px;
    padding-bottom: 3px;
    border-bottom: ${isMIT ? '1px solid #000' : `1.5px solid ${NAVY}`};
    margin-bottom: 8px;
    ${isMIT ? '' : `color: ${NAVY};`}
  }
  .entry { margin-bottom: 8px; }
  .row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }
  .bold { font-weight: 700; }
  .italic { font-style: italic; }
  .muted { color: #666; }
  .right { text-align: right; flex-shrink: 0; margin-left: 12px; }
  ul {
    padding-left: 18px;
    margin: 4px 0 2px;
  }
  li {
    margin-bottom: 2px;
    line-height: 1.4;
  }
  p { margin-bottom: 4px; }
</style>
</head>
<body>
  <div class="name">${esc(cv.fullName)}</div>
  <div class="contact">${contactParts.join(sep)}</div>
  ${sections}
</body>
</html>`;
}

export function buildCoverLetterHtml(
  content: CoverLetterContent,
  candidateInfo: CandidateInfo,
  language: 'ar' | 'en'
): string {
  const isRTL = language === 'ar';
  const dir = isRTL ? 'rtl' : 'ltr';
  const align = isRTL ? 'right' : 'left';

  const contactLine = [candidateInfo.email, candidateInfo.phone, candidateInfo.location]
    .filter(Boolean).map(esc).join(' | ');

  const today = new Date().toLocaleDateString(
    language === 'ar' ? 'ar-SA' : 'en-US',
    { year: 'numeric', month: 'long', day: 'numeric' }
  );

  const paragraphs = content.paragraphs
    .map((p) => `<p>${esc(p)}</p>`)
    .join('');

  const sigLines = content.signature.split('\n')
    .map((line, i, arr) =>
      i === arr.length - 1
        ? `<p class="bold">${esc(line)}</p>`
        : `<p>${esc(line)}</p>`
    ).join('');

  return `<!DOCTYPE html>
<html lang="${language}" dir="${dir}">
<head>
<meta charset="utf-8" />
<title>Cover Letter — ${esc(candidateInfo.name)}</title>
<style>
  ${FONT_FACE}
  @page { size: A4; margin: 20mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: ${BASE_FONT};
    font-size: 11pt;
    line-height: 1.65;
    color: #111;
    direction: ${dir};
    text-align: ${align};
  }
  .header-name {
    font-size: 16pt;
    font-weight: 700;
    margin-bottom: 2px;
  }
  .header-contact {
    font-size: 10pt;
    color: #555;
    margin-bottom: 18px;
  }
  .date {
    margin-bottom: 18px;
  }
  .greeting {
    margin-bottom: 14px;
  }
  .body-text p {
    margin-bottom: 12px;
  }
  .signature {
    margin-top: 20px;
  }
  .bold { font-weight: 700; }
</style>
</head>
<body>
  <div class="header-name">${esc(candidateInfo.name)}</div>
  <div class="header-contact">${contactLine}</div>
  <div class="date">${esc(today)}</div>
  <div class="greeting">${esc(content.greeting)}</div>
  <div class="body-text">${paragraphs}</div>
  <div class="signature">${sigLines}</div>
</body>
</html>`;
}

function sectionBlock(title: string, body: string, isMIT: boolean, navy: string): string {
  return `<div class="section-header" ${!isMIT ? `style="color:${navy};border-color:${navy}"` : ''}>${esc(title).toUpperCase()}</div>${body}`;
}

function bulletList(items: string[]): string {
  if (!items || items.length === 0) return '';
  return `<ul>${items.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>`;
}
