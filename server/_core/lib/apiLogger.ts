import { createClient } from '@supabase/supabase-js';

let supabaseClient: any = null;

function getClient() {
  if (!supabaseClient) {
    const url = process.env.VITE_SUPABASE_URL || 'https://hiqotmimlgsrsnovtopd.supabase.co';
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    supabaseClient = createClient(url, key);
  }
  return supabaseClient;
}

export type ApiService = 'anthropic' | 'apify' | 'supabase' | 'telegram' | 'google';

export interface LogParams {
  service: ApiService;
  endpoint?: string;
  statusCode: number;
  responseTimeMs?: number;
  errorMsg?: string;
  userId?: string;
}

export async function logApiCall(params: LogParams): Promise<void> {
  try {
    await getClient().from('api_logs').insert({
      service: params.service,
      endpoint: params.endpoint || null,
      status_code: params.statusCode,
      response_time_ms: params.responseTimeMs || null,
      error_msg: params.errorMsg ? params.errorMsg.substring(0, 500) : null,
      user_id: params.userId || null,
    });

    if (params.statusCode >= 500 || params.statusCode === 402 || params.statusCode === 401 || params.statusCode === 429) {
      await checkAndAlertIfRepeated(params.service, params.errorMsg);
    }
  } catch (e: any) {
    console.error('[ApiLogger] Failed to log:', e?.message || e);
  }
}

async function checkAndAlertIfRepeated(service: string, lastError?: string): Promise<void> {
  try {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { count } = await getClient()
      .from('api_logs')
      .select('id', { count: 'exact', head: true })
      .eq('service', service)
      .or('status_code.gte.500,status_code.eq.402,status_code.eq.401,status_code.eq.429')
      .gte('created_at', fiveMinAgo);

    if ((count || 0) >= 3) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count: recentAlerts } = await getClient()
        .from('api_logs')
        .select('id', { count: 'exact', head: true })
        .eq('service', service)
        .eq('endpoint', 'TELEGRAM_ALERT_SENT')
        .gte('created_at', oneHourAgo);

      if ((recentAlerts || 0) === 0) {
        await sendTelegramAlert(service, count || 0, lastError);
        await getClient().from('api_logs').insert({
          service,
          endpoint: 'TELEGRAM_ALERT_SENT',
          status_code: 0,
        });
      }
    }
  } catch (e: any) {
    console.error('[ApiLogger] Alert check failed:', e?.message || e);
  }
}

async function sendTelegramAlert(service: string, errorCount: number, lastError?: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  const ALI_CHAT = '1205315908';
  const message = '🚨 *تنبيه وصّل* 🚨\n\n' +
    'الخدمة: `' + service + '`\n' +
    'عدد الأخطاء (5 دقائق): ' + errorCount + '\n' +
    'آخر خطأ: ' + (lastError ? lastError.substring(0, 200) : 'N/A') + '\n\n' +
    '🔍 ربما الرصيد خلص أو الخدمة معطّلة\n' +
    '⏰ ' + new Date().toLocaleString('ar-SA');

  try {
    await fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: ALI_CHAT,
        text: message,
        parse_mode: 'Markdown',
      }),
    });
    console.log('[Alert] Telegram alert sent for', service);
  } catch (e: any) {
    console.error('[Alert] Telegram send failed:', e?.message || e);
  }
}

export function mapAnthropicStatusToArabic(status: number): string {
  if (status === 401) return 'مفتاح Claude API غير صحيح. تواصل مع الدعم.';
  if (status === 402) return 'الخدمة معطّلة مؤقتاً (انتهت الكريديتس). نعمل على حلها.';
  if (status === 429) return 'تجاوزنا الحد المسموح. حاول بعد دقيقة.';
  if (status >= 500) return 'خطأ في خدمة Claude. حاول مرة أخرى.';
  return 'فشل الطلب. حاول مرة أخرى.';
}

export function mapApifyStatusToArabic(status: number): string {
  if (status === 401 || status === 403) return 'مفتاح Apify غير صحيح. تواصل مع الدعم.';
  if (status === 402) return 'رصيد Apify منتهي. نعمل على حلها.';
  if (status === 429) return 'تجاوزنا الحد المسموح في Apify. حاول بعد دقيقة.';
  if (status >= 500) return 'خطأ في خدمة LinkedIn. حاول مرة أخرى.';
  return 'فشل جلب بيانات LinkedIn. حاول مرة أخرى.';
}
