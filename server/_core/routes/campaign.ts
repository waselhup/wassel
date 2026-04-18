import { z } from 'zod';
import { router, protectedProcedure } from '../trpc-init';
import { TRPCError } from '@trpc/server';
import { randomUUID } from 'crypto';
import { sendCampaignEmail } from '../lib/email';

const ADMIN_EMAILS = ['waselhup@gmail.com', 'almodhih.1995@gmail.com', 'alhashimali649@gmail.com'];

interface ClaudeMessage {
  subject: string;
  body: string;
}

async function generateEmailsWithClaude(opts: {
  companies: Array<{ name: string; industry?: string | null; city?: string | null }>;
  senderRole: string;
  goal: string;
  tone: string;
  language: 'ar' | 'en';
}): Promise<Map<string, ClaudeMessage>> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const companiesJson = JSON.stringify(opts.companies);
  const isAr = opts.language === 'ar';

  const academicHeader = isAr
    ? `أنت B2B Outbound Strategist بخبرة 10 سنوات في LinkedIn و email outreach للسوق السعودي،
مدرّب على:
- Arizona State University — Influence framework (Robert Cialdini)
- Wharton School — Negotiation & Persuasion (Stuart Diamond)
- Harvard Kennedy School — Cross-cultural Communication (Erin Meyer's Culture Map)
- MIT Sloan — B2B Buyer Psychology
- HubSpot Academy Research — 2024 Outreach Benchmarks (13M messages)
- KAUST Innovation Ventures — Saudi B2B sales patterns

الـ principles المطبّقة:
1. Cialdini's 6 Principles: Reciprocity, Commitment, Social Proof, Authority, Liking, Scarcity
2. Meyer's Culture Map (Harvard): السعودية = High-context + Relationship-first + Hierarchical
3. Diamond's "4 Quadrants" (Wharton): Goals, People, Problems, Steps
4. HubSpot 2024 benchmarks:
   - رسائل بتخصيص حقيقي (اسم + صناعة + مدينة): 34% reply rate vs 8% generic
   - Follow-ups بقيمة (مقال/insight) لا طلب: 3x response rate
   - ذكر mutual connection أو Vision 2030 pillar مناسب: +62% engagement

قواعد صارمة:
- فصحى رسمية، لا خليجية، لا إنجليزية مختلطة
- ابدأ بمدخل مخصص لاسم الشركة وصناعتها ومدينتها — لا افتتاحيات عامة
- إذا الشركة حكومية/شبه حكومية: اربط بركيزة Vision 2030 المناسبة (Thriving Economy / Vibrant Society / Ambitious Nation)
- إذا الشركة private sector: اذكر metric أو case study موثوق (مثال HubSpot 2024 أو McKinsey MENA)
- ممنوع: "أتمنى أن تكون بخير"، "اسمح لي أن أقدم نفسي"، "نحن شركة رائدة..."، أي cliché
- اللهجة المطلوبة: ${opts.tone}
- هدف المرسل: ${opts.goal}
- دور المرسل: ${opts.senderRole}
- الرسالة موجهة للعنوان العام للشركة (info@ / contact@)
`
    : `You are a B2B Outbound Strategist with 10 years of experience in LinkedIn and email outreach for the Saudi/GCC market, trained on:
- Arizona State University — Influence framework (Robert Cialdini)
- Wharton School — Negotiation & Persuasion (Stuart Diamond)
- Harvard Kennedy School — Cross-cultural Communication (Erin Meyer's Culture Map)
- MIT Sloan — B2B Buyer Psychology
- HubSpot Academy Research — 2024 Outreach Benchmarks (13M messages)
- KAUST Innovation Ventures — Saudi B2B sales patterns

Principles applied:
1. Cialdini's 6 Principles: Reciprocity, Commitment, Social Proof, Authority, Liking, Scarcity
2. Meyer's Culture Map (Harvard): Saudi Arabia = High-context + Relationship-first + Hierarchical
3. Diamond's "4 Quadrants" (Wharton): Goals, People, Problems, Steps
4. HubSpot 2024 benchmarks:
   - Real personalization (name + industry + city): 34% reply rate vs 8% generic
   - Value-first follow-ups (article / insight, no ask): 3x response rate
   - Mutual connection or Vision 2030 pillar reference: +62% engagement

Strict rules:
- Professional English, concise, respectful of Saudi business culture
- Open with a personalized hook referencing the company name, industry, and city — no generic openers
- Government / semi-government: link to the most relevant Vision 2030 pillar (Thriving Economy / Vibrant Society / Ambitious Nation)
- Private sector: cite a specific metric or case study (HubSpot 2024, McKinsey MENA, etc.)
- Banned: "Hope you're well", "Allow me to introduce myself", "We are a leading company", any cliché
- Requested tone: ${opts.tone}
- Sender goal: ${opts.goal}
- Sender role: ${opts.senderRole}
- Messages go to general company addresses (info@ / contact@)
`;

  const systemPrompt = academicHeader + (isAr ? '\nارجع JSON فقط.' : '\nRespond with JSON only.');

  const userPrompt = isAr
    ? `اكتب رسالة B2B مخصصة لكل شركة في هذه القائمة:
${companiesJson}

لكل شركة، طبّق Cialdini + Meyer + Diamond + HubSpot 2024 وأنتج:
- subject: 8-12 كلمة، محددة ومغرية للفتح، تحتوي على اسم الشركة أو إشارة واضحة لصناعتها
- body: 120-180 كلمة، بنية Hook → Value → CTA:
  * Hook: جملة افتتاحية مخصصة لاسم الشركة/صناعتها/مدينتها
  * Value: قيمة أكاديمية أو عملية مدعومة بمصدر (HubSpot 2024 / McKinsey MENA / Vision 2030 pillar) — Cialdini Authority + Social Proof
  * CTA: طلب مكالمة قصيرة أو سؤال مفتوح (Diamond Quadrant 4: Steps)

اختياريًا أضف (لو كانت تفيد المرسل لاحقًا):
- followUp1Day3: رسالة متابعة يوم 3 تقدم قيمة (مقال/insight) بدون طلب — HubSpot 2024 pattern
- followUp2Day7: رسالة يوم 7 تطرح سؤالًا مفتوحًا — Wharton Diamond technique
- followUp3Day14: "break-up message" مهذبة يوم 14 — Wharton break-up technique
- persuasion_principle_used: أي مبادئ Cialdini طبّقت
- cultural_adaptation: ملاحظة عن التكيف الثقافي (High-context / Vision 2030 / hierarchy)

JSON — الحقول subject و body مطلوبة لكل شركة لضمان عمل الواجهة؛ الحقول الأخرى اختيارية:
{
  "CompanyName": {
    "subject": "...",
    "body": "...",
    "followUp1Day3": "...",
    "followUp2Day7": "...",
    "followUp3Day14": "...",
    "persuasion_principle_used": "Authority + Liking (Cialdini)",
    "cultural_adaptation": "High-context Saudi formal, Vision 2030 Thriving Economy reference"
  }
}`
    : `Write a personalized B2B email for each company in this list:
${companiesJson}

For each company, apply Cialdini + Meyer + Diamond + HubSpot 2024 and produce:
- subject: 8-12 words, specific and open-worthy, containing the company name or a clear industry cue
- body: 120-180 words in Hook → Value → CTA structure:
  * Hook: personalized opener referencing the company name/industry/city
  * Value: academic or practical value backed by a source (HubSpot 2024 / McKinsey MENA / Vision 2030 pillar) — Cialdini Authority + Social Proof
  * CTA: short call request or open-ended question (Diamond Quadrant 4: Steps)

Optionally add (useful for a future sequencing feature):
- followUp1Day3: day-3 follow-up providing value (article/insight) with no ask — HubSpot 2024 pattern
- followUp2Day7: day-7 message with an open question — Wharton Diamond technique
- followUp3Day14: polite "break-up message" on day 14 — Wharton break-up technique
- persuasion_principle_used: which Cialdini principles you applied
- cultural_adaptation: note on cultural adaptation (High-context / Vision 2030 / hierarchy)

JSON — subject and body are required per company so the UI keeps working; other fields are optional:
{
  "CompanyName": {
    "subject": "...",
    "body": "...",
    "followUp1Day3": "...",
    "followUp2Day7": "...",
    "followUp3Day14": "...",
    "persuasion_principle_used": "Authority + Liking (Cialdini)",
    "cultural_adaptation": "High-context Saudi formal, Vision 2030 Thriving Economy reference"
  }
}`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      system: systemPrompt + '\n\nIMPORTANT: Respond ONLY with valid JSON. No markdown, no code fences.',
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Claude API ${response.status}: ${errText.slice(0, 200)}`);
  }

  const result = (await response.json()) as { content: Array<{ type: string; text: string }> };
  const text = result.content?.[0]?.text || '';

  let emailData: Record<string, ClaudeMessage>;
  try {
    emailData = JSON.parse(text.trim());
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('No JSON in Claude response');
    emailData = JSON.parse(m[0]);
  }

  const out = new Map<string, ClaudeMessage>();
  for (const [company, msg] of Object.entries(emailData)) {
    if (msg && typeof msg === 'object' && 'subject' in msg && 'body' in msg) {
      out.set(company, { subject: String(msg.subject), body: String(msg.body) });
    }
  }
  return out;
}

export const campaignRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const { data } = await ctx.supabase
      .from('email_campaigns')
      .select('*')
      .eq('user_id', ctx.user.id)
      .order('created_at', { ascending: false });
    return data || [];
  }),

  get: protectedProcedure.input(z.object({ id: z.string().uuid() })).query(async ({ input, ctx }) => {
    const { data: campaign } = await ctx.supabase
      .from('email_campaigns')
      .select('*')
      .eq('id', input.id)
      .eq('user_id', ctx.user.id)
      .single();
    if (!campaign) throw new TRPCError({ code: 'NOT_FOUND', message: 'Campaign not found' });

    const { data: recipients } = await ctx.supabase
      .from('email_recipients')
      .select('*')
      .eq('campaign_id', input.id)
      .order('status', { ascending: true });

    return { campaign, recipients: recipients || [] };
  }),

  /** Preview AI-generated messages for a handful of companies before committing. */
  previewMessages: protectedProcedure
    .input(
      z.object({
        senderRole: z.string().min(1),
        goal: z.string().min(1),
        tone: z.enum(['professional', 'friendly', 'concise']).default('professional'),
        language: z.enum(['ar', 'en']),
        companyIds: z.array(z.string().uuid()).min(1).max(5),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { data: companies, error } = await ctx.supabase
        .from('saudi_companies')
        .select('id, name, name_ar, industry, city')
        .in('id', input.companyIds);
      if (error || !companies?.length) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Companies not found' });
      }

      const emailMap = await generateEmailsWithClaude({
        companies: companies.map((c: any) => ({ name: c.name, industry: c.industry, city: c.city })),
        senderRole: input.senderRole,
        goal: input.goal,
        tone: input.tone,
        language: input.language,
      });

      return {
        messages: companies.map((c: any) => {
          const msg = emailMap.get(c.name);
          return {
            companyId: c.id,
            companyName: c.name,
            subject: msg?.subject || '',
            body: msg?.body || '',
          };
        }),
      };
    }),

  /**
   * Create a legal B2B campaign.
   * Selects companies from the saudi_companies directory, generates messages via Claude,
   * creates email_recipients rows with per-recipient unsubscribe tokens,
   * and sets status='ready' (sending is queued — not sent immediately).
   */
  create: protectedProcedure
    .input(
      z.object({
        campaignName: z.string().min(1),
        senderRole: z.string().min(1),
        goal: z.string().min(1),
        tone: z.enum(['professional', 'friendly', 'concise']).default('professional'),
        language: z.enum(['ar', 'en']),
        companyIds: z.array(z.string().uuid()).min(1).max(50),
        dailyLimit: z.number().int().min(1).max(50).default(20),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // Token cost: 10 tokens per recipient
        const tokensNeeded = input.companyIds.length * 10;

        const { data: profile, error: profileErr } = await ctx.supabase
          .from('profiles')
          .select('token_balance')
          .eq('id', ctx.user.id)
          .single();
        if (profileErr) throw new TRPCError({ code: 'BAD_REQUEST', message: profileErr.message });
        if (!profile || (profile.token_balance || 0) < tokensNeeded) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Insufficient tokens. Need ${tokensNeeded}, have ${profile?.token_balance || 0}`,
          });
        }

        const { data: companies, error: cErr } = await ctx.supabase
          .from('saudi_companies')
          .select('id, name, name_ar, industry, city, primary_email, contact_emails')
          .in('id', input.companyIds);
        if (cErr || !companies?.length) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'No companies found' });
        }

        const eligible = companies.filter((c: any) => c.primary_email);
        if (eligible.length === 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Selected companies have no contact email. Enrich them first.',
          });
        }

        // Check suppression list
        const emailsToCheck = eligible.map((c: any) => c.primary_email);
        const { data: suppressed } = await ctx.supabase
          .from('email_suppressions')
          .select('email')
          .in('email', emailsToCheck);
        const suppressedSet = new Set((suppressed || []).map((s: any) => s.email));
        const finalTargets = eligible.filter((c: any) => !suppressedSet.has(c.primary_email));

        if (finalTargets.length === 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'All recipients are on the suppression list.',
          });
        }

        // Create campaign (draft)
        const { data: campaign, error: createErr } = await ctx.supabase
          .from('email_campaigns')
          .insert([
            {
              user_id: ctx.user.id,
              campaign_name: input.campaignName,
              job_title: input.senderRole,
              goal: input.goal,
              tone: input.tone,
              target_companies: finalTargets.map((c: any) => c.name),
              status: 'generating',
              total_recipients: finalTargets.length,
              daily_send_limit: input.dailyLimit,
            },
          ])
          .select()
          .single();
        if (createErr || !campaign) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: createErr?.message || 'Insert failed' });
        }

        // Generate messages via Claude
        let emailMap: Map<string, ClaudeMessage>;
        try {
          emailMap = await generateEmailsWithClaude({
            companies: finalTargets.map((c: any) => ({ name: c.name, industry: c.industry, city: c.city })),
            senderRole: input.senderRole,
            goal: input.goal,
            tone: input.tone,
            language: input.language,
          });
        } catch (ce: any) {
          await ctx.supabase.from('email_campaigns').delete().eq('id', campaign.id);
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Claude failed: ${ce?.message || 'Unknown'}` });
        }

        // Build recipients with unsubscribe tokens
        const recipients = finalTargets.map((c: any) => {
          const msg = emailMap.get(c.name) || { subject: `Inquiry for ${c.name}`, body: 'Message generation failed — please edit before sending.' };
          const token = randomUUID().replace(/-/g, '');
          return {
            campaign_id: campaign.id,
            company_id: c.id,
            full_name: c.name,
            company: c.name,
            email: c.primary_email,
            job_title: input.senderRole,
            status: 'pending',
            email_subject: msg.subject,
            email_body: msg.body,
            unsubscribe_token: token,
            dry_run: true,
          };
        });

        const { error: insErr } = await ctx.supabase.from('email_recipients').insert(recipients);
        if (insErr) {
          await ctx.supabase.from('email_campaigns').delete().eq('id', campaign.id);
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Recipients insert failed: ${insErr.message}` });
        }

        // Insert unsubscribe tokens
        const tokenRows = recipients.map((r) => ({
          token: r.unsubscribe_token,
          email: r.email,
          campaign_id: campaign.id,
        }));
        await ctx.supabase.from('unsubscribe_tokens').insert(tokenRows);

        // Update campaign → ready
        await ctx.supabase.from('email_campaigns').update({ status: 'ready' }).eq('id', campaign.id);

        // Deduct tokens
        await ctx.supabase
          .from('profiles')
          .update({ token_balance: (profile.token_balance || 0) - tokensNeeded })
          .eq('id', ctx.user.id);

        return { ...campaign, status: 'ready' };
      } catch (err: any) {
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: err?.message || 'Campaign creation failed',
        });
      }
    }),

  /** Launch a ready campaign — flips status to 'active' (queue processor picks it up). */
  launch: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const { data: campaign } = await ctx.supabase
        .from('email_campaigns')
        .select('id, user_id, status')
        .eq('id', input.id)
        .single();
      if (!campaign || campaign.user_id !== ctx.user.id) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Campaign not found' });
      }
      if (campaign.status !== 'ready') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: `Cannot launch campaign in status: ${campaign.status}` });
      }
      await ctx.supabase.from('email_campaigns').update({ status: 'active' }).eq('id', input.id);
      return { ok: true };
    }),

  pause: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const { data: campaign } = await ctx.supabase
        .from('email_campaigns')
        .select('id, user_id')
        .eq('id', input.id)
        .single();
      if (!campaign || campaign.user_id !== ctx.user.id) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Campaign not found' });
      }
      await ctx.supabase.from('email_campaigns').update({ status: 'paused' }).eq('id', input.id);
      return { ok: true };
    }),

  updateRecipient: protectedProcedure
    .input(
      z.object({
        recipientId: z.string().uuid(),
        subject: z.string().optional(),
        body: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const patch: any = {};
      if (input.subject !== undefined) patch.email_subject = input.subject;
      if (input.body !== undefined) patch.email_body = input.body;

      const { data: rec } = await ctx.supabase
        .from('email_recipients')
        .select('id, campaign_id, email_campaigns!inner(user_id)')
        .eq('id', input.recipientId)
        .single();
      if (!rec) throw new TRPCError({ code: 'NOT_FOUND' });

      const { error } = await ctx.supabase.from('email_recipients').update(patch).eq('id', input.recipientId);
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return { ok: true };
    }),

  /**
   * Admin-only: process next batch of pending recipients.
   * Honors the CAMPAIGN_SENDING_ACTIVE platform config — when false, logs to email_send_log as dry_run.
   */
  processBatch: protectedProcedure
    .input(z.object({ batchSize: z.number().int().min(1).max(50).default(10) }))
    .mutation(async ({ input, ctx }) => {
      const { data: me } = await ctx.supabase.from('profiles').select('is_admin, email').eq('id', ctx.user.id).single();
      if (!me?.is_admin && !ADMIN_EMAILS.includes(me?.email || '')) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin only' });
      }

      const { data: cfg } = await ctx.supabase
        .from('platform_config')
        .select('value')
        .eq('key', 'campaign_sending_active')
        .single();
      const sendingActive = cfg?.value === true;

      // Pull active campaigns, then pending recipients
      const { data: active } = await ctx.supabase
        .from('email_campaigns')
        .select('id, user_id, daily_send_limit, sends_today, last_send_at')
        .eq('status', 'active')
        .order('last_send_at', { ascending: true, nullsFirst: true })
        .limit(10);
      if (!active?.length) return { processed: 0, active: 0, dryRun: !sendingActive };

      const { data: recipients } = await ctx.supabase
        .from('email_recipients')
        .select('id, campaign_id, email, email_subject, email_body, unsubscribe_token, full_name')
        .in('campaign_id', active.map((c: any) => c.id))
        .eq('status', 'pending')
        .limit(input.batchSize);

      let processed = 0;
      for (const r of recipients || []) {
        const result = await sendCampaignEmail({
          to: r.email,
          subject: r.email_subject || '(no subject)',
          body: r.email_body || '',
          unsubscribeToken: r.unsubscribe_token,
          dryRun: !sendingActive,
        });

        await ctx.supabase.from('email_send_log').insert([
          {
            campaign_id: r.campaign_id,
            recipient_id: r.id,
            user_id: ctx.user.id,
            to_email: r.email,
            subject: r.email_subject,
            status: result.success ? (sendingActive ? 'sent' : 'dry_run') : 'failed',
            provider: sendingActive ? 'resend' : 'dry_run',
            provider_message_id: result.messageId || null,
            error_message: result.error || null,
            dry_run: !sendingActive,
          },
        ]);

        await ctx.supabase
          .from('email_recipients')
          .update({
            status: result.success ? 'sent' : 'failed',
            sent_at: result.success ? new Date().toISOString() : null,
            last_attempt_at: new Date().toISOString(),
            send_attempts: 1,
            dry_run: !sendingActive,
          })
          .eq('id', r.id);

        processed++;
      }

      // Bump campaign counters
      for (const c of active) {
        const countForCampaign = (recipients || []).filter((r: any) => r.campaign_id === c.id).length;
        if (countForCampaign > 0) {
          await ctx.supabase
            .from('email_campaigns')
            .update({
              sends_today: (c.sends_today || 0) + countForCampaign,
              last_send_at: new Date().toISOString(),
              emails_sent: (c.sends_today || 0) + countForCampaign,
            })
            .eq('id', c.id);
        }
      }

      return { processed, active: active.length, dryRun: !sendingActive };
    }),
});
