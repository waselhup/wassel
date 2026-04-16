import { Request, Response } from 'express';

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';

async function sendTelegram(chatId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  });
}

async function askOZAIL(message: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      system: `You are OZAIL, the AI CEO of Wassel (وصل) — Arabic-first LinkedIn outreach SaaS for Saudi Arabia.
Platform: https://wassel-alpha.vercel.app
Pricing: Free 100 tokens | Starter 99 SAR | Pro 249 SAR | Agency 599 SAR
Respond in Arabic. Be concise for Telegram (max 400 chars). Be decisive and strategic.`,
      messages: [{ role: 'user', content: message }],
    }),
  });
  const data = await res.json();
  return data.content?.[0]?.text || 'خطأ في الاتصال';
}

export async function telegramHandler(req: Request, res: Response) {
  res.status(200).json({ ok: true });
  
  try {
    const update = req.body;
    const message = update.message;
    if (!message) return;

    const chatId: number = message.chat.id;
    const text: string = message.text || '';

    if (text === '/start') {
      await sendTelegram(chatId, `🤖 *مرحباً في OZAIL*\nوكيل الذكاء الاصطناعي لـ وصّل\n\n/report - تقرير يومي\n/help - المساعدة\n\nأو أرسل أي سؤال مباشرة 🚀`);
    } else if (text === '/report') {
      await sendTelegram(chatId, '⏳ جاري إعداد التقرير...');
      const report = await askOZAIL('أعطني تقرير يومي مختصر لوصل: المستخدمون، الحملات، الأولويات. اجعله مناسباً للتيليجرام.');
      await sendTelegram(chatId, report);
    } else if (text === '/help') {
      await sendTelegram(chatId, `📋 *الأوامر:*\n/report - تقرير يومي\n/start - البداية\n/help - مساعدة\n\nأو اكتب أي سؤال لـ OZAIL مباشرة`);
    } else {
      await sendTelegram(chatId, '⏳ OZAIL يفكر...');
      const reply = await askOZAIL(text);
      await sendTelegram(chatId, reply);
    }
  } catch (err) {
    console.error('Telegram error:', err);
  }
}
