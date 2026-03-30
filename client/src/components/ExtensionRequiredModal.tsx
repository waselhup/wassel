import { useTranslation } from 'react-i18next';
import { X, Download, CheckCircle } from 'lucide-react';
import { useState, useEffect } from 'react';

interface ExtensionRequiredModalProps {
  reason: 'campaign' | 'post';
  onClose: () => void;
}

export default function ExtensionRequiredModal({ reason, onClose }: ExtensionRequiredModalProps) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const [detected, setDetected] = useState(false);

  // Poll for extension install
  useEffect(() => {
    const check = () => {
      if (document.documentElement.getAttribute('data-wassel-extension') === 'true') {
        setDetected(true);
      }
    };
    const handleMsg = (e: MessageEvent) => {
      if (e.data?.type === 'WASSEL_EXTENSION_INSTALLED') setDetected(true);
    };
    check();
    window.addEventListener('message', handleMsg);
    const interval = setInterval(check, 1500);
    return () => { clearInterval(interval); window.removeEventListener('message', handleMsg); };
  }, []);

  const bodyText = reason === 'campaign'
    ? t('extension.requiredCampaign')
    : t('extension.requiredPost');

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 16,
          padding: 28,
          maxWidth: 420,
          width: '100%',
          direction: isAr ? 'rtl' : 'ltr',
          position: 'relative',
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 16,
            [isAr ? 'left' : 'right']: 16,
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', padding: 4,
          }}
        >
          <X size={18} />
        </button>

        {/* Icon */}
        <div
          style={{
            width: 52, height: 52, borderRadius: 12, marginBottom: 16,
            background: detected ? 'rgba(34,197,94,0.12)' : 'linear-gradient(135deg,#7c3aed,#ec4899)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {detected
            ? <CheckCircle size={26} color="#22c55e" />
            : <Download size={26} color="#fff" />
          }
        </div>

        {/* Title */}
        <h2
          style={{
            color: detected ? '#22c55e' : 'var(--text-primary)',
            fontSize: 18, fontWeight: 700, marginBottom: 10,
          }}
        >
          {detected
            ? (isAr ? '✅ تم تثبيت الإضافة!' : '✅ Extension installed!')
            : t('extension.requiredTitle')
          }
        </h2>

        {/* Body */}
        {!detected && (
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>
            {bodyText}
          </p>
        )}

        {detected && (
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>
            {isAr
              ? 'الإضافة جاهزة! يمكنك الآن المتابعة.'
              : 'The extension is ready! You can now proceed.'}
          </p>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {!detected ? (
            <>
              <a
                href="/app/extension"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  background: 'linear-gradient(135deg,#7c3aed,#ec4899)',
                  color: '#fff', borderRadius: 8, padding: '11px 20px',
                  fontSize: 13, fontWeight: 600, textDecoration: 'none',
                }}
              >
                <Download size={16} />
                {t('extension.installNow')}
              </a>
              <button
                onClick={onClose}
                style={{
                  background: 'none', border: '1px solid var(--border-subtle)',
                  borderRadius: 8, padding: '9px 20px',
                  color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer',
                }}
              >
                {isAr ? 'متابعة بدون إضافة' : 'Continue without extension'}
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                background: '#059669', color: '#fff',
                border: 'none', borderRadius: 8, padding: '11px 20px',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              <CheckCircle size={16} />
              {isAr ? 'متابعة' : 'Continue'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
