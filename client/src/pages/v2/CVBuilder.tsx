/**
 * /v2/cvs — Career Copilot Resume list.
 *
 * Replaces the legacy CVBuilder wrapper. The new list shows active CVs as
 * cards with ATS badges, plus a "Legacy CV" section for pre-Copilot rows
 * migrated by 20260601_resume_v2.sql. Tapping "+ New CV" goes to /v2/cvs/new.
 *
 * Reads from career_profile transparently via `resume.listVersions` —
 * the user is never re-asked anything that already lives on their profile.
 */

import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import {
  Plus, FileText, Archive, ArchiveRestore, ChevronDown, ChevronUp,
  AlertCircle, ExternalLink,
} from 'lucide-react';
import Phone from '@/components/v2/Phone';
import Topbar from '@/components/v2/Topbar';
import BottomNav from '@/components/v2/BottomNav';
import Card from '@/components/v2/Card';
import Button from '@/components/v2/Button';
import Eyebrow from '@/components/v2/Eyebrow';
import Skeleton from '@/components/v2/Skeleton';
import NumDisplay from '@/components/v2/NumDisplay';
import { trpc, type ResumeVersionRow } from '@/lib/trpc';

export default function CVList() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const [, navigate] = useLocation();

  const [versions, setVersions] = useState<ResumeVersionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [archivedOpen, setArchivedOpen] = useState(false);
  const [legacyOpen, setLegacyOpen] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await trpc.resume.listVersions({ status: 'all', limit: 100 });
      setVersions(data.versions ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleRestore(versionId: string) {
    setRestoring(versionId);
    try {
      await trpc.resume.restore({ versionId });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRestoring(null);
    }
  }

  const active = versions.filter((v) => v.status === 'active');
  const archived = versions.filter((v) => v.status === 'archived');
  const legacy = versions.filter((v) => v.status === 'legacy');

  // Group active by target role so the user can see "Senior PM (2)", "Data Analyst (1)" at a glance.
  const byRole = new Map<string, ResumeVersionRow[]>();
  for (const v of active) {
    const arr = byRole.get(v.target_role) ?? [];
    arr.push(v);
    byRole.set(v.target_role, arr);
  }

  if (loading) {
    return (
      <Phone>
        <Topbar sticky bg="canvas" leading={<span className="px-2 font-ar text-[15px] font-bold text-v2-ink">{t('resume.title')}</span>} />
        <div className="flex-1 px-[22px] pt-6">
          <Skeleton variant="text" lines={2} className="mb-6" />
          <Skeleton variant="card" className="mb-4" />
          <Skeleton variant="card" />
        </div>
      </Phone>
    );
  }

  return (
    <Phone>
      <Topbar
        sticky
        bg="canvas"
        leading={<span className="px-2 font-ar text-[15px] font-bold text-v2-ink">{t('resume.title')}</span>}
      />

      <div className="flex-1 px-[22px] pb-[110px] lg:px-0 lg:pb-0">
        <div className="mt-5 mb-6 lg:mt-2 lg:mb-8">
          <Eyebrow className="mb-1.5 block">RESUME</Eyebrow>
          <h1 className="font-ar font-bold leading-tight text-v2-ink text-[26px] lg:text-[32px]">
            {t('resume.subtitle')}
          </h1>
        </div>

        {error && (
          <Card padding="md" radius="md" className="mb-4 border-rose-200 bg-rose-50">
            <div className="flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0 text-rose-600" />
              <p className="font-ar text-[13px] text-rose-700">{error}</p>
            </div>
          </Card>
        )}

        <Button
          variant="primary"
          size="lg"
          fullWidth
          leadingIcon={<Plus size={18} />}
          onClick={() => navigate('/v2/cvs/new')}
        >
          {t('resume.list.newCv')}
        </Button>

        {/* Active versions, grouped by target role */}
        {active.length > 0 ? (
          <div className="mt-6">
            <Eyebrow className="mb-3 block">
              {t('resume.list.activeVersions')} · <NumDisplay>{active.length}</NumDisplay>
            </Eyebrow>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {Array.from(byRole.entries()).flatMap(([role, items]) =>
                items.map((v) => (
                  <VersionCard
                    key={v.id}
                    v={v}
                    roleLabel={items.length > 1 ? `${role} (${items.indexOf(v) + 1}/${items.length})` : role}
                    isAr={isAr}
                    onOpen={() => navigate(`/v2/cvs/${v.id}`)}
                  />
                )),
              )}
            </div>
          </div>
        ) : (
          <Card padding="lg" radius="lg" className="mt-6 text-center">
            <FileText size={28} className="mx-auto mb-2 text-v2-mute" />
            <p className="font-ar text-[14px] font-semibold text-v2-ink">
              {t('resume.list.emptyState')}
            </p>
            <p className="mt-1 font-ar text-[12px] text-v2-mute">
              {isAr ? 'كل سيرة موجّهة لدور محدد' : 'Every resume is tailored to one target role'}
            </p>
          </Card>
        )}

        {/* Legacy section */}
        {legacy.length > 0 && (
          <div className="mt-6">
            <button
              type="button"
              onClick={() => setLegacyOpen((s) => !s)}
              className="flex w-full items-center justify-between rounded-v2-md border border-amber-200 bg-amber-50 px-3 py-3"
            >
              <div className="flex items-center gap-2">
                <Archive size={16} className="text-amber-700" />
                <span className="font-ar text-[14px] font-semibold text-amber-900">
                  {t('resume.list.legacy')} · <NumDisplay>{legacy.length}</NumDisplay>
                </span>
              </div>
              {legacyOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
            {legacyOpen && (
              <div className="mt-3">
                <p className="mb-3 font-ar text-[12px] text-amber-800">
                  {t('resume.list.legacyBanner')}
                </p>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {legacy.map((v) => (
                    <VersionCard
                      key={v.id}
                      v={v}
                      roleLabel={v.display_name}
                      isAr={isAr}
                      readOnly
                      onOpen={() => navigate(`/v2/cvs/${v.id}`)}
                      onPrimary={() => navigate('/v2/cvs/new')}
                      primaryLabel={isAr ? 'ابدأ نسخة جديدة' : 'Start a new version'}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Archived section */}
        {archived.length > 0 && (
          <div className="mt-6">
            <button
              type="button"
              onClick={() => setArchivedOpen((s) => !s)}
              className="flex w-full items-center justify-between rounded-v2-md border border-v2-line bg-v2-canvas-2 px-3 py-3"
            >
              <div className="flex items-center gap-2">
                <Archive size={16} className="text-v2-mute" />
                <span className="font-ar text-[14px] font-semibold text-v2-ink">
                  {t('resume.list.archived')} · <NumDisplay>{archived.length}</NumDisplay>
                </span>
              </div>
              {archivedOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
            {archivedOpen && (
              <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {archived.map((v) => (
                  <VersionCard
                    key={v.id}
                    v={v}
                    roleLabel={v.target_role}
                    isAr={isAr}
                    onOpen={() => navigate(`/v2/cvs/${v.id}`)}
                    onPrimary={() => handleRestore(v.id)}
                    primaryLabel={
                      restoring === v.id
                        ? (isAr ? 'جارٍ…' : 'Working…')
                        : (isAr ? 'استعادة' : 'Restore')
                    }
                    primaryIcon={<ArchiveRestore size={14} />}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <BottomNav
        active="profile"
        items={[
          { id: 'home',    label: isAr ? 'الرئيسية'  : 'Home',    icon: <span /> , onSelect: () => navigate('/v2/home') },
          { id: 'analyze', label: isAr ? 'الرادار'    : 'Radar',   icon: <span /> , onSelect: () => navigate('/v2/analyze') },
          { id: 'posts',   label: isAr ? 'الاستوديو'  : 'Studio',  icon: <span /> , onSelect: () => navigate('/v2/posts') },
          { id: 'profile', label: isAr ? 'حسابي'      : 'Account', icon: <span /> , onSelect: () => navigate('/v2/me') },
        ]}
        fabIcon="plus"
        fabLabel={t('resume.list.newCv')}
        onFabClick={() => navigate('/v2/cvs/new')}
      />
    </Phone>
  );
}

// ─────────────────────────────────────────────
// Sub-component — kept in-file for minimal touch
// ─────────────────────────────────────────────

function VersionCard(props: {
  v: ResumeVersionRow;
  roleLabel: string;
  isAr: boolean;
  readOnly?: boolean;
  onOpen: () => void;
  onPrimary?: () => void;
  primaryLabel?: string;
  primaryIcon?: React.ReactNode;
}) {
  const { v, roleLabel, isAr, readOnly, onOpen, onPrimary, primaryLabel, primaryIcon } = props;
  const ats = typeof v.ats_score === 'number' ? v.ats_score : null;
  const scoreColor =
    ats === null ? 'bg-v2-canvas-2 text-v2-mute'
    : ats >= 80 ? 'bg-emerald-50 text-emerald-700'
    : ats >= 60 ? 'bg-amber-50 text-amber-700'
    : 'bg-rose-50 text-rose-700';

  return (
    <Card padding="md" radius="lg" className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-ar text-[14px] font-semibold text-v2-ink">{roleLabel}</p>
          <p className="mt-0.5 truncate font-ar text-[12px] text-v2-mute">{v.display_name}</p>
        </div>
        {ats !== null && (
          <span className={`shrink-0 rounded-v2-pill px-2 py-0.5 text-[11px] font-bold ${scoreColor}`}>
            ATS <NumDisplay>{ats}</NumDisplay>
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center rounded-v2-pill bg-v2-canvas-2 px-2 py-0.5 text-[11px] font-semibold text-v2-body">
          {v.template_id.replace(/_/g, ' ')}
        </span>
        <span className="font-en text-[10px] text-v2-mute">
          · <NumDisplay>{new Date(v.created_at).toISOString().slice(0, 10)}</NumDisplay>
        </span>
        {readOnly && (
          <span className="inline-flex items-center rounded-v2-pill bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
            {isAr ? 'للقراءة فقط' : 'read-only'}
          </span>
        )}
      </div>

      <div className="mt-1 flex gap-2">
        <Button variant="secondary" size="sm" onClick={onOpen} leadingIcon={<ExternalLink size={14} />}>
          {isAr ? 'فتح' : 'Open'}
        </Button>
        {onPrimary && primaryLabel && (
          <Button variant="primary" size="sm" onClick={onPrimary} leadingIcon={primaryIcon}>
            {primaryLabel}
          </Button>
        )}
      </div>
    </Card>
  );
}
