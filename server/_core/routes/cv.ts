import { z } from 'zod';
import { router, protectedProcedure } from '../trpc-init';
import { TRPCError } from '@trpc/server';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';

// Generate tailored CV versions using Claude API
async function generateCVWithClaude(fields: string[], userProfile: any): Promise<any[]> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const fieldsText = fields.map((f, i) => `${i + 1}. ${f}`).join('\n');

  const prompt = `You are an expert CV/resume writer specializing in the Saudi/GCC job market. Generate tailored CV content for a professional targeting multiple career fields.

User Info:
- Name: ${userProfile.full_name || 'Professional'}
- Email: ${userProfile.email || ''}

Target Fields:
${fieldsText}

For EACH field, generate a tailored CV version. Return a JSON array (no markdown, no code blocks):
[
  {
    "fieldName": "<field name>",
    "headline": "<professional headline optimized for this field, max 120 chars>",
    "summary": "<3-4 sentence professional summary tailored to this field>",
    "skills": ["skill1", "skill2", "skill3", "skill4", "skill5", "skill6", "skill7", "skill8"],
    "experience": [
      {
        "title": "<job title tailored to field>",
        "company": "<suggest type of company>",
        "duration": "<suggested duration>",
        "description": "<2-3 bullet points as single string, with measurable achievements>"
      },
      {
        "title": "<second role>",
        "company": "<company type>",
        "duration": "<duration>",
        "description": "<achievements>"
      }
    ],
    "certifications": ["<relevant certification 1>", "<relevant certification 2>"],
    "keywords": ["<ATS keyword 1>", "<ATS keyword 2>", "<ATS keyword 3>", "<ATS keyword 4>", "<ATS keyword 5>"]
  }
]

Requirements:
- Use formal Modern Standard Arabic if field names are in Arabic
- Reference Vision 2030 for Saudi government/public sector fields
- Include ATS-optimized keywords
- Each experience entry should have quantified achievements
- Skills should be a mix of technical and soft skills relevant to the field`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('Claude CV error:', res.status, errText);
    throw new Error(`Claude API failed: ${res.status}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text || '';

  // Parse JSON from response
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  try {
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    console.error('Failed to parse Claude CV response:', text);
    return fields.map((field) => ({
      fieldName: field,
      headline: `${field} Professional | Experienced & Results-Driven`,
      summary: `Experienced professional seeking opportunities in ${field}. Strong track record of delivering results and driving growth in competitive environments.`,
      skills: ['Leadership', 'Communication', 'Problem Solving', 'Project Management', 'Strategic Planning', 'Team Building', 'Analytics', 'Innovation'],
      experience: [
        {
          title: `${field} Specialist`,
          company: 'Industry-leading organization',
          duration: '3+ years',
          description: `Led key ${field} initiatives resulting in measurable improvements. Managed cross-functional teams and delivered projects on time and within budget.`,
        },
      ],
      certifications: ['Relevant industry certification'],
      keywords: [field, 'professional', 'experienced', 'results-driven', 'strategic'],
    }));
  }
}

export const cvRouter = router({
  generate: protectedProcedure
    .input(z.object({ fields: z.array(z.string()).min(1).max(3) }))
    .mutation(async ({ input, ctx }) => {
      try {
        // Check token balance (need 10 tokens)
        const { data: profile } = await ctx.supabase
          .from('profiles')
          .select('token_balance, full_name, email')
          .eq('id', ctx.user.id)
          .single();

        if (!profile || profile.token_balance < 10) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Insufficient tokens. You need 10 tokens for CV generation.',
          });
        }

        // Generate with Claude AI
        let versions: any[];
        try {
          versions = await generateCVWithClaude(input.fields, profile);
        } catch (claudeErr: any) {
          console.error('Claude CV generation failed:', claudeErr.message);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'AI CV generation failed. Please try again.',
          });
        }

        // Deduct 10 tokens
        const { error: updateError } = await ctx.supabase
          .from('profiles')
          .update({ token_balance: (profile.token_balance || 0) - 10 })
          .eq('id', ctx.user.id);

        if (updateError) throw updateError;

        // Log token transaction
        await ctx.supabase.from('token_transactions').insert([
          {
            user_id: ctx.user.id,
            type: 'spend',
            amount: -10,
            description: `CV generation for ${input.fields.length} field(s): ${input.fields.join(', ')}`,
          },
        ]);

        // Save to cv_versions table
        const { error: insertError } = await ctx.supabase
          .from('cv_versions')
          .insert([
            {
              user_id: ctx.user.id,
              fields: input.fields,
              versions_data: versions,
            },
          ]);

        if (insertError) {
          console.error('Insert CV error:', insertError);
        }

        return { versions };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        console.error('CV generate error:', err);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to generate CV versions',
        });
      }
    }),

  history: protectedProcedure.query(async ({ ctx }) => {
    try {
      const { data } = await ctx.supabase
        .from('cv_versions')
        .select('*')
        .eq('user_id', ctx.user.id)
        .order('created_at', { ascending: false });

      return data || [];
    } catch (err) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch CV history',
      });
    }
  }),
});
