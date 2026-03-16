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
};

const tones: Record<string, string> = {
  professional: 'Professional, polished tone.',
  friendly: 'Warm, conversational, human tone.',
  direct: 'Direct and concise. Get to the point fast.',
  arabic: 'Write entirely in Arabic. Professional tone.',
};

/**
 * POST /api/ai/generate-message
 * Generates outreach message using Claude AI.
 * Body: { stepType, goal, tone }
 */
router.post('/generate-message', async (req: Request, res: Response) => {
  try {
    const { stepType, goal, tone } = req.body;

    if (!stepType || !goal) {
      return res.status(400).json({ error: 'stepType and goal are required' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'AI service not configured' });
    }

    const systemPrompt = systemPrompts[stepType] || systemPrompts.message;
    const toneDesc = tones[tone] || tones.professional;

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
        max_tokens: 200,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: `Goal: ${goal}\nTone: ${toneDesc}\nWrite the message:`,
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
    const maxChars = stepType === 'invite' ? 300 : 500;

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
