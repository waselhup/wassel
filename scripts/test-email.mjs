// One-off email pipeline test. Run with: node scripts/test-email.mjs
import { Resend } from 'resend';
import fs from 'node:fs';

const envFile = fs.readFileSync('.env.test', 'utf-8');
for (const line of envFile.split('\n')) {
  const m = line.match(/^([A-Z_]+)="?([^"\n]*)"?$/);
  if (m) process.env[m[1]] = m[2];
}

const KEY = process.env.RESEND_API_KEY;
const TO = process.argv[2] || 'waselhup@gmail.com';
const FROM = process.env.EMAIL_FROM || 'Wassel <onboarding@resend.dev>';

if (!KEY) {
  console.error('FAIL: RESEND_API_KEY missing');
  process.exit(1);
}

console.log(`Sending test email TO=${TO} FROM=${FROM}`);

const resend = new Resend(KEY);

const result = await resend.emails.send({
  from: FROM,
  to: TO,
  subject: 'Wassel email pipeline test ✅',
  html: `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:32px auto;padding:24px;border:1px solid #E5E7EB;border-radius:14px;">
      <h1 style="color:#0A8F84;margin:0 0 12px;">Wassel email test ✅</h1>
      <p>If you can read this, the Resend integration is working in production.</p>
      <ul>
        <li>Sent at: ${new Date().toISOString()}</li>
        <li>From: ${FROM}</li>
        <li>To: ${TO}</li>
      </ul>
      <p style="color:#6B7280;font-size:12px;">— Sent by scripts/test-email.mjs</p>
    </div>
  `,
  text: `Wassel email test\n\nIf you can read this, Resend is working.\n\nSent at: ${new Date().toISOString()}`,
});

console.log('Result:', JSON.stringify(result, null, 2));
if (result?.error) {
  console.error('FAIL: Resend rejected the send');
  process.exit(2);
}
console.log('OK: Email queued for delivery');
