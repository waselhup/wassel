import { z } from 'zod';
import { router, protectedProcedure } from '../trpc-init';
import { TRPCError } from '@trpc/server';

const APIFY_TOKEN = process.env.APIFY_TOKEN || '';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const APIFY_PEOPLE_ACTOR = 'harvestapi~linkedin-profile-search';

// Find prospects via Apify LinkedIn search
async function findProspects(
  jobTitle: string,
  companies: string[],
  count: number
): Promise<any[]> {
  if (!APIFY_TOKEN) {
    throw new Error('APIFY_TOKEN not configured');
  }

  const searchQueries = companies.map(
    (company) => `${jobTitle} ${company}`
  );

  const runRes = await fetch(
    `https://api.apify.com/v2/acts/${APIFY_PEOPLE_ACTOR}/run-sync-get-dataset-items?token=${APIFY_TOKEN}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        searchTerms: searchQueries,
        maxResults: Math.min(count, 50),
      }),
    }
  );

  if (!runRes.ok) {
    const errText = await runRes.text();
    console.error('Apify prospects error:', runRes.status, errText);
    throw new Error(`Apify API failed: ${runRes.status}`);
  }

  const results = await runRes.json();
  if (!Array.isArray(results)) return [];

  return results.slice(0, count).map((person: any) => ({
    name: person.fullName || person.name || 'Unknown',
    email: person.email || person.workEmail || null,
    company: person.company || person.companyName || companies[0] || 'Unknown',
    title: person.headline || person.title || jobTitle,
    linkedinUrl: person.profileUrl || person.url || null,
  }));
}

// Generate personalized emails using Claude
async function generateEmails(
  recipients: any[],
  campaignContext: { jobTitle: string; language: string; senderName: string }
): Promise<any[]> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const recipientsList = recipients
    .map(
      (r, i) =>
        `${i + 1}. Name: ${r.name}, Company: ${r.company}, Title: ${r.title}`
    )
    .join('\n');

  const langInstruction =
    campaignContext.language === 'ar'
      ? 'Write ALL emails in formal Modern Standard Arabic. Start with the prospect\'s first name. Never use generic openers. Reference Vision 2030 for Saudi government sector prospects.'
      : 'Write all emails in professional English. Start with the prospect\'s first name. Keep it concise and personal.';

  const prompt = `You are an expert B2B cold email writer. Generate personalized outreach emails for the following prospects.

Sender: ${campaignContext.senderName}
Context: Reaching out regarding ${campaignContext.jobTitle} opportunities/collaboration

Recipients:
${recipientsList}

${langInstruction}

For EACH recipient, generate a personalized email. Return a JSON array (no markdown, no code blocks):
[
  {
    "recipientIndex": 0,
    "subject": "<compelling subject line, max 60 chars>",
    "body": "<personalized email body, 3-5 sentences, professional, with clear CTA>",
    "followUp": "<follow-up email body if no response after 5 days, 2-3 sentences>"
  }
]

Rules:
- Each email MUST reference the recipient's company or title
- Max 500 characters per email body
- Include a clear call-to-action
- Don't be pushy, be helpful and value-focused
- No generic templates — each email should feel personal`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('Claude email error:', res.status, errText);
    throw new Error(`Claude API failed: ${res.status}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text || '';

  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    console.error('Failed to parse Claude email response:', text);
    return recipients.map((r, i) => ({
      recipientIndex: i,
      subject: `Collaboration opportunity - ${r.company}`,
      body: `Hi ${r.name.split(' ')[0]},\n\nI noticed your work at ${r.company} and would love to discuss potential collaboration opportunities related to ${campaignContext.jobTitle}.\n\nWould you be open to a brief conversation this week?\n\nBest regards,\n${campaignContext.senderName}`,
      followUp: `Hi ${r.name.split(' ')[0]},\n\nJust following up on my previous message. I'd love to connect and explore how we might work together.\n\nBest,\n${campaignContext.senderName}`,
    }));
  }
}

export const campaignRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    try {
      const { data } = await ctx.supabase
        .from('email_campaigns')
        .select('*')
        .eq('user_id', ctx.user.id)
        .order('created_at', { ascending: false });

      return data || [];
    } catch (err) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch campaigns',
      });
    }
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      try {
        const { data: campaign } = await ctx.supabase
          .from('email_campaigns')
          .select('*')
          .eq('id', input.id)
          .eq('user_id', ctx.user.id)
          .single();

        if (!campaign) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Campaign not found',
          });
        }

        const { data: recipients } = await ctx.supabase
          .from('email_recipients')
          .select('*')
          .eq('campaign_id', input.id);

        return { campaign, recipients: recipients || [] };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch campaign',
        });
      }
    }),

  create: protectedProcedure
    .input(
      z.object({
        campaignName: z.string().min(1),
        jobTitle: z.string().min(1),
        targetCompanies: z.array(z.string()).min(1),
        recipientCount: z.number().int().positive().max(100),
        language: z.enum(['ar', 'en']),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // Check token balance (1 token per recipient)
        const { data: profile } = await ctx.supabase
          .from('profiles')
          .select('token_balance, full_name')
          .eq('id', ctx.user.id)
          .single();

        const tokensNeeded = input.recipientCount;
        if (!profile || profile.token_balance < tokensNeeded) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Insufficient tokens. You need ${tokensNeeded} tokens for this campaign.`,
          });
        }

        // Step 1: Create campaign record
        const { data: campaign, error: createError } = await ctx.supabase
          .from('email_campaigns')
          .insert([
            {
              user_id: ctx.user.id,
              campaign_name: input.campaignName,
              job_title: input.jobTitle,
              target_companies: input.targetCompanies,
              status: 'finding_prospects',
              total_recipients: 0,
              emails_sent: 0,
              opens_count: 0,
              replies_count: 0,
            },
          ])
          .select()
          .single();

        if (createError) throw createError;

        // Step 2: Find real prospects via Apify
        let prospects: any[];
        try {
          prospects = await findProspects(
            input.jobTitle,
            input.targetCompanies,
            input.recipientCount
          );
        } catch (apifyErr: any) {
          console.error('Prospect finding failed:', apifyErr.message);
          await ctx.supabase
            .from('email_campaigns')
            .update({ status: 'error' })
            .eq('id', campaign.id);

          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to find prospects. Please try again.',
          });
        }

        if (prospects.length === 0) {
          await ctx.supabase
            .from('email_campaigns')
            .update({ status: 'no_prospects' })
            .eq('id', campaign.id);

          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'No prospects found for the given criteria. Try different companies or job titles.',
          });
        }

        // Update status
        await ctx.supabase
          .from('email_campaigns')
          .update({ status: 'generating_emails' })
          .eq('id', campaign.id);

        // Step 3: Generate personalized emails with Claude
        let emails: any[];
        try {
          emails = await generateEmails(prospects, {
            jobTitle: input.jobTitle,
            language: input.language,
            senderName: profile.full_name || 'Professional',
          });
        } catch (claudeErr: any) {
          console.error('Email generation failed:', claudeErr.message);
          await ctx.supabase
            .from('email_campaigns')
            .update({ status: 'error' })
            .eq('id', campaign.id);

          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to generate emails. Please try again.',
          });
        }

        // Step 4: Deduct tokens (actual count of prospects found)
        const actualTokens = prospects.length;
        await ctx.supabase
          .from('profiles')
          .update({ token_balance: (profile.token_balance || 0) - actualTokens })
          .eq('id', ctx.user.id);

        // Log token transaction
        await ctx.supabase.from('token_transactions').insert([
          {
            user_id: ctx.user.id,
            type: 'spend',
            amount: -actualTokens,
            description: `Email campaign: ${input.campaignName} (${actualTokens} recipients)`,
          },
        ]);

        // Step 5: Insert recipients with their generated emails (email_recipients schema)
        const recipientRecords = prospects.map((prospect, i) => {
          const email = emails[i] || emails[0] || {};
          const bodyWithSubject = email.subject
            ? `Subject: ${email.subject}\n\n${email.body || ''}${email.followUp ? `\n\n---\nFollow-up:\n${email.followUp}` : ''}`
            : (email.body || '');
          return {
            campaign_id: campaign.id,
            full_name: prospect.name,
            email: prospect.email || `pending_${i}@discovery.wassel`,
            company: prospect.company,
            job_title: prospect.title,
            linkedin_url: prospect.linkedinUrl,
            email_body: bodyWithSubject,
            status: 'draft',
          };
        });

        if (recipientRecords.length > 0) {
          await ctx.supabase.from('email_recipients').insert(recipientRecords);
        }

        // Update campaign to ready
        await ctx.supabase
          .from('email_campaigns')
          .update({
            status: 'ready',
            total_recipients: prospects.length,
          })
          .eq('id', campaign.id);

        return campaign;
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        console.error('Campaign create error:', err);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create campaign',
        });
      }
    }),
});
