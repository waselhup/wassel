const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'server', '_core', 'routes', 'cv.ts');
let content = fs.readFileSync(filePath, 'utf8');
if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);

// 1. Add parseUpload mutation before the closing of cvRouter
// Find the end of cvRouter definition and add parseUpload before history
const parseUploadMutation = `
  parseUpload: protectedProcedure
    .input(z.object({
      fileBase64: z.string(),
      fileName: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      console.log('[CV] parseUpload called for file:', input.fileName);
      
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Claude API key not configured' });
      }

      // Decode base64 content to text
      let textContent = '';
      try {
        const buffer = Buffer.from(input.fileBase64, 'base64');
        textContent = buffer.toString('utf8');
        // Clean up non-printable characters but keep Arabic
        textContent = textContent.replace(/[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F]/g, ' ');
        // Limit to first 8000 chars to avoid token limits
        textContent = textContent.substring(0, 8000);
      } catch (e) {
        console.error('[CV] Failed to decode file:', e);
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Could not read file content' });
      }

      console.log('[CV] Extracted text length:', textContent.length);

      // Use Claude to extract structured CV data
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1500,
          messages: [{
            role: 'user',
            content: \`Extract structured CV/resume data from this text. Return ONLY a JSON object with these fields (use empty string if not found):
{
  "name": "full name",
  "email": "email address",
  "phone": "phone number",
  "currentRole": "current job title",
  "experience": "years of experience (number only)",
  "skills": "comma separated skills",
  "education": "highest degree and institution",
  "achievements": "key achievements",
  "languages": "languages spoken"
}

CV text:
\${textContent}\`
          }],
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('[CV] Claude API error:', response.status, errText);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to parse CV' });
      }

      const data = await response.json() as any;
      const text = data.content?.[0]?.text || '';
      const jsonMatch = text.match(/\\{[\\s\\S]*\\}/);
      if (!jsonMatch) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to extract CV data' });
      }

      const parsed = JSON.parse(jsonMatch[0]);
      console.log('[CV] Parsed CV data:', Object.keys(parsed).join(', '));
      
      return {
        name: parsed.name || '',
        email: parsed.email || '',
        phone: parsed.phone || '',
        currentRole: parsed.currentRole || '',
        experience: parsed.experience || '',
        skills: parsed.skills || '',
        education: parsed.education || '',
        achievements: parsed.achievements || '',
        languages: parsed.languages || '',
      };
    }),

`;

// Insert parseUpload before history in the router
content = content.replace(
  '  history: protectedProcedure.query(async ({ ctx }) => {\n    console.log(`[CV] Fetching history',
  parseUploadMutation + '  history: protectedProcedure.query(async ({ ctx }) => {\n    console.log(`[CV] Fetching history'
);

// 2. Enhance the CV generation prompt for Oxford standards
const oldPrompt = `You are a professional CV/resume optimizer specializing in the Saudi/GCC job market. Generate a tailored CV version for: \${field}`;
const newPrompt = `You are a professional CV writer following Oxford University Career Service guidelines, specializing in the Saudi/GCC job market.

Generate a professional CV version for: \${field}

Oxford CV Standards:
- Professional Summary: 3-4 sentences highlighting unique value proposition
- Core Skills: 8 relevant, ATS-optimized keywords
- Professional Experience: Action verbs + metrics + impact (STAR method)
- Education: Degree, institution, year, relevant coursework
- Language: Detect if Arabic name -> write in Arabic (Modern Standard Arabic), else English
- Style: Clean, no tables, ATS-friendly formatting
- Include Vision 2030 reference if relevant to Saudi market`;

content = content.replace(oldPrompt, newPrompt);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Updated cv.ts with parseUpload mutation + Oxford CV prompt');
