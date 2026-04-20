import mammoth from 'mammoth';
import { callClaude, extractText, extractJson } from './claude-client';

export type ParseMethod = 'docx' | 'pdf-text' | 'pdf-ocr' | 'manual';

export interface ExtractedCV {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  linkedinUrl: string;
  currentRole: string;
  currentCompany: string;
  yearsExperience: number;
  summary: string;
  skills: string[];
  languages: Array<{ name: string; proficiency: string }>;
  education: Array<{
    school: string;
    degree: string;
    field: string;
    year: string;
    achievements: string[];
  }>;
  experience: Array<{
    title: string;
    company: string;
    location: string;
    startDate: string;
    endDate: string;
    bullets: string[];
  }>;
  certifications: Array<{ name: string; issuer: string; year: string }>;
  achievements: string[];
}

export interface ExtractTextResult {
  text: string;
  method: ParseMethod;
}

/**
 * Extract raw text from a CV file buffer. Supports PDF (pdf-parse),
 * DOCX (mammoth), and plain text. Attempts OCR fallback for scanned PDFs
 * via tesseract.js when the text layer is missing.
 *
 * Throws a user-facing Error on unsupported types or fully unreadable PDFs.
 */
export async function extractTextFromFile(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<ExtractTextResult> {
  const ext = (fileName.toLowerCase().split('.').pop() || '').trim();

  if ((mimeType && mimeType.includes('pdf')) || ext === 'pdf') {
    // First try: extract text layer via pdf-parse
    try {
      const pdfMod: any = await import('pdf-parse');
      const pdf = pdfMod.default || pdfMod;
      const data = await pdf(buffer);
      if (data?.text && data.text.trim().length >= 100) {
        return { text: data.text as string, method: 'pdf-text' };
      }
      // Text layer too thin — attempt OCR
      console.log('[cv-parser] PDF text layer <100 chars, attempting OCR fallback...');
    } catch (err: any) {
      console.error('[cv-parser] pdf-parse failed:', err?.message);
    }

    // OCR fallback
    try {
      const ocrText = await extractTextViaOCR(buffer);
      if (ocrText && ocrText.trim().length >= 100) {
        return { text: ocrText, method: 'pdf-ocr' };
      }
    } catch (ocrErr: any) {
      console.error('[cv-parser] OCR failed:', ocrErr?.message);
    }

    throw new Error(
      'لم نتمكن من قراءة الـ PDF — يبدو أنه ممسوح ضوئياً أو فارغ. ' +
      'الحل: ارفع ملف Word (.docx) للحصول على أدق استخراج، أو أعد إنشاء PDF من Word.'
    );
  }

  if (
    (mimeType && (mimeType.includes('wordprocessingml') || mimeType.includes('officedocument'))) ||
    ext === 'docx'
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return { text: result.value, method: 'docx' };
  }

  if ((mimeType && mimeType.includes('text')) || ext === 'txt') {
    return { text: buffer.toString('utf-8'), method: 'docx' }; // treat as clean text
  }

  throw new Error(`Unsupported file type: ${mimeType || ext || 'unknown'}`);
}

/**
 * Attempt OCR on a scanned PDF using tesseract.js.
 * Render requires @napi-rs/canvas which isn't always available on Vercel
 * serverless. When unavailable, throws — upstream catches and returns the
 * guided error message instructing the user to upload Word.
 */
async function extractTextViaOCR(pdfBuffer: Buffer): Promise<string> {
  let createCanvas: any;
  try {
    const canvasMod: any = await import('@napi-rs/canvas');
    createCanvas = canvasMod.createCanvas;
  } catch {
    throw new Error('Canvas rendering unavailable in this environment');
  }

  const pdfjsMod: any = await import('pdfjs-dist/legacy/build/pdf.mjs');
  if (pdfjsMod.GlobalWorkerOptions) pdfjsMod.GlobalWorkerOptions.workerSrc = '';

  const { createWorker } = await import('tesseract.js');

  const loadingTask = pdfjsMod.getDocument({ data: new Uint8Array(pdfBuffer) });
  const pdfDoc = await loadingTask.promise;

  const maxPages = Math.min(pdfDoc.numPages, 3);
  const worker = await createWorker('ara+eng');

  let fullText = '';
  try {
    for (let i = 1; i <= maxPages; i++) {
      const page = await pdfDoc.getPage(i);
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = createCanvas(viewport.width, viewport.height);
      const context = canvas.getContext('2d');
      await page.render({ canvasContext: context, viewport }).promise;
      const pngBuf = canvas.toBuffer('image/png');
      const result = await worker.recognize(pngBuf);
      fullText += (result.data.text || '') + '\n\n';
    }
  } finally {
    await worker.terminate();
  }

  return fullText.trim();
}

const EXTRACTION_SYSTEM = `You are a precise CV parser. Extract structured data from raw CV text.

Return ONLY valid JSON matching this exact schema. No markdown fences. No commentary. No explanations.

{
  "fullName": string,
  "email": string,
  "phone": string,
  "location": string,
  "linkedinUrl": string,
  "currentRole": string,
  "currentCompany": string,
  "yearsExperience": number,
  "summary": string,
  "skills": string[],
  "languages": [{"name": string, "proficiency": string}],
  "education": [{"school": string, "degree": string, "field": string, "year": string, "achievements": string[]}],
  "experience": [{"title": string, "company": string, "location": string, "startDate": string, "endDate": string, "bullets": string[]}],
  "certifications": [{"name": string, "issuer": string, "year": string}],
  "achievements": string[]
}

Rules:
- Extract EVERYTHING present in the text. Don't skip anything.
- If field truly missing, use "" (empty string) or [] (empty array) — never null or undefined.
- Preserve bullets exactly as written (don't rewrite or summarize).
- Dates: format as shown in source (e.g. "Jun 2024 – Present", "2021 – 2022", "2020").
- LinkedIn: extract any linkedin.com/in/<handle> URL, return full URL.
- yearsExperience: calculate earliest role to latest (or present) as a number.
- currentRole/currentCompany: most recent position. If currently working ("Present"), use that role.
- skills: include ALL technical + soft + language skills mentioned anywhere in the CV.
- Split multi-skill lines into individual items (e.g. "SolidWorks, AutoCAD, MATLAB" → three items).`;

export async function extractCVFields(rawText: string): Promise<ExtractedCV> {
  const truncated = rawText.slice(0, 20000);

  const claudeRes = await callClaude({
    task: 'cv_parse',
    system: EXTRACTION_SYSTEM,
    userContent: `Extract CV fields from this text:\n\n---\n${truncated}\n---`,
    maxTokens: 4000,
  });

  const text = extractText(claudeRes);
  const parsed = extractJson<any>(text);
  if (!parsed) {
    console.error('[cv-parser] JSON parse failed. Raw:', text.slice(0, 500));
    throw new Error('Failed to parse CV structure');
  }

  return normalize(parsed);
}

function normalize(raw: any): ExtractedCV {
  const str = (v: any) => (typeof v === 'string' ? v : '');
  const num = (v: any) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  const arr = (v: any) => (Array.isArray(v) ? v : []);

  return {
    fullName: str(raw.fullName),
    email: str(raw.email),
    phone: str(raw.phone),
    location: str(raw.location),
    linkedinUrl: str(raw.linkedinUrl),
    currentRole: str(raw.currentRole),
    currentCompany: str(raw.currentCompany),
    yearsExperience: num(raw.yearsExperience),
    summary: str(raw.summary),
    skills: arr(raw.skills).filter((s: any) => typeof s === 'string' && s.trim()),
    languages: arr(raw.languages).map((l: any) => ({
      name: str(l?.name),
      proficiency: str(l?.proficiency),
    })).filter((l) => l.name),
    education: arr(raw.education).map((e: any) => ({
      school: str(e?.school),
      degree: str(e?.degree),
      field: str(e?.field),
      year: str(e?.year),
      achievements: arr(e?.achievements).filter((a: any) => typeof a === 'string' && a.trim()),
    })).filter((e) => e.school || e.degree),
    experience: arr(raw.experience).map((x: any) => ({
      title: str(x?.title),
      company: str(x?.company),
      location: str(x?.location),
      startDate: str(x?.startDate),
      endDate: str(x?.endDate),
      bullets: arr(x?.bullets).filter((b: any) => typeof b === 'string' && b.trim()),
    })).filter((x) => x.title || x.company),
    certifications: arr(raw.certifications).map((c: any) => ({
      name: str(c?.name),
      issuer: str(c?.issuer),
      year: str(c?.year),
    })).filter((c) => c.name),
    achievements: arr(raw.achievements).filter((a: any) => typeof a === 'string' && a.trim()),
  };
}
