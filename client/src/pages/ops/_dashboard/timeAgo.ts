import type { TFunction } from 'i18next';

/**
 * Format an ISO timestamp as a relative time string ("2m ago", "قبل ٢ دقيقة")
 * using the ops.* translation keys (justNow / secondsAgo / minutesAgo /
 * hoursAgo / daysAgo). Numbers stay in Western digits per CLAUDE.md rule 6.
 */
export function timeAgo(iso: string | null | undefined, t: TFunction): string {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 30 * 1000) return t('ops.justNow');
  const sec = Math.round(ms / 1000);
  if (sec < 60) return t('ops.secondsAgo', { n: sec });
  const min = Math.round(sec / 60);
  if (min < 60) return t('ops.minutesAgo', { n: min });
  const hr = Math.round(min / 60);
  if (hr < 24) return t('ops.hoursAgo', { n: hr });
  const days = Math.round(hr / 24);
  return t('ops.daysAgo', { n: days });
}

export function maskEmail(email: string | null | undefined): string {
  if (!email) return '—';
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const visible = local.slice(0, 1);
  return `${visible}${'•'.repeat(Math.max(2, local.length - 1))}@${domain}`;
}
