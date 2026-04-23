import { Document, Packer, Paragraph, TextRun, AlignmentType } from 'docx';
import { jsPDF } from 'jspdf';
import { callClaude, extractText, extractJson } from './claude-client';

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
- 'ar': Formal MSA (فصحى). Greeting: "السلام عليكم،" or "حضرة مدير التوظيف،".
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

  const res = await callClaude({
    task: 'cv_generate',
    system: COVER_LETTER_SYSTEM,
    userContent: userPrompt,
    maxTokens: 2000,
  });

  const text = extractText(res);
  const parsed = extractJson<any>(text);
  if (!parsed) {
    throw new Error('Cover letter generator did not return valid JSON');
  }

  return normalizeCoverLetter(parsed);
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

export function generateCoverLetterPdf(
  content: CoverLetterContent,
  candidateInfo: CandidateInfo,
  language: 'ar' | 'en'
): Buffer {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const isRTL = language === 'ar';

  let y = 20;
  const pageWidth = 210;
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  const align: 'left' | 'right' = isRTL ? 'right' : 'left';
  const textX = isRTL ? pageWidth - margin : margin;
  const lineHeight = 6;

  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text(candidateInfo.name, textX, y, { align });
  y += lineHeight + 2;

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  const contactLine = [candidateInfo.email, candidateInfo.phone, candidateInfo.location]
    .filter(Boolean)
    .join(' | ');
  pdf.text(contactLine, textX, y, { align });
  y += lineHeight * 2;

  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
  pdf.text(today, textX, y, { align });
  y += lineHeight * 2;

  pdf.text(content.greeting, textX, y, { align });
  y += lineHeight * 2;

  pdf.setFontSize(11);
  for (const para of content.paragraphs) {
    const lines: string[] = pdf.splitTextToSize(para, contentWidth);
    for (const line of lines) {
      if (y > 270) { pdf.addPage(); y = 20; }
      pdf.text(line, textX, y, { align });
      y += lineHeight;
    }
    y += lineHeight;
  }

  y += lineHeight;
  const sigLines = content.signature.split('\n');
  for (let i = 0; i < sigLines.length; i++) {
    if (y > 280) { pdf.addPage(); y = 20; }
    pdf.setFont('helvetica', i === sigLines.length - 1 ? 'bold' : 'normal');
    pdf.text(sigLines[i], textX, y, { align });
    y += lineHeight;
  }

  return Buffer.from(pdf.output('arraybuffer'));
}
