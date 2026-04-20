import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc-init';
import { callClaude, extractText, extractJson } from '../lib/claude-client';
import { classifyClaudeError, sendClaudeOpsAlert } from '../lib/apiLogger';
import {
  extractTextFromFile,
  extractCVFields,
  type ExtractedCV,
} from '../lib/cv-parser';
import {
  buildMITClassicDocx,
  buildHarvardExecutiveDocx,
  buildCVPDF,
  type CVData,
  type CVTemplate,
} from '../lib/cv-generator';

const TEMPLATE = z.enum(['mit-classic', 'harvard-executive']);
const LANGUAGE = z.enum(['ar', 'en']);
const TOKEN_COST = 10;

const CV_BUILDER_SYSTEM = `You are an expert ATS-optimized CV writer trained on MIT Career Services and Harvard Business School standards.

TASK: Transform user's raw input into a polished, ATS-grade CV.

ATS REQUIREMENTS:
- Every bullet starts with a STRONG action verb (Led, Engineered, Delivered, Architected, Optimized, Designed, Implemented, Reduced, Increased, Streamlined, Spearheaded, Orchestrated).
- Every bullet ends with a MEASURABLE outcome when possible (%, $, time, count, scale).
- STAR method: Situation → Task → Action → Result.
- Keywords from target job description MUST appear naturally in summary + skills + 3+ bullets.
- No buzzwords without substance. No personal pronouns (I, me, my).
- Past tense for previous roles, present tense for current role.
- US English unless the user's language field is "ar".

OUTPUT: Return ONLY valid JSON (no markdown fences, no commentary):

{
  "fullName": string,
  "contact": { "phone": string, "email": string, "location": string, "linkedinUrl": string },
  "summary": string,
  "experience": [{
    "title": string,
    "company": string,
    "location": string,
    "dates": string,
    "bullets": [string, ...]
  }],
  "education": [{
    "school": string,
    "location": string,
    "degree": string,
    "year": string,
    "achievements": [string, ...]
  }],
  "certifications": [{ "name": string, "issuer": string, "year": string }],
  "skills": [{ "categoryName": string, "items": [string, ...] }],
  "achievements": [string, ...],
  "languages": [{ "name": string, "proficiency": string }]
}

SKILLS GROUPING:
- Group skills into 3-5 categories based on the user's field.
- Examples: "Engineering Software", "Technical Skills", "Leadership", "Languages & Standards", "Tools & Platforms", "QA/QC & Standards", "Site Engineering".

TONE: Confident, quantitative, executive-ready. No fluff. Summary is 3-4 sentences maximum.`;

export const cvRouter = router({

  parseUpload: protectedProcedure
    .input(z.object({
      fileBase64: z.string().min(1),
      fileName: z.string().min(1),
      mimeType: z.string().default(''),
    }))
    .mutation(async ({ input }) => {
      const buffer = Buffer.from(input.fileBase64, 'base64');

      if (buffer.length > 5 * 1024 * 1024) {
        throw new TRPCError({ code: 'PAYLOAD_TOO_LARGE', message: 'File exceeds 5MB' });
      }
      if (buffer.length < 100) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'File too small or empty' });
      }

      let rawText: string;
      try {
        rawText = await extractTextFromFile(buffer, input.mimeType, input.fileName);
      } catch (err: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: err?.message || 'Could not read file',
        });
      }

      if (!rawText || rawText.trim().length < 80) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Could not extract text from file. Is it a scanned image?',
        });
      }

      let extracted: ExtractedCV;
      try {
        extracted = await extractCVFields(rawText);
      } catch (err: any) {
        const info = classifyClaudeError(
          err?.status ?? 0,
          err?.responseBody ?? err?.body ?? err?.message ?? ''
        );
        if (info.alertOps) void sendClaudeOpsAlert(info, '/api/trpc/cv.parseUpload');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: info.userMessage,
        });
      }

      return {
        success: true,
        extracted,
        textLength: rawText.length,
      };
    }),

  generate: protectedProcedure
    .input(z.object({
      userData: z.object({
        fullName: z.string().min(1),
        email: z.string().default(''),
        phone: z.string().default(''),
        location: z.string().default(''),
        linkedinUrl: z.string().default(''),
        currentRole: z.string().default(''),
        currentCompany: z.string().default(''),
        yearsExperience: z.number().default(0),
        summary: z.string().default(''),
        skills: z.array(z.string()).default([]),
        languages: z.array(z.any()).default([]),
        education: z.array(z.any()).default([]),
        experience: z.array(z.any()).default([]),
        certifications: z.array(z.any()).default([]),
        achievements: z.array(z.string()).default([]),
      }),
      targetRole: z.string().min(1),
      targetCompany: z.string().default(''),
      jobDescription: z.string().default(''),
      template: TEMPLATE,
      language: LANGUAGE.default('en'),
    }))
    .mutation(async ({ input, ctx }) => {
      // Token check
      const { data: profile, error: profErr } = await ctx.supabase
        .from('profiles')
        .select('token_balance')
        .eq('id', ctx.user.id)
        .single();

      if (profErr || !profile) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User profile not found' });
      }

      if ((profile.token_balance || 0) < TOKEN_COST) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `رصيد التوكن غير كافٍ. تحتاج ${TOKEN_COST} توكن.`,
        });
      }

      // Build CV structure via Claude
      let cvData: CVData;
      try {
        const claudeRes = await callClaude({
          task: 'cv_generate',
          system: CV_BUILDER_SYSTEM,
          userContent: JSON.stringify({
            user_data: input.userData,
            target_role: input.targetRole,
            target_company: input.targetCompany,
            job_description: input.jobDescription,
            template: input.template,
            language: input.language,
          }),
          maxTokens: 6000,
        });
        const raw = extractText(claudeRes);
        const parsed = extractJson<any>(raw);
        if (!parsed) {
          throw new Error('Claude did not return valid JSON');
        }
        cvData = normalizeCVData(parsed);
      } catch (err: any) {
        const info = classifyClaudeError(
          err?.status ?? 0,
          err?.responseBody ?? err?.body ?? err?.message ?? ''
        );
        if (info.alertOps) void sendClaudeOpsAlert(info, '/api/trpc/cv.generate');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: info.userMessage,
        });
      }

      // Render both formats
      const docxBuf = input.template === 'mit-classic'
        ? await buildMITClassicDocx(cvData)
        : await buildHarvardExecutiveDocx(cvData);
      const pdfBuf = buildCVPDF(cvData, input.template as CVTemplate);

      // Upload to storage (service role bypasses RLS — we own the folder naming)
      const ts = Date.now();
      const safeRole = input.targetRole.slice(0, 30).replace(/[^\w\s-]/g, '').replace(/\s+/g, '_') || 'cv';
      const docxPath = `${ctx.user.id}/${ts}_${safeRole}_${input.template}.docx`;
      const pdfPath = `${ctx.user.id}/${ts}_${safeRole}_${input.template}.pdf`;

      const { error: docxErr } = await ctx.supabase.storage
        .from('cv-exports')
        .upload(docxPath, docxBuf, {
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          upsert: false,
        });
      if (docxErr) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `DOCX upload failed: ${docxErr.message}` });
      }

      const { error: pdfErr } = await ctx.supabase.storage
        .from('cv-exports')
        .upload(pdfPath, pdfBuf, {
          contentType: 'application/pdf',
          upsert: false,
        });
      if (pdfErr) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `PDF upload failed: ${pdfErr.message}` });
      }

      // Signed URLs (7 days)
      const weekSec = 7 * 24 * 60 * 60;
      const [docxSigned, pdfSigned] = await Promise.all([
        ctx.supabase.storage.from('cv-exports').createSignedUrl(docxPath, weekSec),
        ctx.supabase.storage.from('cv-exports').createSignedUrl(pdfPath, weekSec),
      ]);

      // Persist record
      const { data: saved, error: saveErr } = await ctx.supabase
        .from('generated_cvs')
        .insert({
          user_id: ctx.user.id,
          target_role: input.targetRole,
          target_company: input.targetCompany || null,
          job_description: input.jobDescription || null,
          template: input.template,
          language: input.language,
          input_data: input.userData,
          content_json: cvData,
          docx_path: docxPath,
          pdf_path: pdfPath,
          tokens_used: TOKEN_COST,
        })
        .select()
        .single();

      if (saveErr) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: saveErr.message });
      }

      // Deduct tokens
      await ctx.supabase
        .from('profiles')
        .update({ token_balance: (profile.token_balance || 0) - TOKEN_COST })
        .eq('id', ctx.user.id);

      return {
        id: saved.id,
        cvData,
        docxUrl: docxSigned.data?.signedUrl || null,
        pdfUrl: pdfSigned.data?.signedUrl || null,
        tokensUsed: TOKEN_COST,
        tokensRemaining: (profile.token_balance || 0) - TOKEN_COST,
      };
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const { data, error } = await ctx.supabase
      .from('generated_cvs')
      .select('id, target_role, target_company, template, language, created_at, docx_path, pdf_path, tokens_used')
      .eq('user_id', ctx.user.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
    }

    const rows = data || [];
    const withUrls = await Promise.all(rows.map(async (cv) => {
      const [docx, pdf] = await Promise.all([
        cv.docx_path
          ? ctx.supabase.storage.from('cv-exports').createSignedUrl(cv.docx_path, 3600)
          : Promise.resolve({ data: null as any }),
        cv.pdf_path
          ? ctx.supabase.storage.from('cv-exports').createSignedUrl(cv.pdf_path, 3600)
          : Promise.resolve({ data: null as any }),
      ]);
      return {
        ...cv,
        docxUrl: (docx as any).data?.signedUrl || null,
        pdfUrl: (pdf as any).data?.signedUrl || null,
      };
    }));

    return withUrls;
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const { data, error } = await ctx.supabase
        .from('generated_cvs')
        .select('*')
        .eq('id', input.id)
        .eq('user_id', ctx.user.id)
        .is('deleted_at', null)
        .single();

      if (error || !data) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      const weekSec = 7 * 24 * 60 * 60;
      const [docx, pdf] = await Promise.all([
        data.docx_path
          ? ctx.supabase.storage.from('cv-exports').createSignedUrl(data.docx_path, weekSec)
          : Promise.resolve({ data: null as any }),
        data.pdf_path
          ? ctx.supabase.storage.from('cv-exports').createSignedUrl(data.pdf_path, weekSec)
          : Promise.resolve({ data: null as any }),
      ]);

      return {
        ...data,
        docxUrl: (docx as any).data?.signedUrl || null,
        pdfUrl: (pdf as any).data?.signedUrl || null,
      };
    }),

  deleteById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const { error } = await ctx.supabase
        .from('generated_cvs')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', input.id)
        .eq('user_id', ctx.user.id);

      if (error) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      }
      return { success: true };
    }),
});

function normalizeCVData(raw: any): CVData {
  const str = (v: any) => (typeof v === 'string' ? v : '');
  const arr = (v: any) => (Array.isArray(v) ? v : []);

  return {
    fullName: str(raw.fullName),
    contact: {
      phone: str(raw.contact?.phone),
      email: str(raw.contact?.email),
      location: str(raw.contact?.location),
      linkedinUrl: str(raw.contact?.linkedinUrl),
    },
    summary: str(raw.summary),
    experience: arr(raw.experience).map((x: any) => ({
      title: str(x?.title),
      company: str(x?.company),
      location: str(x?.location),
      dates: str(x?.dates),
      bullets: arr(x?.bullets).filter((b: any) => typeof b === 'string' && b.trim()),
    })),
    education: arr(raw.education).map((e: any) => ({
      school: str(e?.school),
      location: str(e?.location),
      degree: str(e?.degree),
      year: str(e?.year),
      achievements: arr(e?.achievements).filter((a: any) => typeof a === 'string' && a.trim()),
    })),
    certifications: arr(raw.certifications).map((c: any) => ({
      name: str(c?.name),
      issuer: str(c?.issuer),
      year: str(c?.year),
    })),
    skills: arr(raw.skills).map((s: any) => ({
      categoryName: str(s?.categoryName || s?.category),
      items: arr(s?.items).filter((i: any) => typeof i === 'string' && i.trim()),
    })).filter((g) => g.categoryName && g.items.length),
    achievements: arr(raw.achievements).filter((a: any) => typeof a === 'string' && a.trim()),
    languages: arr(raw.languages).map((l: any) => ({
      name: str(l?.name),
      proficiency: str(l?.proficiency),
    })).filter((l) => l.name),
  };
}
