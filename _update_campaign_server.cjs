const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'server', '_core', 'routes', 'campaign.ts');
let content = fs.readFileSync(filePath, 'utf8');
if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);

// Add APIFY_TOKEN constant at the top
content = content.replace(
  "import { TRPCError } from '@trpc/server';",
  "import { TRPCError } from '@trpc/server';\n\nconst APIFY_TOKEN = process.env.APIFY_TOKEN || process.env.APIFY_API_TOKEN || '';"
);

// Add discoverProspects and generateMessages before the create mutation
const newMutations = `
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
          \`https://api.apify.com/v2/acts/harvestapi~linkedin-profile-search/runs?token=\${APIFY_TOKEN}\`,
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
          const pollRes = await fetch(\`https://api.apify.com/v2/actor-runs/\${runId}?token=\${APIFY_TOKEN}\`);
          const pollData = await pollRes.json();
          status = pollData?.data?.status;
          attempts++;
          console.log('[APIFY] Poll', attempts, '- status:', status);
        }

        if (status !== 'SUCCEEDED') {
          throw new Error('Prospect search did not complete: ' + status);
        }

        // Get results
        const itemsRes = await fetch(\`https://api.apify.com/v2/datasets/\${datasetId}/items?token=\${APIFY_TOKEN}\`);
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
        ? 'You are an expert at writing personalized B2B outreach messages for the Saudi market. Write in Modern Standard Arabic. Never start with generic openers. Each message must mention the person\\'s name and company. Keep messages 200-300 characters. End with a call to connect.'
        : 'You are an expert at writing personalized B2B outreach messages. Write professional, concise messages. Each must mention the prospect\\'s name and company. Keep messages 200-300 characters.';

      const userPrompt = input.language === 'ar'
        ? \`Generate personalized outreach messages for each prospect. My role: \${input.jobTitle}.

Prospects:
\${prospectsJson}

Return JSON array:
[{"prospectName":"...","company":"...","subject":"...","body":"..."}]

Rules:
- Each message unique and personalized
- Mention prospect name and company
- Reference Vision 2030 if company is Saudi government/semi-gov
- 200-300 chars per body
- Professional Arabic\`
        : \`Generate personalized outreach messages for each prospect. My role: \${input.jobTitle}.

Prospects:
\${prospectsJson}

Return JSON array:
[{"prospectName":"...","company":"...","subject":"...","body":"..."}]\`;

      try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-6',
            max_tokens: 4096,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
          }),
        });

        if (!response.ok) {
          throw new Error('Claude API error: ' + response.status);
        }

        const result = await response.json() as any;
        const text = result.content?.[0]?.text || '';
        const jsonMatch = text.match(/\\[[\\s\\S]*\\]/);
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
            \`To: \${msg.email}\`,
            \`Subject: =?UTF-8?B?\${Buffer.from(msg.subject).toString('base64')}?=\`,
            '',
            msg.body,
          ].join('\\r\\n');

          const encodedMessage = Buffer.from(emailContent).toString('base64')
            .replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '');

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

`;

// Insert before the 'create' mutation
content = content.replace(
  '  create: protectedProcedure',
  newMutations + '  create: protectedProcedure'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Updated campaign.ts with discoverProspects, generateMessages, and send mutations');
