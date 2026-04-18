import { z } from 'zod';
import { router, protectedProcedure } from '../trpc-init';
import { TRPCError } from '@trpc/server';
import { callClaude, extractText, extractJson } from '../lib/claude-client';

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

const SYSTEM_CV = `You are an ICF-certified CV writer for the Saudi/GCC market.
Frameworks: STAR (Stanford), Quantified Impact (MIT), Executive Summary (Wharton), ATS Keyword-First (Jobscan), Vision 2030 HCDP.
Rules:
- Every bullet: action verb + measurable impact. 70%+ of bullets include a number/percentage/metric.
- Arabic CVs: Modern Standard Arabic (not dialect), Western digits (0-9), strong verbs (قُدتُ/طوّرتُ/حقّقتُ/أطلقتُ/رفعتُ — not "عملتُ على").
- English CVs: Led/Built/Delivered/Increased/Launched — never "Responsible for".
- Banned: synergy, leverage, utilize, team player, hard worker, responsible for, helped with.
- If candidate's name is Arabic → write CV in Arabic; if Latin → English.
- ATS-friendly: no tables, no icons, standard headings.
- Cite one framework in the summary (e.g. "STAR-aligned..." or "Wharton Executive Summary positioning...").
Respond with valid JSON only. No markdown, no code fences, no prose.`;

const SYSTEM_CV_PARSE = `Extract structured CV/resume data. Respond with valid JSON only. No markdown, no code fences.`;

async function callClaudeCV(field: string, context?: any): Promise<VersionData> {
  console.log(`[CV] Starting API call for field: ${field}`);

  const ctxBlock = context ? `
Candidate:
- Name: ${context.name || 'Not provided'}
- Target: ${context.jobTitle || field}
- Target Company: ${context.company || 'Not specified'}
- Current Role: ${context.currentRole || 'Not provided'}
- Experience (years): ${context.experience || 'Not provided'}
- Skills: ${context.skills || 'Not provided'}
- Education: ${context.education || 'Not provided'}
- Achievements: ${context.achievements || 'Not provided'}
- Languages: ${context.languages || 'Not provided'}
- JD: ${context.jobDescription || 'Not provided'}
` : '';

  const userPrompt = `Generate a professional CV version for: ${field}
${ctxBlock}
${context?.jobDescription ? 'CRITICAL: Tailor every bullet to the JD keywords (Jobscan ATS).' : ''}

Return JSON (first 4 fields are consumed by the UI — do not rename):
{
  "headline": "<max 10 words>",
  "summary": "<3-4 sentences tailored to ${field}, one framework citation, quantified value prop>",
  "skills": ["skill1","skill2","skill3","skill4","skill5","skill6","skill7","skill8"],
  "experience": [
    {"title":"<job title>","company":"<company>","duration":"<duration>","description":"<3-5 STAR bullets joined by newlines. 70%+ with a metric.>"}
  ],
  "atsScore": <0-100>,
  "atsRecommendations": ["<Jobscan-style tip>"],
  "education": [{"degree":"...","institution":"...","year":"...","relevantCoursework":"..."}],
  "certifications": ["<name + issuer + year>"],
  "languages": [{"language":"...","level":"Native | Fluent | Professional"}],
  "framework_applied": "STAR (Stanford) + Quantified Impact (MIT) + Jobscan ATS",
  "vision_2030_keywords": ["<HCDP keyword>"]
}`;

  let claudeRes;
  try {
    claudeRes = await callClaude({
      task: 'cv_generate',
      system: SYSTEM_CV,
      userContent: userPrompt,
      maxTokens: 4000,
    });
  } catch (err: any) {
    console.error('[CV] Claude call failed:', err?.status, err?.message);
    if (err?.status === 429) {
      throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'ضغط عالي الآن — جرّب بعد دقيقة' });
    }
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `Claude API error: ${err?.message || 'Unknown error'}`,
    });
  }

  const text = extractText(claudeRes);
  const parsedData = extractJson<any>(text);
  if (!parsedData) {
    console.error('[CLAUDE] Could not extract JSON:', text.substring(0, 500));
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to parse Claude API response' });
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
}
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
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Insufficient tokens. Need 10 tokens, have ' + profile.token_balance });
        }

        console.log(`[CV] Calling Claude API for ${input.fields.length} field(s)`);
        const versions: VersionData[] = [];

        for (const field of input.fields) {
          console.log(`[CV] Processing field: ${field}`);
          const versionData = await callClaudeCV(field, input.context);
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
    .mutation(async ({ input }) => {
      console.log('[CV] parseUpload called for file:', input.fileName);

      // Decode base64 content to text
      let textContent = '';
      try {
        const buffer = Buffer.from(input.fileBase64, 'base64');
        textContent = buffer.toString('utf8');
        textContent = textContent.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ');
        textContent = textContent.substring(0, 8000);
      } catch (e) {
        console.error('[CV] Failed to decode file:', e);
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Could not read file content' });
      }

      console.log('[CV] Extracted text length:', textContent.length);

      const userPrompt = `Extract structured CV/resume data from this text. Return ONLY a JSON object with these fields (empty string if not found):
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
${textContent}`;

      let claudeRes;
      try {
        claudeRes = await callClaude({
          task: 'cv_parse',
          system: SYSTEM_CV_PARSE,
          userContent: userPrompt,
          maxTokens: 2000,
        });
      } catch (err: any) {
        console.error('[CV] Claude parse error:', err?.status, err?.message);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to parse CV' });
      }

      const text = extractText(claudeRes);
      const parsed = extractJson<any>(text);
      if (!parsed) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to extract CV data' });
      }

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
    console.log(`[CV] Fetching history for user: ${ctx.user.id}`);
    try {
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
