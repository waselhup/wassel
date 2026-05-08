import { callClaude, extractText, extractJson } from './claude-client';
import { parseDocument, type ParseMethod as DocParseMethod } from './document-parser';

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

const METHOD_MAP: Record<DocParseMethod, ParseMethod> = {
  'pdf-text': 'pdf-text',
  'pdf-ocr': 'pdf-ocr',
  'docx': 'docx',
  'image-ocr': 'pdf-ocr',
  'text': 'docx',
};

export async function extractTextFromFile(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<ExtractTextResult> {
  const result = await parseDocument(buffer, mimeType, fileName);
  return {
    text: result.text,
    method: METHOD_MAP[result.method] || 'docx',
  };
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
