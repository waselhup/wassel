import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { trpc } from '@/lib/trpc';

export default function PrivacyAndData() {
  const { t } = useTranslation();
  const { signOut } = useAuth();

  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletedReport, setDeletedReport] = useState<{ success: boolean; errors: string[] } | null>(null);
  const [confirmText, setConfirmText] = useState('');

  async function handleExport() {
    setExporting(true);
    setError(null);
    try {
      const result = await trpc.careerProfile.export();
      const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `wassel-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      const result = await trpc.careerProfile.deleteAllData();
      setDeletedReport(result);
      if (result.success) {
        // Sign the user out — their data is gone; staying logged in feels wrong
        try { await signOut(); } catch { /* non-fatal */ }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDeleting(false);
    }
  }

  const deleteConfirmWord = t('privacy.delete.confirm_word');

  return (
    <div className="mx-auto w-full max-w-[720px] px-4 pb-32 pt-6">
      <header className="mb-8 space-y-1">
        <h1 className="font-ar text-[24px] font-semibold text-v2-ink">{t('privacy.title')}</h1>
        <p className="font-ar text-[13px] text-v2-ink-muted">{t('privacy.subtitle')}</p>
      </header>

      {error && (
        <div className="mb-6 rounded-v2-md border border-rose-200 bg-rose-50 p-3 font-ar text-[13px] text-rose-700">
          {error}
        </div>
      )}

      {/* How we use your data */}
      <section className="mb-8 space-y-3 rounded-v2-md border border-v2-line bg-white p-4">
        <h2 className="font-ar text-[16px] font-semibold text-v2-ink">{t('privacy.how_used.title')}</h2>
        <p className="font-ar text-[13px] leading-relaxed text-v2-ink-muted">
          {t('privacy.how_used.body_1')}
        </p>
        <p className="font-ar text-[13px] leading-relaxed text-v2-ink-muted">
          {t('privacy.how_used.body_2')}
        </p>
        <p className="font-ar text-[13px] leading-relaxed text-v2-ink-muted">
          {t('privacy.how_used.body_3')}
        </p>
      </section>

      {/* Sources */}
      <section className="mb-8 space-y-3 rounded-v2-md border border-v2-line bg-white p-4">
        <h2 className="font-ar text-[16px] font-semibold text-v2-ink">{t('privacy.sources.title')}</h2>
        <p className="font-ar text-[13px] text-v2-ink-muted">{t('privacy.sources.body')}</p>
      </section>

      {/* Actions */}
      <section className="mb-8 space-y-3">
        <div className="rounded-v2-md border border-v2-line bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-ar text-[14px] font-semibold text-v2-ink">{t('privacy.actions.export.title')}</div>
              <p className="mt-1 font-ar text-[12px] text-v2-ink-muted">{t('privacy.actions.export.subtitle')}</p>
            </div>
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className="rounded-v2-md border border-v2-line bg-white px-4 py-2 font-ar text-[13px] font-semibold text-v2-ink hover:bg-v2-canvas disabled:opacity-40"
            >
              {exporting ? t('privacy.actions.export.busy') : t('privacy.actions.export.cta')}
            </button>
          </div>
        </div>

        <div className="rounded-v2-md border border-v2-line bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-ar text-[14px] font-semibold text-v2-ink">{t('privacy.actions.linkedin.title')}</div>
              <p className="mt-1 font-ar text-[12px] text-v2-ink-muted">{t('privacy.actions.linkedin.subtitle')}</p>
            </div>
            <a
              href="/v2/settings/career"
              className="rounded-v2-md border border-v2-line bg-white px-4 py-2 font-ar text-[13px] font-semibold text-v2-ink hover:bg-v2-canvas"
            >
              {t('privacy.actions.linkedin.cta')}
            </a>
          </div>
        </div>

        <div className="rounded-v2-md border border-v2-line bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-ar text-[14px] font-semibold text-v2-ink">{t('privacy.actions.notifications.title')}</div>
              <p className="mt-1 font-ar text-[12px] text-v2-ink-muted">{t('privacy.actions.notifications.subtitle')}</p>
            </div>
            <span className="font-ar text-[12px] text-v2-ink-muted">{t('privacy.actions.notifications.soon')}</span>
          </div>
        </div>
      </section>

      {/* Danger zone */}
      <section className="space-y-3 rounded-v2-md border border-rose-200 bg-rose-50 p-4">
        <h2 className="font-ar text-[16px] font-semibold text-rose-800">{t('privacy.delete.title')}</h2>
        <p className="font-ar text-[13px] text-rose-700">{t('privacy.delete.body')}</p>

        {deletedReport ? (
          <div className="rounded-v2-md border border-rose-300 bg-white p-3 font-ar text-[13px]">
            {deletedReport.success ? (
              <span className="text-emerald-700">{t('privacy.delete.success')}</span>
            ) : (
              <div className="text-rose-700">
                <div>{t('privacy.delete.partial_failure')}</div>
                <ul className="mt-2 list-disc space-y-1 ps-5 text-[12px]">
                  {deletedReport.errors.map((er, i) => (<li key={i}>{er}</li>))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={t('privacy.delete.confirm_placeholder', { word: deleteConfirmWord })}
              className="flex-1 rounded-v2-md border border-rose-300 bg-white px-3 py-2 font-ar text-[13px] text-v2-ink"
            />
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting || confirmText !== deleteConfirmWord}
              className="rounded-v2-md bg-rose-700 px-4 py-2 font-ar text-[13px] font-semibold text-white disabled:opacity-40"
            >
              {deleting ? t('privacy.delete.busy') : t('privacy.delete.cta')}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
