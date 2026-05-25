// WhatsApp Business API client.
// TODO Batch 2: real API integration (Meta WhatsApp Business or Twilio).

export interface WhatsAppMessage {
  to: string;
  body: string;
  templateName?: string;
}

export async function sendWhatsApp(msg: WhatsAppMessage): Promise<{ messageId: string; status: 'queued' }> {
  // TODO Batch 2: POST https://graph.facebook.com/v18.0/{phone-id}/messages
  console.log('[whatsapp stub] would send', msg);
  return { messageId: `wa_${Date.now()}`, status: 'queued' };
}
