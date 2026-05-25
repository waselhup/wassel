// WhatsApp Business Cloud API v20.0 (Meta) — real send + webhook verify.
// Env-gated. Missing creds → "would send" no-op, never crashes.

import crypto from 'crypto';

const GRAPH_VERSION = 'v20.0';
const PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || '';
const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || '';
const APP_SECRET = process.env.WHATSAPP_APP_SECRET || '';

export function isWhatsAppConfigured(): boolean {
  return !!(PHONE_ID && ACCESS_TOKEN);
}

interface SendTextOpts {
  toPhone: string;
  body: string;
}

interface SendTemplateOpts {
  toPhone: string;
  templateName: string;
  languageCode: string; // 'ar' | 'en_US'
  components?: any[];
}

interface SendButtonsOpts {
  toPhone: string;
  bodyText: string;
  buttons: Array<{ id: string; title: string }>; // max 3
}

export interface SendResult {
  ok: boolean;
  whatsappMessageId?: string;
  error?: string;
  stub?: boolean; // true if env missing
}

async function graphPost(body: any): Promise<SendResult> {
  if (!isWhatsAppConfigured()) {
    console.log('[whatsapp] STUB (no creds):', JSON.stringify(body).slice(0, 200));
    return { ok: true, stub: true };
  }
  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${PHONE_ID}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: json?.error?.message || `HTTP ${res.status}` };
    }
    const id = json?.messages?.[0]?.id;
    return { ok: true, whatsappMessageId: id };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

export async function sendText(opts: SendTextOpts): Promise<SendResult> {
  return graphPost({
    messaging_product: 'whatsapp',
    to: opts.toPhone,
    type: 'text',
    text: { body: opts.body, preview_url: false },
  });
}

export async function sendTemplate(opts: SendTemplateOpts): Promise<SendResult> {
  return graphPost({
    messaging_product: 'whatsapp',
    to: opts.toPhone,
    type: 'template',
    template: {
      name: opts.templateName,
      language: { code: opts.languageCode },
      components: opts.components || [],
    },
  });
}

export async function sendButtons(opts: SendButtonsOpts): Promise<SendResult> {
  return graphPost({
    messaging_product: 'whatsapp',
    to: opts.toPhone,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: opts.bodyText },
      action: {
        buttons: opts.buttons.slice(0, 3).map(b => ({
          type: 'reply',
          reply: { id: b.id, title: b.title.slice(0, 20) },
        })),
      },
    },
  });
}

/** Meta webhook verification (GET handshake). */
export function verifyWebhookChallenge(mode: string | null, token: string | null, challenge: string | null): string | null {
  if (!VERIFY_TOKEN) return null;
  if (mode === 'subscribe' && token === VERIFY_TOKEN && challenge) {
    return challenge;
  }
  return null;
}

/** HMAC-SHA256 webhook signature verify. */
export function verifyWebhookSignature(rawBody: string, signatureHeader: string | null | undefined): boolean {
  if (!APP_SECRET) return true; // dev mode — allow
  if (!signatureHeader) return false;
  const sig = signatureHeader.startsWith('sha256=') ? signatureHeader.slice(7) : signatureHeader;
  const expected = crypto.createHmac('sha256', APP_SECRET).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

export interface InboundMessage {
  fromPhone: string;
  whatsappMessageId: string;
  type: string;
  body: string;
  timestamp: string;
  raw: any;
}

/** Parse Meta webhook payload → flat array of inbound messages. */
export function parseInboundWebhook(payload: any): InboundMessage[] {
  const out: InboundMessage[] = [];
  try {
    const entries = payload?.entry || [];
    for (const entry of entries) {
      const changes = entry?.changes || [];
      for (const change of changes) {
        const messages = change?.value?.messages || [];
        for (const m of messages) {
          const text = m?.text?.body
            || m?.button?.text
            || m?.interactive?.button_reply?.title
            || m?.interactive?.list_reply?.title
            || '';
          out.push({
            fromPhone: m.from,
            whatsappMessageId: m.id,
            type: m.type,
            body: text,
            timestamp: m.timestamp,
            raw: m,
          });
        }
      }
    }
  } catch (e) {
    console.warn('[whatsapp] parseInboundWebhook failed:', e);
  }
  return out;
}

// Legacy export for backward compat with batch-1 stub callers.
export interface WhatsAppMessage {
  to: string;
  body: string;
  templateName?: string;
}

export async function sendWhatsApp(msg: WhatsAppMessage): Promise<{ messageId: string; status: 'queued' | 'sent' | 'failed' }> {
  const r = await sendText({ toPhone: msg.to, body: msg.body });
  if (r.ok) return { messageId: r.whatsappMessageId || `wa_${Date.now()}`, status: r.stub ? 'queued' : 'sent' };
  return { messageId: `wa_${Date.now()}`, status: 'failed' };
}
