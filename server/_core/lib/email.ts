import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const FROM_DEFAULT = process.env.EMAIL_FROM || 'Wassel <onboarding@resend.dev>';
const APP_URL = 'https://wasselhub.com';

let _resend: Resend | null = null;
function client(): Resend | null {
  if (!RESEND_API_KEY) return null;
  if (!_resend) _resend = new Resend(RESEND_API_KEY);
  return _resend;
}

export interface EmailRecipient {
  email: string;
  fullName?: string | null;
  language?: string | null;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  skipped?: boolean;
  reason?: string;
}

interface RawSend {
  to: string;
  subject: string;
  html: string;
  text: string;
}

async function sendRaw({ to, subject, html, text }: RawSend): Promise<SendResult> {
  const resend = client();
  if (!resend) {
    console.warn('[email] RESEND_API_KEY missing — skipping send to', to);
    return { success: false, skipped: true, reason: 'no_resend_key' };
  }
  try {
    const result = await resend.emails.send({
      from: FROM_DEFAULT,
      to,
      subject,
      html,
      text,
    });
    if ((result as any)?.error) {
      const err = (result as any).error;
      console.error('[email] Resend API error:', err);
      return { success: false, error: err?.message || JSON.stringify(err) };
    }
    const messageId = (result as any)?.data?.id || (result as any)?.id;
    console.log('[email] sent OK to', to, 'id:', messageId);
    return { success: true, messageId };
  } catch (e: any) {
    console.error('[email] send failed:', e?.message || e);
    return { success: false, error: e?.message || String(e) };
  }
}

function shell(opts: {
  isAr: boolean;
  preheader: string;
  bodyInner: string;
}) {
  const dir = opts.isAr ? 'rtl' : 'ltr';
  const lang = opts.isAr ? 'ar' : 'en';
  const footerText = opts.isAr
    ? '© 2026 وصّل · منصة سعودية الصنع'
    : '© 2026 Wassel · Made in Saudi Arabia';
  return `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Wassel</title>
</head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:Cairo,'Helvetica Neue',Arial,sans-serif;color:#111827;">
<div style="display:none;max-height:0;overflow:hidden;color:#F9FAFB;">${opts.preheader}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F9FAFB;padding:32px 12px;">
  <tr><td align="center">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.06);">
      <tr><td style="padding:24px 28px;background:linear-gradient(135deg,#0A8F84,#0EA5E9);color:#ffffff;">
        <div style="font-size:22px;font-weight:900;letter-spacing:-0.3px;">${opts.isAr ? 'وصّل' : 'Wassel'}</div>
        <div style="font-size:12px;opacity:0.85;margin-top:2px;">${opts.isAr ? 'منصتك الذكية للتسويق عبر LinkedIn' : 'Your smart LinkedIn marketing platform'}</div>
      </td></tr>
      <tr><td style="padding:28px;">${opts.bodyInner}</td></tr>
      <tr><td style="padding:18px 28px;background:#F3F4F6;color:#6B7280;font-size:11px;text-align:center;">
        ${footerText}<br/>
        <a href="${APP_URL}" style="color:#0A8F84;text-decoration:none;">${APP_URL.replace('https://','')}</a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function btn(href: string, label: string) {
  return `<a href="${href}" style="display:inline-block;padding:12px 24px;background:#0A8F84;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:800;font-size:14px;">${label}</a>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function sendWelcomeEmail(user: EmailRecipient): Promise<SendResult> {
  const isAr = (user.language || 'ar') === 'ar';
  const name = user.fullName?.trim() || (isAr ? 'مستخدم وصّل' : 'Wassel member');
  const subject = isAr
    ? 'مرحباً بك في وصّل — 1000 توكن مجاناً'
    : 'Welcome to Wassel — 1,000 free tokens';

  const inner = isAr
    ? `
      <h1 style="font-size:22px;font-weight:900;color:#111827;margin:0 0 12px;">أهلاً ${escapeHtml(name)} 👋</h1>
      <p style="font-size:14px;line-height:1.7;color:#374151;margin:0 0 14px;">شكراً لانضمامك إلى <strong>وصّل</strong> — منصتك الذكية للتسويق عبر LinkedIn في السوق السعودي والخليجي.</p>
      <div style="background:linear-gradient(135deg,rgba(10,143,132,0.08),rgba(14,165,233,0.08));border-radius:12px;padding:16px 18px;margin:14px 0;">
        <div style="font-weight:800;color:#0A8F84;font-size:15px;">رصيدك: 1,000 توكن مجاني</div>
        <div style="font-size:12px;color:#6B7280;margin-top:4px;">كافي لـ 30+ تحليل بروفايل و 100+ منشور</div>
      </div>
      <h3 style="font-size:14px;font-weight:900;margin:20px 0 8px;">ابدأ بإحدى هذه الأدوات:</h3>
      <ul style="margin:0 0 18px;padding-inline-start:20px;font-size:13px;line-height:1.9;color:#374151;">
        <li><a href="${APP_URL}/app/profile-analysis" style="color:#0A8F84;text-decoration:none;font-weight:700;">حلّل بروفايلك على LinkedIn</a></li>
        <li><a href="${APP_URL}/app/cv" style="color:#0A8F84;text-decoration:none;font-weight:700;">أنشئ سيرة ذاتية مخصصة</a></li>
        <li><a href="${APP_URL}/app/posts" style="color:#0A8F84;text-decoration:none;font-weight:700;">اكتب منشور احترافي</a></li>
      </ul>
      <p style="text-align:center;margin:24px 0 8px;">${btn(`${APP_URL}/app`, 'ادخل لوحتك الآن')}</p>
      <p style="font-size:12px;color:#9CA3AF;text-align:center;margin-top:14px;">إن احتجت أي مساعدة، رد على هذا البريد.</p>
    `
    : `
      <h1 style="font-size:22px;font-weight:900;color:#111827;margin:0 0 12px;">Welcome, ${escapeHtml(name)} 👋</h1>
      <p style="font-size:14px;line-height:1.7;color:#374151;margin:0 0 14px;">Thanks for joining <strong>Wassel</strong> — your smart LinkedIn marketing platform for the Saudi/GCC market.</p>
      <div style="background:linear-gradient(135deg,rgba(10,143,132,0.08),rgba(14,165,233,0.08));border-radius:12px;padding:16px 18px;margin:14px 0;">
        <div style="font-weight:800;color:#0A8F84;font-size:15px;">Your balance: 1,000 free tokens</div>
        <div style="font-size:12px;color:#6B7280;margin-top:4px;">Enough for 30+ profile analyses and 100+ posts</div>
      </div>
      <h3 style="font-size:14px;font-weight:900;margin:20px 0 8px;">Start with one of these tools:</h3>
      <ul style="margin:0 0 18px;padding-inline-start:20px;font-size:13px;line-height:1.9;color:#374151;">
        <li><a href="${APP_URL}/app/profile-analysis" style="color:#0A8F84;text-decoration:none;font-weight:700;">Analyze your LinkedIn profile</a></li>
        <li><a href="${APP_URL}/app/cv" style="color:#0A8F84;text-decoration:none;font-weight:700;">Create a tailored CV</a></li>
        <li><a href="${APP_URL}/app/posts" style="color:#0A8F84;text-decoration:none;font-weight:700;">Write a professional post</a></li>
      </ul>
      <p style="text-align:center;margin:24px 0 8px;">${btn(`${APP_URL}/app`, 'Open your dashboard')}</p>
      <p style="font-size:12px;color:#9CA3AF;text-align:center;margin-top:14px;">Need help? Just reply to this email.</p>
    `;

  const text = isAr
    ? `أهلاً ${name}\n\nشكراً لانضمامك إلى وصّل. حصلت على 1000 توكن مجاناً.\n\nادخل لوحتك: ${APP_URL}/app\n\nمحتاج مساعدة؟ رد على هذا البريد.\n\n— فريق وصّل`
    : `Welcome, ${name}\n\nThanks for joining Wassel. You have 1,000 free tokens.\n\nOpen your dashboard: ${APP_URL}/app\n\nNeed help? Just reply.\n\n— The Wassel Team`;

  return sendRaw({
    to: user.email,
    subject,
    html: shell({ isAr, preheader: isAr ? 'لديك 1000 توكن مجاني للبدء' : 'You have 1,000 free tokens', bodyInner: inner }),
    text,
  });
}

export async function sendTicketResponseEmail(opts: {
  user: EmailRecipient;
  ticketSubject: string;
  ticketId: string;
  responseText: string;
}): Promise<SendResult> {
  const isAr = (opts.user.language || 'ar') === 'ar';
  const subject = isAr
    ? `رد على ملاحظتك: ${opts.ticketSubject}`
    : `Response to your feedback: ${opts.ticketSubject}`;
  const name = opts.user.fullName?.trim() || (isAr ? 'مستخدم وصّل' : 'Wassel member');

  const inner = isAr
    ? `
      <h1 style="font-size:20px;font-weight:900;color:#111827;margin:0 0 10px;">رد على ملاحظتك</h1>
      <p style="font-size:14px;line-height:1.7;color:#374151;margin:0 0 14px;">أهلاً ${escapeHtml(name)}، فريق وصّل رد على ملاحظتك:</p>
      <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:12px;padding:14px 18px;margin:14px 0;">
        <div style="font-size:11px;font-weight:800;color:#6B7280;margin-bottom:6px;">الموضوع</div>
        <div style="font-size:14px;font-weight:700;color:#111827;">${escapeHtml(opts.ticketSubject)}</div>
      </div>
      <div style="background:#ECFDF5;border-inline-start:4px solid #0A8F84;border-radius:10px;padding:14px 18px;margin:14px 0;">
        <div style="font-size:11px;font-weight:800;color:#0A8F84;margin-bottom:6px;">رد الفريق</div>
        <div style="font-size:14px;line-height:1.7;color:#065F46;white-space:pre-wrap;">${escapeHtml(opts.responseText)}</div>
      </div>
      <p style="text-align:center;margin:20px 0;">${btn(`${APP_URL}/app/tickets`, 'عرض المحادثة الكاملة')}</p>
    `
    : `
      <h1 style="font-size:20px;font-weight:900;color:#111827;margin:0 0 10px;">We've responded to your feedback</h1>
      <p style="font-size:14px;line-height:1.7;color:#374151;margin:0 0 14px;">Hi ${escapeHtml(name)}, the Wassel team responded to your ticket:</p>
      <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:12px;padding:14px 18px;margin:14px 0;">
        <div style="font-size:11px;font-weight:800;color:#6B7280;margin-bottom:6px;">Subject</div>
        <div style="font-size:14px;font-weight:700;color:#111827;">${escapeHtml(opts.ticketSubject)}</div>
      </div>
      <div style="background:#ECFDF5;border-inline-start:4px solid #0A8F84;border-radius:10px;padding:14px 18px;margin:14px 0;">
        <div style="font-size:11px;font-weight:800;color:#0A8F84;margin-bottom:6px;">Team response</div>
        <div style="font-size:14px;line-height:1.7;color:#065F46;white-space:pre-wrap;">${escapeHtml(opts.responseText)}</div>
      </div>
      <p style="text-align:center;margin:20px 0;">${btn(`${APP_URL}/app/tickets`, 'View full conversation')}</p>
    `;

  const text = isAr
    ? `أهلاً ${name}\n\nرد فريق وصّل على ملاحظتك:\n\nالموضوع: ${opts.ticketSubject}\n\n${opts.responseText}\n\nعرض المحادثة: ${APP_URL}/app/tickets`
    : `Hi ${name}\n\nWassel team responded to your ticket:\n\nSubject: ${opts.ticketSubject}\n\n${opts.responseText}\n\nView conversation: ${APP_URL}/app/tickets`;

  return sendRaw({
    to: opts.user.email,
    subject,
    html: shell({ isAr, preheader: isAr ? 'فريق وصّل رد على ملاحظتك' : 'Wassel team responded', bodyInner: inner }),
    text,
  });
}

export async function sendTokenGrantEmail(opts: {
  user: EmailRecipient;
  amount: number;
  reason: string;
  newBalance: number;
}): Promise<SendResult> {
  const isAr = (opts.user.language || 'ar') === 'ar';
  const subject = isAr
    ? `حصلت على ${opts.amount} توكن من وصّل`
    : `You received ${opts.amount} tokens from Wassel`;
  const name = opts.user.fullName?.trim() || (isAr ? 'مستخدم وصّل' : 'Wassel member');

  const inner = isAr
    ? `
      <h1 style="font-size:22px;font-weight:900;color:#111827;margin:0 0 12px;">🎉 توكنز جديدة في رصيدك</h1>
      <p style="font-size:14px;line-height:1.7;color:#374151;margin:0 0 14px;">أهلاً ${escapeHtml(name)}، أضافت إدارة وصّل توكنز إلى رصيدك:</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:linear-gradient(135deg,#0A8F84,#0EA5E9);border-radius:14px;margin:16px 0;color:#ffffff;">
        <tr><td style="padding:20px 24px;text-align:center;">
          <div style="font-size:36px;font-weight:900;letter-spacing:-1px;">+${opts.amount.toLocaleString('en-US')}</div>
          <div style="font-size:12px;opacity:0.85;margin-top:4px;">توكن مضاف</div>
        </td></tr>
      </table>
      <div style="background:#F9FAFB;border-radius:10px;padding:14px 18px;margin:14px 0;">
        <div style="font-size:11px;font-weight:800;color:#6B7280;margin-bottom:6px;">السبب</div>
        <div style="font-size:14px;color:#111827;">${escapeHtml(opts.reason)}</div>
      </div>
      <div style="text-align:center;font-size:13px;color:#374151;margin:14px 0;">رصيدك الحالي: <strong style="color:#0A8F84;">${opts.newBalance.toLocaleString('en-US')} توكن</strong></div>
      <p style="text-align:center;margin:20px 0;">${btn(`${APP_URL}/app`, 'استخدم التوكنز الآن')}</p>
    `
    : `
      <h1 style="font-size:22px;font-weight:900;color:#111827;margin:0 0 12px;">🎉 New tokens in your account</h1>
      <p style="font-size:14px;line-height:1.7;color:#374151;margin:0 0 14px;">Hi ${escapeHtml(name)}, the Wassel admin added tokens to your balance:</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:linear-gradient(135deg,#0A8F84,#0EA5E9);border-radius:14px;margin:16px 0;color:#ffffff;">
        <tr><td style="padding:20px 24px;text-align:center;">
          <div style="font-size:36px;font-weight:900;letter-spacing:-1px;">+${opts.amount.toLocaleString('en-US')}</div>
          <div style="font-size:12px;opacity:0.85;margin-top:4px;">tokens added</div>
        </td></tr>
      </table>
      <div style="background:#F9FAFB;border-radius:10px;padding:14px 18px;margin:14px 0;">
        <div style="font-size:11px;font-weight:800;color:#6B7280;margin-bottom:6px;">Reason</div>
        <div style="font-size:14px;color:#111827;">${escapeHtml(opts.reason)}</div>
      </div>
      <div style="text-align:center;font-size:13px;color:#374151;margin:14px 0;">Your new balance: <strong style="color:#0A8F84;">${opts.newBalance.toLocaleString('en-US')} tokens</strong></div>
      <p style="text-align:center;margin:20px 0;">${btn(`${APP_URL}/app`, 'Use your tokens now')}</p>
    `;

  const text = isAr
    ? `أهلاً ${name}\n\nأضافت إدارة وصّل ${opts.amount} توكن إلى رصيدك.\nالسبب: ${opts.reason}\nرصيدك الحالي: ${opts.newBalance} توكن\n\nاستخدم التوكنز: ${APP_URL}/app`
    : `Hi ${name}\n\nWassel admin added ${opts.amount} tokens to your balance.\nReason: ${opts.reason}\nNew balance: ${opts.newBalance} tokens\n\nUse them: ${APP_URL}/app`;

  return sendRaw({
    to: opts.user.email,
    subject,
    html: shell({ isAr, preheader: isAr ? `+${opts.amount} توكن في رصيدك` : `+${opts.amount} tokens added`, bodyInner: inner }),
    text,
  });
}

/**
 * Test the email pipeline. Used by /api/email/test admin endpoint.
 */
export async function sendTestEmail(to: string): Promise<SendResult> {
  const inner = `
    <h1 style="font-size:20px;font-weight:900;color:#111827;margin:0 0 10px;">Email pipeline test ✅</h1>
    <p style="font-size:14px;line-height:1.7;color:#374151;margin:0 0 14px;">If you received this email, Resend is wired correctly and Wassel can send transactional emails.</p>
    <div style="background:#F9FAFB;border-radius:10px;padding:14px 18px;font-size:12px;color:#6B7280;font-family:monospace;">
      <div>RESEND_API_KEY: present</div>
      <div>FROM: ${escapeHtml(FROM_DEFAULT)}</div>
      <div>Sent at: ${new Date().toISOString()}</div>
    </div>
  `;
  return sendRaw({
    to,
    subject: 'Wassel email test — pipeline working',
    html: shell({ isAr: false, preheader: 'Email pipeline test', bodyInner: inner }),
    text: `Wassel email test\n\nIf you received this, Resend is wired correctly.\n\nSent at: ${new Date().toISOString()}`,
  });
}

/**
 * Send an outbound B2B campaign email. Respects dry-run mode.
 * In dry-run mode, does NOT hit Resend — just returns success with a fake id so the
 * upstream pipeline can log correctly and exercise all its code paths.
 */
export async function sendCampaignEmail(opts: {
  to: string;
  subject: string;
  body: string;
  unsubscribeToken: string;
  dryRun?: boolean;
}): Promise<SendResult> {
  const unsubUrl = `${APP_URL}/unsubscribe?t=${opts.unsubscribeToken}`;
  const unsubFooter = `\n\n---\nTo stop receiving emails like this, visit: ${unsubUrl}`;
  const htmlBody = `
    <div style="font-family:Cairo,'Helvetica Neue',Arial,sans-serif;font-size:14px;line-height:1.7;color:#111827;white-space:pre-wrap;">${escapeHtml(opts.body)}</div>
    <hr style="margin:24px 0;border:none;border-top:1px solid #E5E7EB;" />
    <p style="font-size:11px;color:#9CA3AF;">
      You received this because your company address is in our public B2B directory.
      <a href="${unsubUrl}" style="color:#0A8F84;">Unsubscribe</a>.
    </p>
  `;

  if (opts.dryRun) {
    console.log('[email][DRY-RUN] would send to', opts.to, '| subject:', opts.subject.slice(0, 60));
    return { success: true, messageId: `dry-run-${Date.now()}` };
  }

  return sendRaw({
    to: opts.to,
    subject: opts.subject,
    html: shell({ isAr: false, preheader: opts.subject.slice(0, 80), bodyInner: htmlBody }),
    text: opts.body + unsubFooter,
  });
}

export async function shouldSendTransactional(supabase: any, userId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('transactional_email')
      .eq('id', userId)
      .single();
    return data?.transactional_email !== false;
  } catch {
    return true;
  }
}
