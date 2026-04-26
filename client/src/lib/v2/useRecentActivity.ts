import { useEffect, useState } from 'react';
import { trpc } from '@/lib/trpc';

export type ActivityKind = 'analysis' | 'post' | 'billing' | 'cv' | 'campaign';

export interface ActivityEntry {
  id: string;
  kind: ActivityKind;
  title: string;
  description: string;
  /** epoch ms — used for grouping + sorting */
  timestamp: number;
  /** raw ISO string for the timestamp source row */
  isoTime: string;
}

interface AnyRow {
  id?: string;
  created_at?: string;
  createdAt?: string;
  [k: string]: unknown;
}

function pickTime(row: AnyRow): string | null {
  const candidates = [row.created_at, row.createdAt, (row as any).updated_at, (row as any).updatedAt];
  for (const c of candidates) {
    if (typeof c === 'string' && c.length > 0) return c;
  }
  return null;
}

function pickId(row: AnyRow, prefix: string, idx: number): string {
  const id = row.id ?? (row as any).uuid ?? null;
  return id ? `${prefix}:${id}` : `${prefix}:${idx}`;
}

function shortText(s: unknown, max = 80): string {
  if (typeof s !== 'string') return '';
  const trimmed = s.trim();
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max - 1) + '…';
}

/**
 * Fetches the user's recent activity by merging linkedin analyses, generated CVs,
 * campaigns, and posts. Returns sorted entries (newest first) plus loading/error.
 *
 * No mock data — if all sources fail or return empty, `entries` is `[]`.
 */
export function useRecentActivity(): {
  entries: ActivityEntry[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
} {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const settle = async <T,>(p: Promise<T>): Promise<T | null> => {
      try {
        return await p;
      } catch {
        return null;
      }
    };

    Promise.all([
      settle(trpc.linkedin.history()),
      settle(trpc.cv.list()),
      settle(trpc.campaign.list()),
      settle(trpc.posts.list()),
    ]).then(([linkedinHistory, cvList, campaignList, postsList]) => {
      if (cancelled) return;

      const merged: ActivityEntry[] = [];
      const allFailed =
        linkedinHistory === null && cvList === null && campaignList === null && postsList === null;

      if (Array.isArray(linkedinHistory)) {
        linkedinHistory.forEach((row: AnyRow, i) => {
          const iso = pickTime(row);
          if (!iso) return;
          const score = (row as any).overall_score ?? (row as any).score ?? null;
          const profileUrl = (row as any).profile_url ?? (row as any).linkedin_url ?? '';
          const title = score != null ? `تحليل البروفايل · ${score}/100` : 'تحليل البروفايل';
          merged.push({
            id: pickId(row, 'la', i),
            kind: 'analysis',
            title,
            description: shortText(profileUrl) || 'LinkedIn',
            timestamp: new Date(iso).getTime(),
            isoTime: iso,
          });
        });
      }

      if (Array.isArray(cvList)) {
        cvList.forEach((row: AnyRow, i) => {
          const iso = pickTime(row);
          if (!iso) return;
          const role = (row as any).target_role ?? (row as any).targetRole ?? '';
          const company = (row as any).target_company ?? (row as any).targetCompany ?? '';
          const desc = [role, company].filter(Boolean).join(' · ') || 'سيرة ذاتية';
          merged.push({
            id: pickId(row, 'cv', i),
            kind: 'cv',
            title: 'سيرة ذاتية مولّدة',
            description: shortText(desc),
            timestamp: new Date(iso).getTime(),
            isoTime: iso,
          });
        });
      }

      if (Array.isArray(campaignList)) {
        campaignList.forEach((row: AnyRow, i) => {
          const iso = pickTime(row);
          if (!iso) return;
          const name = (row as any).name ?? (row as any).campaign_name ?? 'حملة';
          const status = (row as any).status ?? '';
          merged.push({
            id: pickId(row, 'cm', i),
            kind: 'campaign',
            title: `حملة · ${shortText(name, 40)}`,
            description: status ? `الحالة: ${status}` : 'حملة تواصل',
            timestamp: new Date(iso).getTime(),
            isoTime: iso,
          });
        });
      }

      if (Array.isArray(postsList)) {
        postsList.forEach((row: AnyRow, i) => {
          const iso = pickTime(row);
          if (!iso) return;
          const topic = (row as any).topic ?? (row as any).title ?? '';
          merged.push({
            id: pickId(row, 'po', i),
            kind: 'post',
            title: 'منشور',
            description: shortText(topic) || 'صياغة منشور',
            timestamp: new Date(iso).getTime(),
            isoTime: iso,
          });
        });
      }

      merged.sort((a, b) => b.timestamp - a.timestamp);
      setEntries(merged);
      setLoading(false);
      if (allFailed) {
        setError('تعذّر تحميل النشاط الأخير.');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [tick]);

  return {
    entries,
    loading,
    error,
    refetch: () => setTick((t) => t + 1),
  };
}

const DAY = 24 * 60 * 60 * 1000;

export interface ActivityGroup {
  label: string;
  items: ActivityEntry[];
}

export function groupByPeriod(entries: ActivityEntry[], now = Date.now()): ActivityGroup[] {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const todayMs = startOfToday.getTime();
  const yesterdayMs = todayMs - DAY;
  const weekMs = todayMs - 6 * DAY;

  const today: ActivityEntry[] = [];
  const yesterday: ActivityEntry[] = [];
  const week: ActivityEntry[] = [];
  const older: ActivityEntry[] = [];

  for (const e of entries) {
    if (e.timestamp >= todayMs) today.push(e);
    else if (e.timestamp >= yesterdayMs) yesterday.push(e);
    else if (e.timestamp >= weekMs) week.push(e);
    else older.push(e);
  }

  return [
    { label: 'اليوم', items: today },
    { label: 'أمس', items: yesterday },
    { label: 'هذا الأسبوع', items: week },
    { label: 'أقدم', items: older },
  ].filter((g) => g.items.length > 0);
}

/** Compact label like "14:32"، "أمس"، "قبل 3 أيام". */
export function relativeLabel(timestamp: number, now = Date.now()): string {
  const d = new Date(timestamp);
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const todayMs = startOfToday.getTime();

  if (timestamp >= todayMs) {
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }
  const days = Math.floor((todayMs - timestamp) / DAY) + 1;
  if (days === 1) return 'أمس';
  if (days <= 6) return `قبل ${days} أيام`;
  if (days <= 13) return 'الأسبوع الماضي';
  if (days <= 30) return `قبل ${Math.floor(days / 7)} أسابيع`;
  return d.toLocaleDateString('ar-SA');
}

/** Counts of entries per day for the last `days` days, oldest → newest. */
export function dailyCounts(entries: ActivityEntry[], days = 7, now = Date.now()): number[] {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const todayMs = startOfToday.getTime();
  const counts = new Array(days).fill(0) as number[];
  for (const e of entries) {
    const dayDelta = Math.floor((todayMs - e.timestamp) / DAY);
    const idx = days - 1 - dayDelta;
    if (idx >= 0 && idx < days) counts[idx]! += 1;
  }
  return counts;
}
