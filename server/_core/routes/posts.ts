import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { logApiCall, mapAnthropicStatusToArabic } from '../lib/apiLogger';

const router = Router();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://hiqotmimlgsrsnovtopd.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';

// Helper: get user from Authorization header
async function getUserFromToken(authHeader: string | undefined) {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.replace('Bearer ', '');
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

// Helper: get per-user supabase client (respects RLS)
function getUserSupabase(token: string) {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

// POST /api/posts/generate — AI LinkedIn post generation
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { topic, tone = 'professional', language = 'ar', includeHashtags = true } = req.body;

    if (!topic || typeof topic !== 'string') {
      return res.status(400).json({ error: 'topic is required' });
    }

    if (!ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
    }

    // Deduct 3 tokens
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('token_balance')
      .eq('id', user.id)
      .single();

    if (profileErr || !profile) {
      return res.status(400).json({ error: 'Profile not found' });
    }

    if ((profile.token_balance || 0) < 3) {
      return res.status(402).json({ error: 'Insufficient tokens. Need 3 tokens to generate a post.' });
    }

    const systemPrompt = language === 'ar'
      ? `You write LinkedIn posts for the Saudi Arabia and GCC market.
Use professional Modern Standard Arabic (فصحى). Never use Gulf dialect.
Start with a strong hook — a surprising stat, bold statement, or provocative question.
Short paragraphs (max 2 lines each). Use line breaks generously.
End with a question or CTA that invites engagement.
Max 1300 characters total (including hashtags).
${includeHashtags ? 'Add max 5 relevant Arabic hashtags at the end.' : 'No hashtags.'}
Avoid generic openers like "أتمنى أن تكون بخير".
Return JSON: { "content": "...", "hashtags": [...] }`
      : `You write LinkedIn posts for the Saudi Arabia and GCC market.
Use professional English.
Start with a strong hook — a surprising stat, bold statement, or provocative question.
Short paragraphs (max 2 lines each).
End with a question or CTA.
Max 1300 characters total.
${includeHashtags ? 'Add max 5 relevant hashtags at the end.' : 'No hashtags.'}
Return JSON: { "content": "...", "hashtags": [...] }`;

    const toneInstructions: Record<string, string> = {
      professional: language === 'ar' ? 'Tone: رسمي واحترافي' : 'Tone: professional and polished',
      inspirational: language === 'ar' ? 'Tone: ملهم وتحفيزي' : 'Tone: inspirational and motivating',
      educational: language === 'ar' ? 'Tone: تعليمي وتثقيفي' : 'Tone: educational and informative',
      storytelling: language === 'ar' ? 'Tone: سردي وقصصي' : 'Tone: storytelling and narrative',
      analytical: language === 'ar' ? 'Tone: تحليلي وبيانات' : 'Tone: analytical and data-driven',
    };

    const userPrompt = `${toneInstructions[tone] || toneInstructions.professional}

Topic: ${topic}

Generate the LinkedIn post now. Return valid JSON only.`;

    console.log('[POSTS] Generating post for user:', user.id, '| topic:', topic, '| lang:', language);

    const _postsT0 = Date.now();
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!claudeRes.ok) {
      const errText = await claudeRes.text();
      console.error('[POSTS] Claude error:', claudeRes.status, errText);
      await logApiCall({ service: 'anthropic', endpoint: '/v1/messages:posts', statusCode: claudeRes.status, responseTimeMs: Date.now() - _postsT0, errorMsg: errText, userId: user.id });
      const statusOut = claudeRes.status === 429 ? 429 : 500;
      return res.status(statusOut).json({ error: mapAnthropicStatusToArabic(claudeRes.status) });
    }
    await logApiCall({ service: 'anthropic', endpoint: '/v1/messages:posts', statusCode: 200, responseTimeMs: Date.now() - _postsT0, userId: user.id });

    const claudeData = await claudeRes.json() as any;
    const rawText: string = claudeData?.content?.[0]?.text || '';

    let content = '';
    let hashtags: string[] = [];

    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        content = parsed.content || '';
        hashtags = Array.isArray(parsed.hashtags) ? parsed.hashtags : [];
      } else {
        content = rawText;
      }
    } catch {
      content = rawText;
    }

    // Deduct 3 tokens
    await supabaseAdmin
      .from('profiles')
      .update({ token_balance: (profile.token_balance || 0) - 3 })
      .eq('id', user.id);

    console.log('[POSTS] Generated successfully. Tokens deducted. Remaining:', (profile.token_balance || 0) - 3);

    return res.json({ content, hashtags });
  } catch (err: any) {
    console.error('[POSTS] Generate error:', err?.message);
    return res.status(500).json({ error: err?.message || 'Internal server error' });
  }
});

// GET /api/posts — list user posts
router.get('/', async (req: Request, res: Response) => {
  try {
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const token = req.headers.authorization!.replace('Bearer ', '');
    const supabase = getUserSupabase(token);

    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[POSTS] List error:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.json(data || []);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Internal server error' });
  }
});

// POST /api/posts — save a post
router.post('/', async (req: Request, res: Response) => {
  try {
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { content, ai_generated, ai_prompt, tone, language, hashtags, scheduled_for, status } = req.body;

    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'content is required' });
    }

    const token = req.headers.authorization!.replace('Bearer ', '');
    const supabase = getUserSupabase(token);

    const { data, error } = await supabase
      .from('posts')
      .insert([{
        user_id: user.id,
        content,
        ai_generated: ai_generated ?? false,
        ai_prompt: ai_prompt ?? null,
        tone: tone ?? 'professional',
        language: language ?? 'ar',
        hashtags: hashtags ?? [],
        scheduled_for: scheduled_for ?? null,
        status: status ?? 'draft',
      }])
      .select()
      .single();

    if (error) {
      console.error('[POSTS] Create error:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(201).json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Internal server error' });
  }
});

// PATCH /api/posts/:id — update a post
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;
    const updates = req.body;

    // Remove fields that shouldn't be updated directly
    delete updates.id;
    delete updates.user_id;
    delete updates.created_at;
    updates.updated_at = new Date().toISOString();

    const token = req.headers.authorization!.replace('Bearer ', '');
    const supabase = getUserSupabase(token);

    const { data, error } = await supabase
      .from('posts')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('[POSTS] Update error:', error);
      return res.status(500).json({ error: error.message });
    }

    if (!data) return res.status(404).json({ error: 'Post not found' });

    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Internal server error' });
  }
});

// DELETE /api/posts/:id — delete a post
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;
    const token = req.headers.authorization!.replace('Bearer ', '');
    const supabase = getUserSupabase(token);

    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('[POSTS] Delete error:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Internal server error' });
  }
});

export { router as postsRouter };