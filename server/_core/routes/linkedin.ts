import { z } from 'zod';
import { router, protectedProcedure } from '../trpc-init';
import { TRPCError } from '@trpc/server';

const APIFY_TOKEN = process.env.APIFY_TOKEN || process.env.APIFY_API_TOKEN || '';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const CLAUDE_MODEL = 'claude-sonnet-4-6';

async function scrapeLinkedInProfile(profileUrl: string): Promise<any> {
  console.log('[APIFY] Starting scrape for:', profileUrl);

  const runRes = await fetch(
    `https://api.apify.com/v2/acts/dev_fusion~Linkedin-Profile-Scraper/runs?token=${APIFY_TOKEN}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileUrls: [profileUrl] }),
    }
  );

  if (!runRes.ok) {
    const errText = await runRes.text();
    console.error('[APIFY] Run failed:', runRes.status, errText);
    throw new Error(`Apify run failed: ${runRes.status}`);
  }

  const runData = await runRes.json();
  const runId = runData?.data?.id;
  console.log('[APIFY] Run started, ID:', runId);

  // Poll for completion (max 120s)
  let status = runData?.data?.status;
  let attempts = 0;
  while (status !== 'SUCCEEDED' && status !== 'FAILED' && status !== 'ABORTED' && attempts < 40) {
    await new Promise((r) => setTimeout(r, 3000));
    const pollRes = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`
    );
    const pollData = await pollRes.json();
    status = pollData?.data?.status;
    attempts++;
    console.log('[APIFY] Poll attempt', attempts, '- status:', status);
  }

  if (status !== 'SUCCEEDED') {
    throw new Error(`Apify run did not succeed: ${status}`);
  }

  // Get dataset items
  const datasetId = runData?.data?.defaultDatasetId;
  const itemsRes = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}`
  );
  const items = await itemsRes.json();
  console.log('[APIFY] Got', Array.isArray(items) ? items.length : 0, 'profile(s)');

  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('No profile data returned from Apify');
  }

  return items[0];
}

async function analyzeWithClaude(profileData: any): Promise<any> {
  // Build a concise profile summary for Claude
  const name = profileData.fullName || profileData.firstName + ' ' + profileData.lastName || 'Unknown';
  const headline = profileData.headline || '';
  const summary = profileData.summary || profileData.about || '';
  const location = profileData.location || profileData.addressCountryFull || '';
  const connections = profileData.connectionsCount || profileData.connections || 0;

  const experiences = (profileData.experience || profileData.positions || [])
    .slice(0, 5)
    .map((e: any) => `- ${e.title || e.role || ''} at ${e.companyName || e.company || ''} (${e.duration || e.timePeriod || ''})`)
    .join('\n');

  const education = (profileData.education || [])
    .slice(0, 3)
    .map((e: any) => `- ${e.degree || e.degreeName || ''} from ${e.schoolName || e.school || ''}`)
    .join('\n');

  const skills = (profileData.skills || [])
    .slice(0, 15)
    .map((s: any) => typeof s === 'string' ? s : s.name || s.skill || '')
    .filter(Boolean)
    .join(', ');

  const profileText = `
Name: ${name}
Headline: ${headline}
Location: ${location}
Connections: ${connections}
Summary: ${summary}

Experience:
${experiences || 'None listed'}

Education:
${education || 'None listed'}

Skills: ${skills || 'None listed'}
`.trim();

  console.log('[CLAUDE] Sending analysis request, model:', CLAUDE_MODEL);
  console.log('[CLAUDE] Profile text length:', profileText.length);

  const claudeBody = {
    model: CLAUDE_MODEL,
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: `You are an expert LinkedIn profile optimizer specializing in the Saudi/GCC job market. Analyze this LinkedIn profile and return a JSON object with EXACTLY this structure (no markdown, no code blocks, just raw JSON):

{
  "score": <number 0-100>,
  "headlineCurrent": "<current headline>",
  "headlineSuggestion": "<improved headline>",
  "summaryCurrent": "<current summary or 'No summary provided'>",
  "summarySuggestion": "<improved professional summary in 2-3 sentences>",
  "keywords": ["keyword1", "keyword2", ...up to 8 relevant keywords],
  "experienceSuggestions": [{"role": "<role>", "suggestion": "<specific improvement tip>"}],
  "strengths": ["<strength1>", "<strength2>", "<strength3>"],
  "weaknesses": ["<weakness1>", "<weakness2>", "<weakness3>"]
}

Score criteria:
- Photo/banner: +10 if likely present (connections > 100 suggests active profile)
- Headline quality: up to 15 points
- Summary quality: up to 15 points
- Experience detail: up to 20 points
- Skills: up to 10 points
- Education: up to 10 points
- Connections: up to 10 points
- Keywords/SEO: up to 10 points

Profile data:
${profileText}`
      }
    ]
  };

  console.log('[CLAUDE] Request body model:', claudeBody.model);

  const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(claudeBody),
  });

  if (!claudeRes.ok) {
    const errText = await claudeRes.text();
    console.error('[CLAUDE] API error:', claudeRes.status, errText);
    throw new Error(`Claude API error: ${claudeRes.status} - ${errText}`);
  }

  const claudeData = await claudeRes.json();
  console.log('[CLAUDE] Response received, stop_reason:', claudeData.stop_reason);

  const text = claudeData.content?.[0]?.text || '';

  // Extract JSON from response (handle possible markdown wrapping)
  let jsonStr = text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    jsonStr = jsonMatch[0];
  }

  try {
    const analysis = JSON.parse(jsonStr);
    return analysis;
  } catch (parseErr) {
    console.error('[CLAUDE] Failed to parse JSON response:', text.substring(0, 500));
    throw new Error('Failed to parse Claude analysis response');
  }
}

export const linkedinRouter = router({
  analyze: protectedProcedure
    .input(z.object({ profileUrl: z.string() }))
    .mutation(async ({ input, ctx }) => {
      try {
        console.log('[LINKEDIN] Analyze request for:', input.profileUrl);

        // Check token balance (need 5 tokens)
        const { data: profile } = await ctx.supabase
          .from('profiles')
          .select('token_balance')
          .eq('id', ctx.user.id)
          .single();

        console.log('[LINKEDIN] User token balance:', profile?.token_balance);

        if (!profile || profile.token_balance < 5) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Insufficient tokens. Need 5 tokens for analysis.',
          });
        }

        // Step 1: Scrape LinkedIn profile via Apify
        const profileData = await scrapeLinkedInProfile(input.profileUrl);
        console.log('[LINKEDIN] Profile scraped:', profileData?.fullName || profileData?.firstName);

        // Step 2: Analyze with Claude AI
        const analysis = await analyzeWithClaude(profileData);
        console.log('[LINKEDIN] Analysis score:', analysis?.score);

        // Step 3: Deduct 5 tokens
        const { error: updateError } = await ctx.supabase
          .from('profiles')
          .update({ token_balance: (profile.token_balance || 0) - 5 })
          .eq('id', ctx.user.id);

        if (updateError) {
          console.error('[LINKEDIN] Token deduction error:', updateError);
          throw updateError;
        }

        // Step 4: Save to linkedin_analyses table
        const { error: insertError } = await ctx.supabase
          .from('linkedin_analyses')
          .insert([
            {
              user_id: ctx.user.id,
              profile_url: input.profileUrl,
              score: analysis.score || 0,
              analysis_data: analysis,
            },
          ]);

        if (insertError) {
          console.error('[LINKEDIN] Insert error:', insertError);
          // Don't throw — analysis still succeeded
        }

        return analysis;
      } catch (err: any) {
        console.error('[LINKEDIN] Error:', err?.message || err);
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: err?.message || 'Failed to analyze LinkedIn profile',
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
