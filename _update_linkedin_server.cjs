const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'server', '_core', 'routes', 'linkedin.ts');
let content = fs.readFileSync(filePath, 'utf8');
// Remove BOM if present
if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);

// 1. Add isArabicName function before analyzeWithClaude
const isArabicNameFn = `
function isArabicName(name: string): boolean {
  // Check if name contains Arabic characters
  return /[\\u0600-\\u06FF\\u0750-\\u077F\\u08A0-\\u08FF]/.test(name);
}
`;

// Insert before analyzeWithClaude function
content = content.replace(
  'async function analyzeWithClaude',
  isArabicNameFn + '\nasync function analyzeWithClaude'
);

// 2. Replace the Claude prompt with enhanced version
const oldPromptStart = 'const claudeBody = {';
const oldPromptEnd = '  console.log(\'[CLAUDE] Request body model:\', claudeBody.model);';

const oldPromptSection = content.substring(
  content.indexOf(oldPromptStart),
  content.indexOf(oldPromptEnd)
);

const newPromptSection = `const isArabic = isArabicName(name);
  const lang = isArabic ? 'ar' : 'en';

  const claudeBody = {
    model: CLAUDE_MODEL,
    max_tokens: 3000,
    system: isArabic
      ? 'أنت مستشار LinkedIn محترف ومتخصص في السوق السعودي والخليجي. حلل الملفات الشخصية بعمق وقدم نصائح عملية محددة. أجب دائماً بالعربية الفصحى.'
      : 'You are a senior LinkedIn profile coach specializing in the Saudi/GCC job market. Analyze profiles holistically and provide specific, actionable advice. Always respond in English.',
    messages: [
      {
        role: 'user',
        content: \`Analyze this LinkedIn profile thoroughly like a senior LinkedIn coach. Return a JSON object with EXACTLY this structure (no markdown, no code blocks, just raw JSON):
{
  "score": <number 0-100>,
  "scoreBreakdown": {
    "photo": <0-10>,
    "headline": <0-15>,
    "summary": <0-15>,
    "experience": <0-20>,
    "skills": <0-10>,
    "education": <0-10>,
    "connections": <0-10>,
    "keywords": <0-10>
  },
  "headlineCurrent": "<current headline>",
  "headlineSuggestion": "<improved headline - \${isArabic ? 'in Arabic' : 'in English'}>",
  "summaryCurrent": "<current summary or 'No summary provided'>",
  "summarySuggestion": "<improved professional summary in 3-4 sentences - \${isArabic ? 'in Arabic' : 'in English'}>",
  "keywords": ["keyword1", "keyword2", ...up to 10 relevant keywords for this industry],
  "experienceSuggestions": [{"role": "<role>", "suggestion": "<specific improvement tip - \${isArabic ? 'in Arabic' : 'in English'}>"}],
  "strengths": ["<strength1>", "<strength2>", "<strength3>"],
  "weaknesses": ["<weakness1>", "<weakness2>", "<weakness3>"],
  "actionPlan": [
    "<immediate action 1 - \${isArabic ? 'in Arabic' : 'in English'}>",
    "<immediate action 2>",
    "<immediate action 3>"
  ],
  "industryTips": "<2-3 sentences of industry-specific advice for Saudi/GCC market - \${isArabic ? 'in Arabic' : 'in English'}>"
}

Score criteria (be strict and realistic):
- Photo/banner: +10 if likely present (connections > 100 suggests active profile with photo)
- Headline quality: up to 15 points (is it specific? includes value prop? has keywords?)
- Summary quality: up to 15 points (tells a story? has CTA? mentions achievements?)
- Experience detail: up to 20 points (has metrics? action verbs? relevant descriptions?)
- Skills: up to 10 points (relevant? endorsed? minimum 5 skills listed?)
- Education: up to 10 points (degrees listed? certifications? courses?)
- Connections: up to 10 points (500+ = 10, 200+ = 7, 100+ = 5, <100 = 2)
- Keywords/SEO: up to 10 points (industry terms? job title keywords? searchable?)

\${isArabic ? 'IMPORTANT: All suggestions, strengths, weaknesses, action plan, and tips MUST be in Arabic (Modern Standard Arabic). Reference Vision 2030 if relevant to Saudi market.' : 'IMPORTANT: All text must be in English. Reference Vision 2030 if relevant to Saudi market.'}

Profile data:
\${profileText}\`
      }
    ]
  };
  `;

content = content.substring(0, content.indexOf(oldPromptStart)) 
  + newPromptSection 
  + content.substring(content.indexOf(oldPromptEnd));

fs.writeFileSync(filePath, content, 'utf8');
console.log('Updated linkedin.ts with enhanced prompt + language detection');
