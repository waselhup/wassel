import { z } from 'zod';
import { router, protectedProcedure } from '../trpc-init';
import { TRPCError } from '@trpc/server';

interface VersionData {
  fieldName: string;
  headline: string;
  summary: string;
  skills: string[];
  experience: Array<{
    title: string;
    company: string;
    duration: string;
    description: string;
  }>;
}

interface ClaudeMessage {
  content: Array<{
    type: string;
    text?: string;
  }>;
}

const callClaudeAPI = async (field: string, context?: any): Promise<VersionData> => {
  console.log(`[CLAUDE] Starting API call for field: ${field}`);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('[CLAUDE] ANTHROPIC_API_KEY not set');
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Claude API key not configured',
    });
  }

  const contextBlock = context ? `
Candidate Info:
- Name: ${context.name || 'Not provided'}
- Target Job: ${context.jobTitle || field}
- Target Company: ${context.company || 'Not specified'}
- Current Role: ${context.currentRole || 'Not provided'}
- Experience: ${context.experience || 'Not provided'} years
- Skills: ${context.skills || 'Not provided'}
- Education: ${context.education || 'Not provided'}
- Achievements: ${context.achievements || 'Not provided'}
- Languages: ${context.languages || 'Not provided'}
- Job Description: ${context.jobDescription || 'Not provided'}
` : '';

  const prompt = `أنت Career Coach تنفيذي معتمد من International Coach Federation (ICF PCC)، تخصصك كتابة السيرة الذاتية للسوق السعودي والخليجي بخبرة 12 سنة.

مصادرك الأكاديمية:
- Harvard Business School Career & Professional Development — CV framework
- Stanford Career Education — STAR methodology (Situation-Task-Action-Result)
- MIT Career Advising & Professional Development — Quantified Impact framework
- Wharton MBA Career Management — Executive Summary positioning
- Georgetown McDonough — Keyword-First ATS optimization (Jobscan Labs research)
- KFUPM Career Services — Saudi-specific CV standards
- King Saud University Career Development — Arabic-Latin bilingual formats
- Misk Foundation Talent Reports 2023-2025
- Saudi Human Capability Development Program (HCDP) 2030 skill priorities

frameworks مطبّقة:
1. STAR Method (Stanford): كل إنجاز = Situation + Task + Action + Result + Metrics
2. "So What?" Test (Harvard): كل bullet يجاوب: وش الأثر؟ وش الدليل؟
3. Quantified Achievements (MIT): 70% من bullets لازم فيها رقم/نسبة/متريك
4. Keyword Density Analysis (Jobscan 2024): ATS يرفض 75% من CVs بدون keywords محددة
5. Saudization Alignment: اذكر المهارات المطلوبة في HCDP 2030 عند الملاءمة

قواعد الكتابة:
- فصحى في النسخة العربية، لا خليجية
- أرقام غربية (0-9) في كل الحالات
- Action verbs قوية في العربي: "قُدتُ"، "طوّرتُ"، "حقّقتُ"، "أطلقتُ"، "رفعتُ" (لا "عملتُ على")
- Action verbs قوية في الإنجليزي: Led, Built, Delivered, Increased, Launched (لا "Responsible for")
- كل bullet يبدأ بـ action verb ويحتوي على متريك قابل للقياس
- ممنوع: synergy, leverage, utilize, team player, hard worker, ومثيلاتها
- كشف لغة الاسم: لو الاسم عربي → اكتب CV بالفصحى. لو لاتيني → إنجليزي.
- ATS-friendly: لا جداول، لا أيقونات، headings عادية

Generate a professional CV version for: ${field}
${contextBlock}

استشهد بمصدر أكاديمي واحد على الأقل في الـ summary (مثال: "بناءً على Harvard STAR framework..." أو "وفق Wharton Executive Summary positioning...").

${context?.jobDescription ? 'CRITICAL: Tailor every bullet to the job description keywords — Jobscan 2024 research shows ATS keyword density determines 75% of rejection outcomes.' : ''}

Return a JSON object with this structure (no markdown, just JSON). The first four fields are required and are consumed by the existing UI — do not rename or drop them. Additional optional fields extend the output with academic metadata:

{
  "headline": "A professional headline (max 10 words)",
  "summary": "A 3-4 sentence professional summary tailored to ${field}, containing an academic citation and quantified value proposition",
  "skills": ["skill1", "skill2", "skill3", "skill4", "skill5", "skill6", "skill7", "skill8"],
  "experience": [
    {
      "title": "Job title",
      "company": "Company name",
      "duration": "Duration string",
      "description": "3-5 STAR-method bullets joined with newlines. 70%+ bullets must contain a quantified metric."
    }
  ],
  "atsScore": <number 0-100>,
  "atsRecommendations": ["<specific Jobscan-style recommendation>", "..."],
  "education": [{ "degree": "...", "institution": "...", "year": "...", "relevantCoursework": "..." }],
  "certifications": ["<name + issuer + year>"],
  "languages": [{ "language": "...", "level": "Native | Fluent | Professional" }],
  "framework_applied": "STAR (Stanford) + Quantified Impact (MIT) + Georgetown Jobscan ATS",
  "vision_2030_keywords": ["<HCDP-aligned keyword 1>", "<HCDP-aligned keyword 2>"]
}`;

  try {
    console.log('[CLAUDE] Sending request to api.anthropic.com');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 8192,
        system: 'You are an ICF-certified executive career coach trained on Harvard / Stanford STAR / MIT Quantified Impact / Wharton / Georgetown Jobscan / KFUPM / KSU / Misk research. You write ATS-optimized CVs for the Saudi/GCC market and cite academic frameworks. Respond ONLY with valid JSON matching the requested schema. No markdown, no code fences, no explanation. Just the raw JSON object.',
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    console.log(`[CLAUDE] Response status: ${response.status}`);

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[CLAUDE] API error:', errorData);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Claude API error: ${errorData.error?.message || 'Unknown error'}`,
      });
    }

    const data = (await response.json()) as ClaudeMessage;
    console.log('[CLAUDE] Successfully received response');

    const textContent = data.content.find((c) => c.type === 'text');
    if (!textContent || !textContent.text) {
      console.error('[CLAUDE] No text content in response');
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'خدمة الذكاء الاصطناعي لم ترد. حاول مرة أخرى.' });
    }

    console.log(`[CLAUDE] Parsing JSON response for field: ${field}`);

    let parsedData: any;
    try {
      // Try direct parse first
      parsedData = JSON.parse(textContent.text.trim());
    } catch {
      // Fallback: extract JSON from markdown/text
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('[CLAUDE] Could not extract JSON from response:', textContent.text.substring(0, 500));
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to parse Claude API response' });
      }
      try {
        parsedData = JSON.parse(jsonMatch[0]);
      } catch (e2) {
        console.error('[CLAUDE] JSON parse failed even after extraction:', e2);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Invalid JSON from Claude API' });
      }
    }

    const versionData: VersionData = {
      fieldName: field,
      headline: parsedData.headline || 'Professional',
      summary: parsedData.summary || 'Experienced professional',
      skills: Array.isArray(parsedData.skills) ? parsedData.skills : [],
      experience: Array.isArray(parsedData.experience) ? parsedData.experience : [],
    };

    console.log(`[CLAUDE] Successfully parsed CV data for field: ${field}`);
    return versionData;
  } catch (error) {
    console.error(`[CLAUDE] Error calling API for field ${field}:`, error);
    if (error instanceof TRPCError) throw error;
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: error instanceof Error ? error.message : 'Failed to call Claude API',
    });
  }
};
export const cvRouter = router({
  generate: protectedProcedure
    .input(z.object({
      fields: z.array(z.string()).min(1).max(3),
      context: z.object({
        name: z.string().optional(),
        jobTitle: z.string().optional(),
        company: z.string().optional(),
        jobDescription: z.string().optional(),
        currentRole: z.string().optional(),
        experience: z.string().optional(),
        skills: z.string().optional(),
        education: z.string().optional(),
        achievements: z.string().optional(),
        languages: z.string().optional(),
      }).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      console.log(`[CV] Starting CV generation for user: ${ctx.user.id}`);
      console.log(`[CV] Requested fields: ${input.fields.join(', ')}`);

      try {
        console.log('[CV] Checking token balance');

        const { data: profile, error: selectError } = await ctx.supabase
          .from('profiles')
          .select('token_balance')
          .eq('id', ctx.user.id)
          .single();

        if (selectError) {
          console.error('[CV] Error fetching profile:', selectError);
          throw selectError;
        }

        if (!profile) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'User profile not found' });
        }

        console.log(`[CV] Current token balance: ${profile.token_balance}`);

        if (profile.token_balance < 10) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Insufficient tokens. Need 10 tokens, have ' + profile.token_balance });        }

        console.log(`[CV] Calling Claude API for ${input.fields.length} field(s)`);
        const versions: VersionData[] = [];

        for (const field of input.fields) {
          console.log(`[CV] Processing field: ${field}`);
          const versionData = await callClaudeAPI(field, input.context);
          versions.push(versionData);
          console.log(`[CV] Successfully generated CV for field: ${field}`);
        }

        console.log('[CV] Deducting 10 tokens from balance');
        const newBalance = (profile.token_balance || 0) - 10;

        const { error: updateError } = await ctx.supabase
          .from('profiles')
          .update({ token_balance: newBalance })
          .eq('id', ctx.user.id);

        if (updateError) {
          console.error('[CV] Error updating token balance:', updateError);
          throw updateError;
        }

        console.log(`[CV] Token balance updated to: ${newBalance}`);

        // Save to cv_versions table (one row per field)
        console.log('[CV] Saving CV versions to database');
        for (const version of versions) {
          const { error: insertError } = await ctx.supabase
            .from('cv_versions')
            .insert([{
              user_id: ctx.user.id,
              field_name: version.fieldName,
              cv_content: version,
            }]);

          if (insertError) {
            console.error('[CV] Error saving CV version for field:', version.fieldName, insertError);
          }
        }

        console.log(`[CV] Successfully saved CV versions for user: ${ctx.user.id}`);

        return { versions, tokensRemaining: newBalance };
      } catch (err) {
        console.error('[CV] Mutation error:', err);
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: err instanceof Error ? err.message : 'Failed to generate CV versions',
        });
      }
    }),


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
        textContent = textContent.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ');
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
          max_tokens: 4096,
          system: 'Respond ONLY with valid JSON. No markdown, no code fences, no explanation text.',
          messages: [{
            role: 'user',
            content: `Extract structured CV/resume data from this text. Return ONLY a JSON object with these fields (use empty string if not found):
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
${textContent}`
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
      const jsonMatch = text.match(/\{[\s\S]*\}/);
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

  history: protectedProcedure.query(async ({ ctx }) => {
    console.log(`[CV] Fetching history for user: ${ctx.user.id}`);    try {
      const { data, error } = await ctx.supabase
        .from('cv_versions')
        .select('*')
        .eq('user_id', ctx.user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[CV] Error fetching history:', error);
        throw error;
      }

      console.log(`[CV] Found ${(data || []).length} CV versions in history`);
      return data || [];
    } catch (err) {
      console.error('[CV] Query error:', err);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: err instanceof Error ? err.message : 'Failed to fetch CV history',
      });
    }
  }),
});
