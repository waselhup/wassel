import { z } from 'zod';
import { router, protectedProcedure } from '../trpc-init';
import { TRPCError } from '@trpc/server';
import { randomUUID } from 'crypto';
import { sendCampaignEmail } from '../lib/email';
import { callClaude, extractText, extractJson } from '../lib/claude-client';
import { deductTokens, refundTokens, throwInsufficientTokensError } from '../lib/tokens';

const ADMIN_EMAILS = ['waselhup@gmail.com', 'almodhih.1995@gmail.com', 'alhashimali649@gmail.com'];

interface ClaudeMessage {
  subject: string;
  body: string;
}

const SYSTEM_CAMPAIGN = `You are a B2B outbound email strategist for the Saudi/GCC market.
Frameworks: Cialdini 6 Principles, Meyer Culture Map (Saudi = high-context + relationship-first + hierarchical), Wharton 4 Quadrants, HubSpot 2024 benchmarks.
Rules:
- Personalize every email with the company name, industry, and city — never generic.
- Cite one relevant metric, case study, or sector trend.
- Subject 8-12 words, hook in first line, Hook → Value → CTA structure, 120-180 word body.
- Banned: "Hope you're well", "Allow me to introduce myself", "We are a leading company", any cliché.
- Arabic = Modern Standard Arabic only (no Gulf dialect, no English mix). Western digits.
- Output: JSON only, no markdown, no code fences.`;

async function generateEmailsWithClaude(opts: {
  companies: Array<{ name: string; industry?: string | null; city?: string | null }>;
  senderRole: string;
  goal: string;
  tone: string;
  language: 'ar' | 'en';
}): Promise<Map<string, ClaudeMessage>> {
  const companiesJson = JSON.stringify(opts.companies);
  const isAr = opts.language === 'ar';
  const lang = isAr ? 'Modern Standard Arabic' : 'professional English';

  const userPrompt = `Write a personalized B2B email per company in this list (output in ${lang}):
${companiesJson}

Context:
- Sender role: ${opts.senderRole}
- Sender goal: ${opts.goal}
- Tone: ${opts.tone}
- Emails go to general company addresses (info@ / contact@).

Return JSON keyed by company name. subject + body are required per company:
{
  "CompanyName": {
    "subject": "<8-12 words, specific, with company/industry cue>",
    "body": "<120-180 words, Hook → Value → CTA>",
    "followUp1Day3": "<value-first day-3 follow-up (no ask)>",
    "followUp2Day7": "<open-question day-7 message>",
    "followUp3Day14": "<polite break-up day-14 message>",
    "persuasion_principle_used": "<Cialdini principle(s)>",
    "cultural_adaptation": "<Meyer Culture Map note — how cultural context shapes this message>"
  }
}`;

  let claudeRes;
  try {
    claudeRes = await callClaude({
      task: 'campaign_message',
      system: SYSTEM_CAMPAIGN,
      userContent: userPrompt,
      maxTokens: Math.min(8000, 800 + opts.companies.length * 600),
    });
  } catch (err: any) {
    throw new Error(`Claude API ${err?.status || 'error'}: ${err?.message?.slice(0, 200) || 'unknown'}`);
  }

  const text = extractText(claudeRes);
  const emailData = extractJson<Record<string, ClaudeMessage>>(text);
  if (!emailData) throw new Error('No JSON in Claude response');

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
      // Token cost: 10 tokens per recipient
      const tokensNeeded = input.companyIds.length * 10;
      const FEATURE = 'campaign.create';
      const lang = (input.language as 'ar' | 'en') || 'en';
      let deducted = false;

      try {
        // Atomic deduct BEFORE downstream work — row-locked, refund below on failure.
        const deduct = await deductTokens(ctx.supabase, ctx.user.id, tokensNeeded, FEATURE);
        if (!deduct.success) throwInsufficientTokensError(deduct, lang);
        deducted = true;
        console.log('[campaign.create] tokens deducted', deduct.balance_before, '→', deduct.balance_after);

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

        // Token deduction already happened atomically up front — no second deduct.

        return { ...campaign, status: 'ready', tokensRemaining: deduct.balance_after };
      } catch (err: any) {
        // Any downstream failure refunds tokens.
        if (deducted) { await refundTokens(ctx.supabase, ctx.user.id, tokensNeeded, FEATURE); deducted = false; }
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
