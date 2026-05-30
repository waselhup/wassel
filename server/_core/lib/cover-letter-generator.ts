import { Document, Packer, Paragraph, TextRun, AlignmentType } from 'docx';
import { callClaude, extractText, extractJson } from './claude-client';
import { renderHtmlToPdf } from './arabic-pdf-renderer';
import { buildCoverLetterHtml } from './cv-pdf-html';
import { validateOutput } from './output-guard';
import { validateTone } from './content-tone-validator';
import { withBrain } from '../prompts/brain';

export interface CoverLetterInput {
  cvData: any;
  jobDescription: string;
  language: 'ar' | 'en';
  targetRole?: string;
  targetCompany?: string;
}

export interface CoverLetterContent {
  greeting: string;
  paragraphs: string[];
  signature: string;
}

const COVER_LETTER_SYSTEM = `You are an elite career advisor specializing in the Saudi/GCC job market.

Generate a professional cover letter using the candidate's CV data and the target job description.

STRUCTURE (4 paragraphs):

1. OPENING (2-3 sentences):
   - State the specific position applying for.
   - Include a hook: why THIS company, why now.
   - Brief value proposition.

2. VALUE PROPOSITION (3-4 sentences):
   - 2-3 strongest achievements from CV that match JD requirements.
   - Use numbers/metrics where possible.
   - Match JD keywords naturally.

3. CULTURAL FIT (2-3 sentences):
   - Mention specific company initiatives, values, or recent news when known.
   - Show research, not generic fluff.

4. CLOSING (1-2 sentences):
   - Invite for interview.
   - Professional sign-off.

LENGTH: 250-350 words total. ATS-friendly plain text.

TONE: Confident but not arrogant. Formal but warm. Never use:
- "To whom it may concern" → Use "Dear Hiring Manager" or Arabic equivalent.
- "I am writing to apply" → Jump to the hook.
- "I believe I am a good fit" → Show, don't tell.
- Clichés: "team player", "go-getter", "passionate".

LANGUAGE: Match 'language' parameter exactly.
- 'ar': Formal MSA (فصحى). Greeting: "حضرة مدير التوظيف،" — a professional business salutation. Never use a religious greeting.
- 'en': Professional English. Greeting: "Dear Hiring Manager,".

OUTPUT (strict JSON, no markdown fences, no commentary):
{
  "greeting": string,
  "paragraphs": [string, string, string, string],
  "signature": string
}

The signature must include a closing line and the candidate's name on a new line.
Example EN: "Sincerely,\\nMohammad Al-Ali"
Example AR: "مع خالص التقدير،\\nمحمد العلي"`;

// Strict addendum appended on a retry after a guard/tone violation. Names the
// specific failure modes so the model corrects them — mirrors the content
// engine's STRICT_GUARD pattern (A11 / L5 guard).
const STRICT_GUARD_AR =
  '\n\nإضافة صارمة: رُصد محتوى غير مطابق في المحاولة السابقة. لا تستخدم أي تحية دينية ("السلام عليكم"، "بسم الله")، ولا اسم أي منصة أو نموذج ذكاء اصطناعي، ولا أرقام عربية شرقية (استخدم 0-9). ابدأ بتحية مهنية: "حضرة مدير التوظيف،".';
const STRICT_GUARD_EN =
  '\n\nStrict addendum: non-compliant content was detected in the previous attempt. Do not use any religious salutation, any vendor or AI-model name, or Eastern Arabic digits (use 0-9). Open with a professional salutation: "Dear Hiring Manager,".';

async function callCoverLetter(
  userPrompt: string,
  strict: boolean,
  language: 'ar' | 'en',
): Promise<CoverLetterContent> {
  const guard = language === 'ar' ? STRICT_GUARD_AR : STRICT_GUARD_EN;
  const res = await callClaude({
    task: 'cv_generate',
    system: withBrain(COVER_LETTER_SYSTEM + (strict ? guard : '')),
    userContent: userPrompt,
    maxTokens: 2000,
  });

  const text = extractText(res);

  // L5 Output Guard: block banned vendor / model names + Eastern Arabic digits
  // on the RAW model text before we parse it.
  const outputCheck = validateOutput(text, 'cover_letter.generate');
  if (!outputCheck.valid) {
    throw new CoverLetterGuardError(`Output guard blocked: ${outputCheck.reason}`);
  }

  const parsed = extractJson<any>(text);
  if (!parsed) {
    throw new Error('Cover letter generator did not return valid JSON');
  }

  const content = normalizeCoverLetter(parsed);

  // Tone validation: catches religious salutations + vendor leaks in the
  // assembled letter (greeting + body + signature).
  const flat = [content.greeting, ...content.paragraphs, content.signature]
    .filter(Boolean)
    .join('\n\n');
  const toneCheck = validateTone(flat, language);
  if (!toneCheck.valid) {
    throw new CoverLetterGuardError(`Tone violation: ${toneCheck.violations.join(', ')}`);
  }

  return content;
}

// Thrown when the generated letter trips the output guard or tone validator.
// Distinct from a generic Error so the retry logic only re-rolls on a
// compliance failure, not on a transport/parse error.
class CoverLetterGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CoverLetterGuardError';
  }
}

export async function generateCoverLetterContent(
  input: CoverLetterInput
): Promise<CoverLetterContent> {
  const userPrompt = JSON.stringify({
    candidate: {
      name: input.cvData.fullName,
      email: input.cvData.contact?.email || input.cvData.email,
      phone: input.cvData.contact?.phone || input.cvData.phone,
      location: input.cvData.contact?.location || input.cvData.location,
      summary: input.cvData.summary,
      experience: input.cvData.experience,
      skills: input.cvData.skills,
    },
    jobDescription: input.jobDescription,
    targetRole: input.targetRole,
    targetCompany: input.targetCompany,
    language: input.language,
  });

  // First attempt. On a guard/tone failure, retry once with a strict addendum.
  // If the retry still fails compliance, throw — never return a non-compliant
  // draft. cv.generate's caller treats this as a non-fatal cover-letter failure
  // and partial-refunds the bundle surcharge.
  try {
    return await callCoverLetter(userPrompt, false, input.language);
  } catch (err) {
    if (!(err instanceof CoverLetterGuardError)) throw err;
    console.warn('[cover-letter] compliance failure, retrying strict:', err.message);
    return await callCoverLetter(userPrompt, true, input.language);
  }
}

function normalizeCoverLetter(raw: any): CoverLetterContent {
  const str = (v: any) => (typeof v === 'string' ? v : '');
  const arr = (v: any) => (Array.isArray(v) ? v : []);
  const paras = arr(raw.paragraphs).filter((p: any) => typeof p === 'string' && p.trim());
  return {
    greeting: str(raw.greeting) || 'Dear Hiring Manager,',
    paragraphs: paras,
    signature: str(raw.signature) || 'Sincerely,',
  };
}

export interface CandidateInfo {
  name: string;
  email: string;
  phone: string;
  location?: string;
}

export async function generateCoverLetterDocx(
  content: CoverLetterContent,
  candidateInfo: CandidateInfo,
  language: 'ar' | 'en'
): Promise<Buffer> {
  const isRTL = language === 'ar';
  const align = isRTL ? AlignmentType.RIGHT : AlignmentType.LEFT;

  const children: Paragraph[] = [];

  children.push(new Paragraph({
    alignment: align,
    children: [new TextRun({ text: candidateInfo.name, bold: true, size: 28, font: 'Calibri' })],
  }));

  const contactLine = [candidateInfo.email, candidateInfo.phone, candidateInfo.location]
    .filter(Boolean)
    .join(' | ');
  children.push(new Paragraph({
    alignment: align,
    children: [new TextRun({ text: contactLine, size: 20, font: 'Calibri' })],
    spacing: { after: 240 },
  }));

  const today = new Date().toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
  children.push(new Paragraph({
    alignment: align,
    children: [new TextRun({ text: today, size: 22, font: 'Calibri' })],
    spacing: { after: 240 },
  }));

  children.push(new Paragraph({
    alignment: align,
    children: [new TextRun({ text: content.greeting, size: 22, font: 'Calibri' })],
    spacing: { after: 200 },
  }));

  for (const para of content.paragraphs) {
    children.push(new Paragraph({
      alignment: align,
      children: [new TextRun({ text: para, size: 22, font: 'Calibri' })],
      spacing: { after: 200 },
    }));
  }

  const sigLines = content.signature.split('\n');
  for (let i = 0; i < sigLines.length; i++) {
    children.push(new Paragraph({
      alignment: align,
      children: [new TextRun({
        text: sigLines[i],
        size: 22,
        font: 'Calibri',
        bold: i === sigLines.length - 1,
      })],
    }));
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 720, right: 1080, bottom: 720, left: 1080 },
        },
      },
      children,
    }],
  });

  return await Packer.toBuffer(doc);
}

export async function generateCoverLetterPdf(
  content: CoverLetterContent,
  candidateInfo: CandidateInfo,
  language: 'ar' | 'en'
): Promise<Buffer> {
  const html = buildCoverLetterHtml(content, candidateInfo, language);
  return renderHtmlToPdf({
    html,
    dir: language === 'ar' ? 'rtl' : 'ltr',
    format: 'A4',
    margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
  });
}
