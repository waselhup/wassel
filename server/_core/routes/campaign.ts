import { z } from 'zod';
import { router, protectedProcedure } from '../trpc-init';
import { TRPCError } from '@trpc/server';

const APIFY_TOKEN = process.env.APIFY_TOKEN || process.env.APIFY_API_TOKEN || '';

interface ClaudeMessage {
  subject: string;
  body: string;
}

/**
 * Batch-generate personalized B2B outreach emails using Claude API
 */
async function generateEmailsWithClaude(
  companies: string[],
  jobTitle: string,
  language: 'ar' | 'en'
): Promise<Map<string, ClaudeMessage>> {
  console.log('[CAMPAIGN] Starting Claude API email generation for', companies.length, 'companies');

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const companiesJson = JSON.stringify(companies);
  
  const systemPrompt = language === 'ar'
    ? `أنت خبير تسويق بريد إلكتروني متخصص في كتابة رسائل B2B احترافية موجهة شخصياً. 
       اكتب رسائل احترافية بالعربية واضحة وموجزة وفعالة.       الرد يجب أن يكون JSON فقط بدون أي نص إضافي.`
    : `You are an expert B2B email marketing specialist. Write professional, personalized outreach emails in English.
       Keep emails concise, professional, and engaging.
       Response must be valid JSON only, no additional text.`;

  const userPrompt = language === 'ar'
    ? `أنشئ رسائل بريد إلكتروني موجهة شخصياً لكل شركة من هذه الشركات:
${companiesJson}

الموضوع الوظيفي: ${jobTitle}

لكل شركة، أنشئ:
- subject: سطر الموضوع (25-50 كلمة بالعربية)
- body: نص الرسالة (150-250 كلمة، احترافية وموجهة للشركة)

الرد JSON:
{
  "CompanyName": {
    "subject": "...",
    "body": "..."
  }
}`
    : `Generate personalized B2B outreach emails for these companies:
${companiesJson}

Target job title: ${jobTitle}

For each company, create:
- subject: Email subject line (25-50 words)
- body: Email body (150-250 words, professional and company-specific)
Response as JSON only:
{
  "CompanyName": {
    "subject": "...",
    "body": "..."
  }
}`;

  try {
    console.log('[CLAUDE] Calling claude-sonnet-4-5 model');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 8192,
        system: systemPrompt + '\n\nIMPORTANT: Respond ONLY with valid JSON. No markdown, no code fences, no explanation text.',
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[CLAUDE] API error:', response.status, errorText);
      throw new Error(`Claude API error: ${response.status}`);
    }

    const result = await response.json() as {
      content: Array<{ type: string; text: string }>;
    };

    console.log('[CLAUDE] API response received');

    if (!result.content || result.content.length === 0) {
      throw new Error('Empty response from Claude');
    }

    const textContent = result.content[0];
    if (textContent.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    // Parse the JSON response with robust extraction
    let emailData: Record<string, ClaudeMessage>;
    try {
      // Try direct parse first
      emailData = JSON.parse(textContent.text.trim());
      console.log('[CAMPAIGN] Direct JSON parse succeeded');
    } catch {
      // Fallback: extract JSON from markdown/text
      try {
        const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          console.error('[CAMPAIGN] No JSON found in response:', textContent.text.substring(0, 500));
          throw new Error('No JSON in Claude response');
        }
        emailData = JSON.parse(jsonMatch[0]);
        console.log('[CAMPAIGN] Regex JSON extraction succeeded');
      } catch (parseErr) {
        console.error('[CAMPAIGN] Failed to parse Claude response:', textContent.text.substring(0, 500));
        throw new Error('Invalid JSON response from Claude');
      }
    }
    console.log('[CAMPAIGN] Successfully parsed', Object.keys(emailData).length, 'emails from Claude');

    // Convert to Map for easier lookup
    const emailMap = new Map<string, ClaudeMessage>();
    for (const [company, message] of Object.entries(emailData)) {
      if (message && typeof message === 'object' && 'subject' in message && 'body' in message) {
        emailMap.set(company, {
          subject: String(message.subject),
          body: String(message.body),
        });
      }
    }

    console.log('[CAMPAIGN] Email generation complete:', emailMap.size, 'emails generated');
    return emailMap;
  } catch (err) {
    console.error('[CLAUDE] Email generation failed:', err);
    throw err;
  }
}

export const campaignRouter = router({
  previewMessages: protectedProcedure
    .input(
      z.object({
        jobTitle: z.string().min(1),
        targetCompanies: z.array(z.string()).min(1).max(10),
        language: z.enum(['ar', 'en']),
      })
    )
    .mutation(async ({ input }) => {
      try {
        console.log('[CAMPAIGN] Generating preview messages for', input.targetCompanies.length, 'companies');
        const emailMap = await generateEmailsWithClaude(
          input.targetCompanies,
          input.jobTitle,
          input.language
        );
        const messages: Array<{ company: string; subject: string; body: string }> = [];
        for (const company of input.targetCompanies) {
          const msg = emailMap.get(company);
          if (msg) {
            messages.push({ company, subject: msg.subject, body: msg.body });
          } else {
            messages.push({ company, subject: '', body: '' });
          }
        }
        console.log('[CAMPAIGN] Preview generated:', messages.length, 'messages');
        return { messages };
      } catch (err: any) {
        console.error('[CAMPAIGN] Preview error:', err?.message);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Preview failed: ${err?.message || 'Unknown'}`,
        });
      }
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    try {
      console.log('[CAMPAIGN] Fetching campaigns for user', ctx.user.id);
      const { data } = await ctx.supabase
        .from('email_campaigns')
        .select('*')
        .eq('user_id', ctx.user.id)
        .order('created_at', { ascending: false });

      console.log('[CAMPAIGN] Found', data?.length || 0, 'campaigns');
      return data || [];
    } catch (err) {
      console.error('[CAMPAIGN] List error:', err);
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
        console.log('[CAMPAIGN] Fetching campaign', input.id);

        const { data: campaign } = await ctx.supabase
          .from('email_campaigns')
          .select('*')
          .eq('id', input.id)
          .eq('user_id', ctx.user.id)
          .single();

        if (!campaign) {          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Campaign not found',
          });
        }

        const { data: recipients } = await ctx.supabase
          .from('email_recipients')
          .select('*')
          .eq('campaign_id', input.id);

        console.log('[CAMPAIGN] Fetched campaign with', recipients?.length || 0, 'recipients');
        return { campaign, recipients: recipients || [] };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        console.error('[CAMPAIGN] Get error:', err);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch campaign',
        });
      }
    }),


  discoverProspects: protectedProcedure
    .input(z.object({
      jobTitle: z.string().min(1),
      industry: z.string().optional(),
      location: z.string().default('Saudi Arabia'),
    }))
    .mutation(async ({ input }) => {
      console.log('[CAMPAIGN] Discovering prospects for:', input.jobTitle, 'in', input.location);
      
      if (!APIFY_TOKEN) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Apify token not configured' });
      }

      try {
        // Call Apify LinkedIn profile search actor
        const runRes = await fetch(
          `https://api.apify.com/v2/acts/harvestapi~linkedin-profile-search/runs?token=${APIFY_TOKEN}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              keyword: input.jobTitle,
              location: input.location,
              count: 20,
            }),
          }
        );

        if (!runRes.ok) {
          const errText = await runRes.text();
          console.error('[APIFY] Run failed:', runRes.status, errText);
          throw new Error('Prospect search failed: ' + runRes.status);
        }

        const runData = await runRes.json();
        const runId = runData?.data?.id;
        const datasetId = runData?.data?.defaultDatasetId;
        console.log('[APIFY] Search started, run ID:', runId);

        // Poll for completion (max 60s)
        let status = runData?.data?.status;
        let attempts = 0;
        while (status !== 'SUCCEEDED' && status !== 'FAILED' && status !== 'ABORTED' && attempts < 20) {
          await new Promise(r => setTimeout(r, 3000));
          const pollRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`);
          const pollData = await pollRes.json();
          status = pollData?.data?.status;
          attempts++;
          console.log('[APIFY] Poll', attempts, '- status:', status);
        }

        if (status !== 'SUCCEEDED') {
          throw new Error('Prospect search did not complete: ' + status);
        }

        // Get results
        const itemsRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}`);
        const items = await itemsRes.json();
        console.log('[APIFY] Got', Array.isArray(items) ? items.length : 0, 'prospects');

        const prospects = (Array.isArray(items) ? items : []).slice(0, 20).map((item: any) => ({
          name: item.fullName || item.firstName + ' ' + (item.lastName || ''),
          title: item.headline || item.title || '',
          company: item.companyName || item.company || '',
          linkedinUrl: item.profileUrl || item.url || '',
          email: item.email || '',
          location: item.location || '',
          connections: item.connectionsCount || item.connections || 0,
        }));

        return { prospects };
      } catch (err: any) {
        console.error('[CAMPAIGN] Discover error:', err?.message);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: err?.message || 'Failed to discover prospects',
        });
      }
    }),

  generateMessages: protectedProcedure
    .input(z.object({
      prospects: z.array(z.object({
        name: z.string(),
        title: z.string(),
        company: z.string(),
        linkedinUrl: z.string().optional(),
      })).min(1).max(20),
      jobTitle: z.string(),
      language: z.enum(['ar', 'en']),
    }))
    .mutation(async ({ input }) => {
      console.log('[CAMPAIGN] Generating messages for', input.prospects.length, 'prospects');

      if (!process.env.ANTHROPIC_API_KEY) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Claude API key not configured' });
      }

      const prospectsJson = JSON.stringify(input.prospects.map(p => ({
        name: p.name,
        title: p.title,
        company: p.company,
      })));

      const systemPrompt = input.language === 'ar'
        ? 'You are an expert at writing personalized B2B outreach messages for the Saudi market. Write in Modern Standard Arabic. Never start with generic openers. Each message must mention the person\'s name and company. Keep messages 200-300 characters. End with a call to connect.'
        : 'You are an expert at writing personalized B2B outreach messages. Write professional, concise messages. Each must mention the prospect\'s name and company. Keep messages 200-300 characters.';

      const userPrompt = input.language === 'ar'
        ? `Generate personalized outreach messages for each prospect. My role: ${input.jobTitle}.

Prospects:
${prospectsJson}

Return JSON array:
[{"prospectName":"...","company":"...","subject":"...","body":"..."}]

Rules:
- Each message unique and personalized
- Mention prospect name and company
- Reference Vision 2030 if company is Saudi government/semi-gov
- 200-300 chars per body
- Professional Arabic`
        : `Generate personalized outreach messages for each prospect. My role: ${input.jobTitle}.

Prospects:
${prospectsJson}

Return JSON array:
[{"prospectName":"...","company":"...","subject":"...","body":"..."}]`;

      try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.ANTHROPIC_API_KEY!,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-5',
            max_tokens: 8192,
            system: systemPrompt + '\n\nIMPORTANT: Respond ONLY with valid JSON array. No markdown, no code fences.',
            messages: [{ role: 'user', content: userPrompt }],
          }),
        });

        if (!response.ok) {
          throw new Error('Claude API error: ' + response.status);
        }

        const result = await response.json() as any;
        const text = result.content?.[0]?.text || '';
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
          throw new Error('Failed to parse messages response');
        }

        const messages = JSON.parse(jsonMatch[0]);
        console.log('[CAMPAIGN] Generated', messages.length, 'messages');
        return { messages };
      } catch (err: any) {
        console.error('[CAMPAIGN] Generate messages error:', err?.message);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: err?.message || 'Failed to generate messages',
        });
      }
    }),

  send: protectedProcedure
    .input(z.object({
      campaignId: z.string().uuid(),
      messages: z.array(z.object({
        email: z.string().email(),
        subject: z.string(),
        body: z.string(),
      })).min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      console.log('[CAMPAIGN] Sending', input.messages.length, 'emails for campaign:', input.campaignId);

      // Get user's Gmail token
      const { data: profile } = await ctx.supabase
        .from('profiles')
        .select('google_oauth_token, google_refresh_token')
        .eq('id', ctx.user.id)
        .single();

      if (!profile?.google_oauth_token) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Gmail not connected. Please connect your Gmail account first.',
        });
      }

      let sent = 0;
      let failed = 0;

      for (const msg of input.messages) {
        try {
          const emailContent = [
            'Content-Type: text/plain; charset=utf-8',
            'MIME-Version: 1.0',
            `To: ${msg.email}`,
            `Subject: =?UTF-8?B?${Buffer.from(msg.subject).toString('base64')}?=`,
            '',
            msg.body,
          ].join('\r\n');

          const encodedMessage = Buffer.from(emailContent).toString('base64')
            .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

          const gmailRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
            method: 'POST',
            headers: {
              'Authorization': 'Bearer ' + profile.google_oauth_token,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ raw: encodedMessage }),
          });

          if (gmailRes.ok) {
            sent++;
            // Update recipient status
            await ctx.supabase
              .from('campaign_recipients')
              .update({ status: 'sent', sent_at: new Date().toISOString() })
              .eq('campaign_id', input.campaignId)
              .eq('prospect_email', msg.email);
          } else {
            failed++;
            const errText = await gmailRes.text();
            console.error('[GMAIL] Send failed for', msg.email, ':', errText);
            await ctx.supabase
              .from('campaign_recipients')
              .update({ status: 'failed' })
              .eq('campaign_id', input.campaignId)
              .eq('prospect_email', msg.email);
          }
        } catch (err) {
          failed++;
          console.error('[GMAIL] Error sending to', msg.email, ':', err);
        }
      }

      console.log('[CAMPAIGN] Send complete. Sent:', sent, 'Failed:', failed);
      return { sent, failed };
    }),

  create: protectedProcedure
    .input(
      z.object({
        campaignName: z.string().min(1),
        jobTitle: z.string().min(1),
        targetCompanies: z.array(z.string()).min(1),
        recipientCount: z.number().int().positive().max(100),        language: z.enum(['ar', 'en']),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        console.log('[CAMPAIGN] Creating campaign:', input.campaignName);
        console.log('[CAMPAIGN] User ID:', ctx.user.id);
        console.log('[CAMPAIGN] Input:', JSON.stringify(input));

        // Validate recipientCount limit
        if (input.recipientCount > 100) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Maximum 100 recipients per campaign',
          });
        }

        // Check token balance
        console.log('[CAMPAIGN] Step 1: Checking token balance');
        const { data: profile, error: profileError } = await ctx.supabase
          .from('profiles')
          .select('token_balance')
          .eq('id', ctx.user.id)
          .single();

        if (profileError) {
          console.error('[CAMPAIGN] Profile fetch error:', profileError);
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Profile error: ${profileError.message}`,          });
        }

        const tokensNeeded = input.recipientCount;
        if (!profile || profile.token_balance < tokensNeeded) {
          console.log('[CAMPAIGN] Insufficient tokens:', profile?.token_balance || 0, 'needed:', tokensNeeded);
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Insufficient tokens',
          });
        }

        console.log('[CAMPAIGN] Step 2: Token balance OK:', profile.token_balance);

        // Create campaign in draft status
        console.log('[CAMPAIGN] Step 3: Inserting campaign into DB');
        const { data: campaign, error: createError } = await ctx.supabase
          .from('email_campaigns')
          .insert([
            {
              user_id: ctx.user.id,
              campaign_name: input.campaignName,
              job_title: input.jobTitle,
              target_companies: input.targetCompanies,
              status: 'draft',
              total_recipients: input.recipientCount,
            },
          ])
          .select()          .single();

        if (createError || !campaign) {
          console.error('[CAMPAIGN] Campaign creation failed:', JSON.stringify(createError));
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `DB insert failed: ${createError?.message || 'No data returned'}`,
          });
        }

        console.log('[CAMPAIGN] Step 4: Campaign created with ID:', campaign.id);

        // Generate emails using Claude API (batch all companies in one call)
        let emailMap: Map<string, ClaudeMessage>;
        try {
          console.log('[CAMPAIGN] Step 5: Calling Claude API');
          emailMap = await generateEmailsWithClaude(
            input.targetCompanies,
            input.jobTitle,
            input.language
          );
          console.log('[CAMPAIGN] Step 6: Claude returned', emailMap.size, 'emails');
        } catch (claudeErr: any) {
          console.error('[CAMPAIGN] Claude API call failed:', claudeErr?.message);
          // Delete the campaign since email generation failed
          await ctx.supabase.from('email_campaigns').delete().eq('id', campaign.id);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Claude failed: ${claudeErr?.message || 'Unknown'}`,          });
        }

        // Build recipients array from generated emails
        const recipients = [];
        for (let i = 0; i < input.recipientCount; i++) {
          const company = input.targetCompanies[i % input.targetCompanies.length];
          const email = emailMap.get(company);

          if (email) {
            recipients.push({
              campaign_id: campaign.id,
              full_name: `${company} - ${input.jobTitle}`,
              company,
              email: `contact@${company.toLowerCase().replace(/\s+/g, '-')}.com`,
              job_title: input.jobTitle,
              status: 'pending',
              email_body: `Subject: ${email.subject}\n\n${email.body}`,
            });
          }
        }

        console.log('[CAMPAIGN] Step 7: Generated', recipients.length, 'recipient records');

        // Insert recipients
        if (recipients.length > 0) {
          const { error: insertError } = await ctx.supabase
            .from('email_recipients')
            .insert(recipients);
          if (insertError) {
            console.error('[CAMPAIGN] Failed to insert recipients:', JSON.stringify(insertError));
            await ctx.supabase.from('email_campaigns').delete().eq('id', campaign.id);
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: `Recipients insert failed: ${insertError.message}`,
            });
          }
        }

        console.log('[CAMPAIGN] Step 8: Recipients inserted');

        // Update campaign status to 'ready'
        const { error: updateError } = await ctx.supabase
          .from('email_campaigns')
          .update({ status: 'completed' })
          .eq('id', campaign.id);

        if (updateError) {
          console.error('[CAMPAIGN] Failed to update campaign status:', updateError);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Status update failed: ${updateError.message}`,
          });
        }

        console.log('[CAMPAIGN] Step 9: Status updated to completed');

        // Deduct tokens
        const { error: deductError } = await ctx.supabase
          .from('profiles')
          .update({ token_balance: (profile.token_balance || 0) - tokensNeeded })
          .eq('id', ctx.user.id);

        if (deductError) {
          console.error('[CAMPAIGN] Failed to deduct tokens:', deductError);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Token deduction failed: ${deductError.message}`,
          });
        }

        console.log('[CAMPAIGN] Step 10: Tokens deducted. Campaign complete!');

        return campaign;
      } catch (err: any) {
        if (err instanceof TRPCError) throw err;
        console.error('[CAMPAIGN] Create error:', err);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Campaign error: ${err?.message || err?.code || JSON.stringify(err)?.substring(0, 300) || 'Unknown'}`,
        });
      }
    }),
});