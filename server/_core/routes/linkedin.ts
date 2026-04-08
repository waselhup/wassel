import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';

const APIFY_TOKEN = process.env.APIFY_TOKEN || '';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const APIFY_ACTOR_ID = 'harvestapi/linkedin-profile-search';

// Fetch LinkedIn profile data via Apify
async function fetchLinkedInProfile(profileUrl: string): Promise<any> {
  if (!APIFY_TOKEN) {
    throw new Error('APIFY_TOKEN not configured');
  }

  const cleanUrl = profileUrl.replace(/\/$/, '');

  const runRes = await fetch(
    `https://api.apify.com/v2/acts/${APIFY_ACTOR_ID}/run-sync-get-dataset-items?token=${APIFY_TOKEN}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        searchUrls: [cleanUrl],
        maxResults: 1,
      }),
    }
  );

  if (!runRes.ok) {
    const errText = await runRes.text();
    console.error('Apify error:', runRes.status, errText);
    throw new Error(`Apify API failed: ${runRes.status}`);
  }

  const results = await runRes.json();
  if (!Array.isArray(results) || results.length === 0) {
    throw new Error('No profile data returned from Apify');
  }

  return results[0];
}

// Analyze LinkedIn profile using Claude API
async function analyzeWithClaude(profileData: any): Promise<any> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const prompt = `You are a LinkedIn profile optimization expert specializing in the Saudi/GCC job market. Analyze this LinkedIn profile and provide detailed improvement suggestions.

Profile Data:
- Name: ${profileData.fullName || profileData.name || 'Unknown'}
- Headline: ${profileData.headline || 'No headline'}
- Summary/About: ${profileData.summary || profileData.about || 'No summary'}
- Location: ${profileData.location || 'Unknown'}
- Current Position: ${profileData.positions?.length ? JSON.stringify(profileData.positions[0]) : 'Unknown'}
- Experience: ${JSON.stringify(profileData.positions || profileData.experience || []).slice(0, 2000)}
- Skills: ${JSON.stringify(profileData.skills || []).slice(0, 500)}
- Education: ${JSON.stringify(profileData.educations || profileData.education || []).slice(0, 500)}

Return a JSON response with EXACTLY this structure (no markdown, no code blocks, just raw JSON):
{
  "score": <number 0-100>,
  "headlineCurrent": "<current headline>",
  "headlineSuggestion": "<improved headline optimized for visibility>",
  "summaryCurrent": "<current summary or 'No summary provided'>",
  "summarySuggestion": "<improved 3-4 sentence professional summary>",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5", "keyword6"],
  "experienceSuggestions": [
    {
      "role": "<role title>",
      "suggestion": "<specific improvement suggestion>"
    }
  ],
  "strengthPoints": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "improvementAreas": ["<area 1>", "<area 2>", "<area 3>"]
}

Score criteria:
- 90-100: Excellent profile, minor tweaks
- 70-89: Good profile, needs optimization
- 50-69: Average, significant improvements needed
- Below 50: Weak profile, major overhaul needed

Consider Vision 2030 alignment for Saudi-based professionals.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
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
    console.error('Claude API error:', res.status, errText);
    throw new Error(`Claude API failed: ${res.status}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text || '';

  // Parse JSON from response (handle potential markdown wrapping)
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    console.error('Failed to parse Claude response:', text);
    return {
      score: 60,
      headlineCurrent: profileData.headline || 'No headline',
      headlineSuggestion: `${profileData.headline || 'Professional'} | Open to Opportunities`,
      summaryCurrent: profileData.summary || 'No summary provided',
      summarySuggestion: 'Consider adding a professional summary that highlights your key skills and experience.',
      keywords: ['leadership', 'innovation', 'strategy', 'growth', 'technology'],
      experienceSuggestions: [{ role: 'General', suggestion: 'Add metrics and quantify your impact in each role' }],
      strengthPoints: ['Profile exists on LinkedIn'],
      improvementAreas: ['Add more detail to profile sections'],
    };
  }
}

export const linkedinRouter = router({
  analyze: protectedProcedure
    .input(z.object({ profileUrl: z.string().url() }))
    .mutation(async ({ input, ctx }) => {
      try {
        // Check token balance (need 5 tokens)
        const { data: profile } = await ctx.supabase
          .from('profiles')
          .select('token_balance')
          .eq('id', ctx.user.id)
          .single();

        if (!profile || profile.token_balance < 5) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Insufficient tokens. You need 5 tokens for LinkedIn analysis.',
          });
        }

        // Step 1: Fetch LinkedIn profile data via Apify
        let profileData: any;
        try {
          profileData = await fetchLinkedInProfile(input.profileUrl);
        } catch (apifyErr: any) {
          console.error('Apify fetch failed:', apifyErr.message);
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Could not fetch LinkedIn profile. Please check the URL and try again.',
          });
        }

        // Step 2: Analyze with Claude AI
        let analysis: any;
        try {
          analysis = await analyzeWithClaude(profileData);
        } catch (claudeErr: any) {
          console.error('Claude analysis failed:', claudeErr.message);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'AI analysis failed. Please try again.',
          });
        }

        // Step 3: Deduct 5 tokens
        const { error: updateError } = await ctx.supabase
          .from('profiles')
          .update({ token_balance: (profile.token_balance || 0) - 5 })
          .eq('id', ctx.user.id);

        if (updateError) throw updateError;

        // Step 4: Log token transaction
        await ctx.supabase.from('token_transactions').insert([
          {
            user_id: ctx.user.id,
            type: 'spend',
            amount: -5,
            description: 'LinkedIn profile analysis',
          },
        ]);

        // Step 5: Save analysis to linkedin_analyses table
        const { error: insertError } = await ctx.supabase
          .from('linkedin_analyses')
          .insert([
            {
              user_id: ctx.user.id,
              profile_url: input.profileUrl,
              score: analysis.score,
              analysis_data: analysis,
            },
          ]);

        if (insertError) {
          console.error('Insert analysis error:', insertError);
        }

        return analysis;
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        console.error('LinkedIn analyze error:', err);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to analyze LinkedIn profile',
        });
      }
    }),

  history: protectedProcedure.query(async ({ ctx }) => {
    try {
      const { data } = await ctx.supabase
        .from('linkedin_analyses')
        .select('*')
        .eq('user_id', ctx.user.id)
        .order('created_at', { ascending: false });

      return data || [];
    } catch (err) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch LinkedIn analysis history',
      });
    }
  }),
});
