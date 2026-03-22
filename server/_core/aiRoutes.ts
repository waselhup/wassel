import { Router, Request, Response } from 'express';

const router = Router();

// System prompts for each step type
const systemPrompts: Record<string, string> = {
  invite: `You are an expert LinkedIn copywriter.
Write a connection request note.
MAX 300 characters. Use {{firstName}} {{company}}.
Sound human. No buzzwords. No "hope this finds you well".
End with a soft question or reason to connect.
Return ONLY the message text, nothing else.`,

  message: `You are an expert LinkedIn copywriter.
Write a first message after connecting.
MAX 500 characters.
Use {{firstName}} {{company}} {{jobTitle}}.
Reference their role naturally.
One value proposition. One soft call-to-action.
Sound like a real person.
Return ONLY the message text, nothing else.`,

  follow_up: `You are an expert LinkedIn copywriter.
Write a follow-up message — no reply was received to the first message.
MAX 500 characters. Use {{firstName}}.
Use a different angle. Add value or an insight.
Short and punchy.
NOT "just following up" or "circling back".
Return ONLY the message text, nothing else.`,

  post: `You are an expert LinkedIn content writer.
Write a LinkedIn post.
MAX 3000 characters.
Make it engaging and authentic.
Use short paragraphs and line breaks.
End with a call-to-action or thought-provoking question.
Return ONLY the post text, nothing else.`,
};

const tones: Record<string, string> = {
  professional: 'Professional, polished tone.',
  friendly: 'Warm, conversational, human tone.',
  direct: 'Direct and concise. Get to the point fast.',
  casual: 'Casual, relaxed, conversational.',
  arabic: 'Write entirely in Arabic. Professional tone.',
};

const purposes: Record<string, string> = {
  sales: 'Selling a product or service. Focus on value proposition.',
  job_search: 'Looking for a job opportunity. Show enthusiasm and relevance.',
  recruiting: 'Recruiting talent. Highlight the opportunity.',
  hiring: 'Hiring for a specific role. Attract top candidates.',
  networking: 'Building professional connections. Be genuine.',
  partnership: 'Exploring business partnership. Highlight mutual benefits.',
};

/**
 * POST /api/ai/generate-message
 * Generates outreach message using Claude AI.
 * Body: { stepType, goal, tone, purpose?, senderContext?, specificGoal?,
 *         prospectName?, prospectTitle?, prospectCompany?, language?, postType? }
 */
router.post('/generate-message', async (req: Request, res: Response) => {
  try {
    const {
      // Old field names (CampaignWizard sends these)
      stepType, goal,
      // New field names (AISurveyModal sends these)
      purpose, senderContext, specificGoal,
      // Shared fields
      tone,
      prospectName, prospectTitle, prospectCompany,
      language, postType, messageType,
    } = req.body;

    // Resolve field names flexibly — accept both patterns
    const resolvedStepType = stepType || messageType || (postType ? 'post' : null) || purpose || 'message';
    const resolvedGoal = specificGoal || goal || '';
    const resolvedPurpose = purpose || stepType || 'networking';
    const resolvedTone = tone || 'professional';

    console.log('[AI] Request:', { resolvedStepType, resolvedPurpose, resolvedTone, resolvedGoal });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: 'AI service not configured — set ANTHROPIC_API_KEY in Vercel' });
    }

    // Build enhanced system prompt with survey context
    let systemPrompt = systemPrompts[resolvedStepType] || systemPrompts.message;
    const toneDesc = tones[resolvedTone] || tones.professional;
    const purposeDesc = resolvedPurpose ? (purposes[resolvedPurpose] || '') : '';

    // Add survey context to system prompt if provided
    const contextLines: string[] = [];
    if (resolvedPurpose) contextLines.push(`Message purpose: ${resolvedPurpose} — ${purposeDesc}`);
    if (senderContext) contextLines.push(`Sender context: ${senderContext}`);
    if (resolvedGoal) contextLines.push(`Specific goal: ${resolvedGoal}`);
    if (prospectName) contextLines.push(`Prospect name: ${prospectName}`);
    if (prospectTitle) contextLines.push(`Prospect title: ${prospectTitle}`);
    if (prospectCompany) contextLines.push(`Prospect company: ${prospectCompany}`);
    if (postType) contextLines.push(`Post type: ${postType}`);
    if (language === 'ar') contextLines.push('Write the message entirely in Arabic.');

    if (contextLines.length > 0) {
      systemPrompt += '\n\nAdditional context:\n' + contextLines.join('\n');
    }

    systemPrompt += `\nTone: ${toneDesc}`;
    systemPrompt += '\n\nRules:\n- Sound human and genuine, not templated\n- Do not use generic phrases like "I came across your profile"\n- Match the tone specified';

    if (prospectName) {
      systemPrompt += `\n- Start with the prospect's first name (${prospectName.split(' ')[0]})`;
    }

    // Build user message
    const userMessage = resolvedGoal
      ? `Goal: ${resolvedGoal}\nTone: ${toneDesc}\nWrite the message:`
      : `Purpose: ${purposeDesc || 'general outreach'}\nTone: ${toneDesc}\nWrite the message:`;

    // Call Anthropic API directly via fetch (avoid SDK dependency issues)
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: resolvedStepType === 'post' ? 800 : 200,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: userMessage,
        }],
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      console.error('[AI] Anthropic error:', response.status, errData);
      return res.status(500).json({ error: 'AI generation failed' });
    }

    const data = await response.json();
    const generated = (data.content?.[0]?.text || '').trim();
    const maxChars = resolvedStepType === 'invite' ? 300 : resolvedStepType === 'post' ? 3000 : 500;

    res.json({
      message: generated.substring(0, maxChars),
      charCount: Math.min(generated.length, maxChars),
    });
  } catch (e: any) {
    console.error('[AI] Error:', e);
    res.status(500).json({ error: e.message || 'AI generation failed' });
  }
});

export default router;
