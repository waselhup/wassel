import { BaseAgent } from './base';

export type SayedPlatform = 'snapchat' | 'linkedin' | 'instagram' | 'tiktok' | 'twitter' | 'whatsapp' | 'blog' | 'email';
export type SayedAdChannel = 'snapchat' | 'linkedin' | 'google' | 'tiktok' | 'instagram' | 'meta';

const PLATFORM_RULES: Record<SayedPlatform, string> = {
  snapchat:  'Vertical 9:16, Arabic colloquial, 6-second hook, bold overlay, swipe-up CTA to wasselhub.com.',
  linkedin:  'Carousel (8-10 slides) or long-form text. Provide both AR + EN versions. Schedule for Mon-Thu 07:00-09:00 Riyadh.',
  instagram: 'Carousel + Reel mix. Arabic-first caption. Saudi-relevant hashtags only.',
  tiktok:    '30-60 sec educational. Trending audio + Arabic overlay. "3 mistakes on your LinkedIn" style.',
  twitter:   '5-10 tweet Arabic thread. Mix of insight + 1 CTA tweet.',
  whatsapp:  'Personal, short. Template: "أهلاً [اسم], ...". Always value, never push.',
  blog:      '800-1500 word Arabic article. SEO target: Saudi LinkedIn keywords.',
  email:     'Subject + body in user language. No marketing tone. One clear next step.',
};

interface MonthlyBatchOpts {
  platforms: SayedPlatform[];
  themes?: string[];
  postsPerPlatform?: number;
}

interface SinglePostOpts {
  platform: SayedPlatform;
  topic: string;
  sourceUrl?: string;
}

interface AdCampaignOpts {
  channel: SayedAdChannel;
  objective: string;
  dailyBudgetSar: number;
  targetAudience: string;
}

interface GeneratedPost {
  caption: string;
  hashtags?: string[];
  language: 'ar' | 'en' | 'both';
  visual_prompt?: string;
  title?: string;
  expected_reach?: number;
  expected_ctr?: number;
  expected_signups?: number;
}

interface GeneratedAdCreative {
  variant_id: string;
  headline: string;
  body: string;
  visual_prompt: string;
  audience_hypothesis: string;
  language: 'ar' | 'en' | 'both';
}

function safeJsonParse<T>(raw: string, fallback: T): T {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
  try { return JSON.parse(trimmed) as T; } catch { return fallback; }
}

function defaultPostTimeForPlatform(p: SayedPlatform, dayOffset: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(7, 30, 0, 0);
  if (p === 'snapchat' || p === 'tiktok' || p === 'instagram') d.setHours(20, 0, 0, 0);
  if (p === 'whatsapp' || p === 'email') d.setHours(10, 0, 0, 0);
  return d;
}

export class SayedAgent extends BaseAgent {
  readonly id = 'sayed';
  readonly nameAr = 'سيد';
  readonly nameEn = 'Sayed';

  async generateMonthlyContentBatch(opts: MonthlyBatchOpts): Promise<{ tasksCreated: number; totalEstimatedCostSar: number }> {
    const platforms = opts.platforms;
    const postsPerPlatform = Math.max(1, Math.min(30, opts.postsPerPlatform ?? 30));
    const themes = (opts.themes && opts.themes.length ? opts.themes : [
      'Wassel introduction — what it is and who it serves',
      'LinkedIn headline mistakes Saudi professionals make',
      'Why your LinkedIn isn\'t landing interviews',
      'Vision 2030 jobs explosion — how to ride it',
      'CV vs LinkedIn — what each should say',
      'Salary negotiation in the Saudi market',
      'Personal brand for senior managers',
      'English LinkedIn vs Arabic LinkedIn — when to switch',
    ]);

    let tasksCreated = 0;
    let totalCost = 0;

    for (const platform of platforms) {
      const rule = PLATFORM_RULES[platform];
      const prompt = `Generate ${postsPerPlatform} posts for ${platform} for Wassel's social calendar.

Channel rules: ${rule}

Themes to rotate through:
${themes.map((t, i) => `${i + 1}. ${t}`).join('\n')}

Return STRICT JSON in this shape (no commentary):
{
  "posts": [
    {
      "title": "short internal title",
      "caption": "the actual post copy in Arabic primary",
      "language": "ar" | "en" | "both",
      "hashtags": ["#wassel", "#linkedin_sa"],
      "visual_prompt": "what the visual should depict (no Western-only faces)",
      "expected_reach": 1500,
      "expected_ctr": 1.5,
      "expected_signups": 12
    }
  ]
}

Honor every rule in the brand voice section. Never mention Apify or scraping.`;

      const result = await this.callClaude({
        task: 'post_generate',
        purpose: `monthly_batch_${platform}`,
        system: `You are ${this.nameEn} (${this.nameAr}), Wassel's content maestro. You speak Arabic-first. You write for Saudi professionals. Output STRICT JSON only.`,
        userContent: prompt,
        maxTokens: 8000,
        temperature: 0.8,
      });

      totalCost += result.costSar;
      const parsed = safeJsonParse<{ posts: GeneratedPost[] }>(result.text, { posts: [] });
      const posts = (parsed.posts || []).slice(0, postsPerPlatform);

      for (let i = 0; i < posts.length; i++) {
        const post = posts[i];
        const scheduledFor = defaultPostTimeForPlatform(platform, i + 1);

        const taskId = await this.queueTask({
          taskType: 'social_post',
          title: post.title || `${platform} — ${post.caption.slice(0, 60)}…`,
          payload: { platform, ...post },
          preview: {
            platform,
            caption_snippet: post.caption.slice(0, 200),
            language: post.language,
            visual_prompt: post.visual_prompt,
          },
          scheduledFor,
          estimatedMoneyCostSar: result.costSar / Math.max(posts.length, 1),
          expectedImpact: post.expected_reach
            ? `Reach ${post.expected_reach}, CTR ${post.expected_ctr ?? '?'}%, signups ${post.expected_signups ?? '?'}`
            : 'unknown',
        });

        await this.client().from('content_calendar').insert({
          agent_id: this.id,
          task_id: taskId,
          platform,
          content_type: platform === 'snapchat' ? 'short_video' : platform === 'whatsapp' ? 'message' : platform === 'email' ? 'email' : 'post',
          language: post.language || 'ar',
          title: post.title || null,
          caption: post.caption,
          hashtags: post.hashtags || [],
          visual_prompt: post.visual_prompt || null,
          scheduled_at: scheduledFor.toISOString(),
          status: 'awaiting_approval',
        });

        tasksCreated++;
      }
    }

    return { tasksCreated, totalEstimatedCostSar: Number(totalCost.toFixed(4)) };
  }

  async draftSinglePost(opts: SinglePostOpts): Promise<{ taskId: string }> {
    const rule = PLATFORM_RULES[opts.platform];
    const result = await this.callClaude({
      task: 'post_generate',
      purpose: `single_post_${opts.platform}`,
      system: `You are ${this.nameEn} (${this.nameAr}). Output STRICT JSON only.`,
      userContent: `Draft one ${opts.platform} post about "${opts.topic}"${opts.sourceUrl ? ` repurposing this source: ${opts.sourceUrl}` : ''}.\n\nChannel rules: ${rule}\n\nReturn JSON: { "title": "...", "caption": "...", "language": "ar|en|both", "hashtags": [...], "visual_prompt": "...", "expected_reach": N, "expected_ctr": N, "expected_signups": N }`,
      maxTokens: 2000,
      temperature: 0.8,
    });
    const post = safeJsonParse<GeneratedPost>(result.text, { caption: result.text, language: 'ar' });
    const scheduledFor = defaultPostTimeForPlatform(opts.platform, 1);
    const taskId = await this.queueTask({
      taskType: 'social_post',
      title: post.title || `${opts.platform} — ${opts.topic.slice(0, 50)}…`,
      payload: { platform: opts.platform, sourceUrl: opts.sourceUrl, ...post },
      preview: { platform: opts.platform, caption_snippet: post.caption.slice(0, 200), language: post.language },
      scheduledFor,
      estimatedMoneyCostSar: result.costSar,
      expectedImpact: post.expected_reach ? `Reach ${post.expected_reach}, CTR ${post.expected_ctr ?? '?'}%, signups ${post.expected_signups ?? '?'}` : 'unknown',
    });
    return { taskId };
  }

  async draftAdCampaign(opts: AdCampaignOpts): Promise<{ campaignTaskId: string; creativeVariants: number }> {
    const result = await this.callClaude({
      task: 'campaign_message',
      purpose: `ad_campaign_${opts.channel}`,
      system: `You are ${this.nameEn} (${this.nameAr}), an ad maestro. Output STRICT JSON only.`,
      userContent: `Draft a ${opts.channel} ad campaign.

Objective: ${opts.objective}
Daily budget: ${opts.dailyBudgetSar} SAR
Target audience (user description): ${opts.targetAudience}

Produce:
- 5 creative variants (different hooks/angles)
- 3 audience hypotheses (segmentation we should test)

JSON shape:
{
  "campaign_name": "...",
  "creatives": [{ "variant_id": "v1", "headline": "...", "body": "...", "visual_prompt": "...", "audience_hypothesis": "...", "language": "ar|en|both" }],
  "audience_hypotheses": ["...", "...", "..."]
}`,
      maxTokens: 4000,
      temperature: 0.9,
    });
    const parsed = safeJsonParse<{ campaign_name?: string; creatives?: GeneratedAdCreative[]; audience_hypotheses?: string[] }>(result.text, {});
    const creatives = parsed.creatives || [];
    const campaignName = parsed.campaign_name || `${opts.channel} — ${opts.objective.slice(0, 40)}`;

    const { data: campaign } = await this.client()
      .from('ad_campaigns')
      .insert({
        agent_id: this.id,
        channel: opts.channel,
        name: campaignName,
        objective: opts.objective,
        daily_budget_sar: opts.dailyBudgetSar,
        status: 'awaiting_approval',
        config: {
          creatives,
          audience_hypotheses: parsed.audience_hypotheses || [],
          target_audience: opts.targetAudience,
        },
      })
      .select('id')
      .single();

    const campaignTaskId = await this.queueTask({
      taskType: 'ad_campaign',
      title: campaignName,
      payload: { channel: opts.channel, objective: opts.objective, dailyBudgetSar: opts.dailyBudgetSar, ...parsed },
      preview: {
        channel: opts.channel,
        dailyBudgetSar: opts.dailyBudgetSar,
        creative_count: creatives.length,
        first_headline: creatives[0]?.headline || null,
      },
      estimatedMoneyCostSar: result.costSar,
      expectedImpact: `5 variants × 3 audience hypotheses; budget ${opts.dailyBudgetSar} SAR/day`,
      relatedResourceId: campaign?.id ?? null,
    });

    return { campaignTaskId, creativeVariants: creatives.length };
  }
}

export const sayed = new SayedAgent();
