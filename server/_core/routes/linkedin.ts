import { z } from 'zod';
import { router, protectedProcedure } from '../trpc-init';
import { TRPCError } from '@trpc/server';

const APIFY_TOKEN = process.env.APIFY_TOKEN || process.env.APIFY_API_TOKEN || '';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const CLAUDE_MODEL = 'claude-haiku-4-5-20251001';

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

  const runData = await runRes.json();  const runId = runData?.data?.id;
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


function isArabicName(name: string): boolean {
  // Check if name contains Arabic characters
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(name);
}

async function analyzeWithClaude(profileData: any): Promise<any> {
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

  const isArabic = isArabicName(name);
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
        content: `Analyze this LinkedIn profile thoroughly like a senior LinkedIn coach. Return a JSON object with EXACTLY this structure (no markdown, no code blocks, just raw JSON):
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
  "headlineSuggestion": "<improved headline - ${isArabic ? 'in Arabic' : 'in English'}>",
  "summaryCurrent": "<current summary or 'No summary provided'>",
  "summarySuggestion": "<improved professional summary in 3-4 sentences - ${isArabic ? 'in Arabic' : 'in English'}>",
  "keywords": ["keyword1", "keyword2", ...up to 10 relevant keywords for this industry],
  "experienceSuggestions": [{"role": "<role>", "suggestion": "<specific improvement tip - ${isArabic ? 'in Arabic' : 'in English'}>"}],
  "strengths": ["<strength1>", "<strength2>", "<strength3>"],
  "weaknesses": ["<weakness1>", "<weakness2>", "<weakness3>"],
  "actionPlan": [
    "<immediate action 1 - ${isArabic ? 'in Arabic' : 'in English'}>",
    "<immediate action 2>",
    "<immediate action 3>"
  ],
  "industryTips": "<2-3 sentences of industry-specific advice for Saudi/GCC market - ${isArabic ? 'in Arabic' : 'in English'}>"
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

${isArabic ? 'IMPORTANT: All suggestions, strengths, weaknesses, action plan, and tips MUST be in Arabic (Modern Standard Arabic). Reference Vision 2030 if relevant to Saudi market.' : 'IMPORTANT: All text must be in English. Reference Vision 2030 if relevant to Saudi market.'}

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

// Normalize LinkedIn URL for cache key
function normalizeLiUrl(url: string): string {
  const match = url.match(/linkedin\.com\/in\/([^/?#]+)/i);
  return match ? match[1].toLowerCase().replace(/\/$/, '') : url.toLowerCase().trim();
}

export const linkedinRouter = router({
  analyze: protectedProcedure
    .input(z.object({ profileUrl: z.string() }))
    .mutation(async ({ input, ctx }) => {
      try {
        console.log('[LINKEDIN] Analyze request for:', input.profileUrl);

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

        // Check 24h cache first
        const cacheKey = `linkedin:${normalizeLiUrl(input.profileUrl)}`;
        const { data: cached } = await ctx.supabase
          .from('ai_cache')
          .select('result')
          .eq('cache_key', cacheKey)
          .gt('expires_at', new Date().toISOString())
          .maybeSingle();

        let analysis: any;
        if (cached?.result) {
          console.log('[LINKEDIN] Cache HIT for:', cacheKey);
          analysis = cached.result;
        } else {
          console.log('[LINKEDIN] Cache MISS, calling Apify + Claude');
          const profileData = await scrapeLinkedInProfile(input.profileUrl);
          console.log('[LINKEDIN] Profile scraped:', profileData?.fullName || profileData?.firstName);

          analysis = await analyzeWithClaude(profileData);

          // Save to cache (24h TTL)
          const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
          await ctx.supabase.from('ai_cache').upsert({
            cache_key: cacheKey,
            result: analysis,
            model: CLAUDE_MODEL,
            expires_at: expires,
          }, { onConflict: 'cache_key' });
          console.log('[LINKEDIN] Cached result, expires:', expires);
        }

        console.log('[LINKEDIN] Analysis score:', analysis?.score);

        const { error: updateError } = await ctx.supabase
          .from('profiles')
          .update({ token_balance: (profile.token_balance || 0) - 5 })
          .eq('id', ctx.user.id);

        if (updateError) {
          console.error('[LINKEDIN] Token deduction error:', updateError);
          throw updateError;
        }

        // Save to linkedin_analyses table (individual columns)
        const { error: insertError } = await ctx.supabase
          .from('linkedin_analyses')
          .insert([
            {
              user_id: ctx.user.id,
              profile_url: input.profileUrl,
              score: analysis.score || 0,
              headline_current: analysis.headlineCurrent || '',
              headline_suggestion: analysis.headlineSuggestion || '',
              summary_current: analysis.summaryCurrent || '',
              summary_suggestion: analysis.summarySuggestion || '',              keywords_suggestions: analysis.keywords || [],
              experience_suggestions: analysis.experienceSuggestions || [],
              strengths: analysis.strengths || [],
              weaknesses: analysis.weaknesses || [],
            },
          ]);

        if (insertError) {
          console.error('[LINKEDIN] Insert error:', insertError);
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

      return data || [];    } catch (err) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch LinkedIn analysis history',
      });
    }
  }),

  analyzeDeep: protectedProcedure
    .input(z.object({
      linkedinUrl: z.string().optional(),
      imageBase64: z.string().optional(),
      mediaType: z.string().default('image/png'),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        console.log('[DEEP] analyzeDeep request, hasUrl:', !!input.linkedinUrl, 'hasImage:', !!input.imageBase64);

        // Check tokens (25 required)
        const { data: profile } = await ctx.supabase
          .from('profiles')
          .select('token_balance')
          .eq('id', ctx.user.id)
          .single();

        if (!profile || profile.token_balance < 25) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'رصيدك غير كافٍ. تحتاج 25 توكن للتحليل العميق.',
          });
        }

        const cacheKey = 'analyzeDeep:' + (input.linkedinUrl ? normalizeLiUrl(input.linkedinUrl) : ctx.user.id);

        // Check cache
        const { data: cached } = await ctx.supabase
          .from('ai_cache')
          .select('result')
          .eq('cache_key', cacheKey)
          .gt('expires_at', new Date().toISOString())
          .maybeSingle();

        if (cached?.result) {
          console.log('[DEEP] Cache HIT');
          return cached.result;
        }

        // Build profile text
        let profileText = '';

        if (input.linkedinUrl) {
          const profileData = await scrapeLinkedInProfile(input.linkedinUrl);
          const name = profileData.fullName || (profileData.firstName + ' ' + profileData.lastName) || '';
          const headline = profileData.headline || '';
          const summary = profileData.summary || profileData.about || '';
          const location = profileData.location || profileData.addressCountryFull || '';
          const connections = profileData.connectionsCount || profileData.connections || 0;
          const experiences = (profileData.experience || profileData.positions || [])
            .slice(0, 5)
            .map((e: any) => '- ' + (e.title || e.role || '') + ' at ' + (e.companyName || e.company || '') + ' (' + (e.duration || e.timePeriod || '') + ')')
            .join('\n');
          const education = (profileData.education || [])
            .slice(0, 3)
            .map((e: any) => '- ' + (e.degree || e.degreeName || '') + ' from ' + (e.schoolName || e.school || ''))
            .join('\n');
          const skills = (profileData.skills || [])
            .slice(0, 15)
            .map((s: any) => typeof s === 'string' ? s : s.name || s.skill || '')
            .filter(Boolean)
            .join(', ');
          const certs = (profileData.certifications || [])
            .slice(0, 5)
            .map((c: any) => '- ' + (c.name || c.title || ''))
            .join('\n');

          profileText = 'Name: ' + name + '\nHeadline: ' + headline + '\nLocation: ' + location +
            '\nConnections: ' + connections + '\nSummary: ' + summary +
            '\n\nExperience:\n' + (experiences || 'None') +
            '\n\nEducation:\n' + (education || 'None') +
            '\nSkills: ' + (skills || 'None') +
            '\n\nCertifications:\n' + (certs || 'None');
        }

        const DEEP_PROMPT = `You are a world-class LinkedIn coach for Saudi Arabia and GCC market.
Analyze this LinkedIn profile and return ONLY valid JSON — no markdown, no backticks, no explanation.
{
  "score": <number 0-100>,
  "scoreBreakdown": {
    "headline": <0-15>,
    "about": <0-15>,
    "experience": <0-20>,
    "skills": <0-10>,
    "education": <0-10>,
    "photo": <0-10>,
    "connections": <0-10>,
    "certifications": <0-10>
  },
  "strengths": ["<Arabic>", "<Arabic>"],
  "weaknesses": ["<Arabic>", "<Arabic>"],
  "upgradePlan": {
    "headline": {
      "before": "<current headline text>",
      "after": "<optimized headline max 220 chars>",
      "tips": "<Arabic explanation>"
    },
    "about": {
      "before": "<summary of current about>",
      "after": "<full rewrite 500+ chars in Arabic, professional>",
      "tips": "<Arabic explanation>"
    },
    "experience": {
      "before": "<current experience bullets>",
      "after": "<rewritten with numbers, metrics, impact>",
      "tips": "<Arabic explanation>"
    }
  },
  "missingSections": ["<Arabic section name>"],
  "actionChecklist": [
    {"action": "<Arabic>", "time": "<X min>", "priority": "high"},
    {"action": "<Arabic>", "time": "<X min>", "priority": "medium"},
    {"action": "<Arabic>", "time": "<X min>", "priority": "low"}
  ],
  "recommendationTemplate": "<Arabic WhatsApp message to request LinkedIn recommendation from colleague>",
  "bannerDesign": {
    "background": "linear-gradient(135deg, #064E49, #0A8F84)",
    "mainText": "<person name + title>",
    "tagline": "<professional tagline in English>",
    "layout": "right-photo-left-text",
    "accent": "#C9922A"
  }
}
Profile data:`;

        // Build Claude messages
        const messages: any[] = [];
        if (input.imageBase64) {
          messages.push({
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: input.mediaType || 'image/png',
                  data: input.imageBase64,
                },
              },
              { type: 'text', text: DEEP_PROMPT + '\n(See screenshot above)' },
            ],
          });
        } else {
          messages.push({ role: 'user', content: DEEP_PROMPT + '\n' + profileText });
        }

        console.log('[DEEP] Calling Claude claude-sonnet-4-6');
        const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-6',
            max_tokens: 3000,
            messages,
          }),
        });

        if (!claudeRes.ok) {
          const errText = await claudeRes.text();
          console.error('[DEEP] Claude error:', claudeRes.status, errText);
          throw new Error('Claude API error: ' + claudeRes.status);
        }

        const claudeData = await claudeRes.json();
        const text = claudeData.content?.[0]?.text || '';
        const tokensUsed = (claudeData.usage?.input_tokens || 0) + (claudeData.usage?.output_tokens || 0);

        // Parse JSON
        let result: any;
        try {
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          result = JSON.parse(jsonMatch ? jsonMatch[0] : text);
        } catch {
          // Retry: strip markdown fences
          try {
            const cleaned = text.replace(/```json?/g, '').replace(/```/g, '').trim();
            const jsonMatch2 = cleaned.match(/\{[\s\S]*\}/);
            result = JSON.parse(jsonMatch2 ? jsonMatch2[0] : cleaned);
          } catch {
            console.error('[DEEP] JSON parse failed:', text.substring(0, 300));
            return { error: 'فشل تحليل الرد من الذكاء الاصطناعي' };
          }
        }

        // Cache result (24h)
        const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        await ctx.supabase.from('ai_cache').upsert({
          cache_key: cacheKey,
          result,
          model: 'claude-sonnet-4-6',
          tokens_used: tokensUsed,
          expires_at: expires,
        }, { onConflict: 'cache_key' });

        // Deduct 25 tokens
        await ctx.supabase
          .from('profiles')
          .update({ token_balance: (profile.token_balance || 0) - 25 })
          .eq('id', ctx.user.id);

        console.log('[DEEP] Success, score:', result.score, 'tokens:', tokensUsed);
        return result;
      } catch (err: any) {
        console.error('[DEEP] Error:', err?.message || err);
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: err?.message || 'فشل في التحليل العميق',
        });
      }
    }),

});
