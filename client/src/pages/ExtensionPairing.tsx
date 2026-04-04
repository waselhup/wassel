import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import ClientNav from '@/components/ClientNav';
import { Download, CheckCircle, Monitor, Zap, MessageSquare, Send } from 'lucide-react';

// Detect OS
function detectOS(): 'windows' | 'mac' | 'other' {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('win')) return 'windows';
  if (ua.includes('mac')) return 'mac';
  return 'other';
}

export default function ExtensionPairing() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const [os] = useState<'windows' | 'mac' | 'other'>(detectOS);
  const [extensionDetected, setExtensionDetected] = useState(false);

  // Detect extension
  useEffect(() => {
    const check = () => {
      if (document.documentElement.getAttribute('data-wassel-extension') === 'true') {
        setExtensionDetected(true);
      }
    };
    const handleMsg = (e: MessageEvent) => {
      if (e.data?.type === 'WASSEL_EXTENSION_INSTALLED') setExtensionDetected(true);
    };
    check();
    window.addEventListener('message', handleMsg);
    const interval = setInterval(check, 2000);
    return () => { clearInterval(interval); window.removeEventListener('message', handleMsg); };
  }, []);

  const card = {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    boxShadow: 'var(--shadow-sm)',
  };

  const features = [
    {
      icon: <Zap size={18} color="#a78bfa" />,
      title: isAr ? 'تنفيذ الحملات' : 'Campaign Execution',
      desc: isAr
        ? 'يزور الملفات الشخصية، يرسل دعوات تواصل، ويرسل رسائل تلقائياً بالنيابة عنك'
        : 'Visits profiles, sends connection invites, and sends messages automatically on your behalf',
    },
    {
      icon: <Send size={18} color="#c4b5fd" />,
      title: isAr ? 'نشر المنشورات' : 'Post Publishing',
      desc: isAr
        ? 'يفتح محرر LinkedIn ويملأ المحتوى — أنت تضغط نشر'
        : 'Opens the LinkedIn composer and fills your content — you click Publish',
    },
    {
      icon: <MessageSquare size={18} color="#3b82f6" />,
      title: isAr ? 'المراسلة الآلية' : 'Automated Messaging',
      desc: isAr
        ? 'يرسل رسائل متسلسلة لمن قبلوا دعوة التواصل حسب جدول حملتك'
        : 'Sends follow-up messages to accepted connections according to your campaign schedule',
    },
  ];

  const notFeatures = isAr
    ? ['مسح أو استيراد ملفات LinkedIn (Apify يتولى ذلك الآن)', 'تخزين أي بيانات شخصية', 'الوصول لرسائلك الخاصة القديمة']
    : ['Scraping or importing LinkedIn profiles (Apify handles that now)', 'Storing any personal data', 'Accessing your existing private messages'];

  const downloadUrl = os === 'mac'
    ? '/wassel-extension-mac.zip'
    : '/wassel-extension-windows.zip';

  const osLabel = os === 'mac' ? 'macOS' : 'Windows';

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <ClientNav />
      <main
        className="flex-1 overflow-y-auto p-6 lg:p-8"
        style={{ maxHeight: '100vh', direction: isAr ? 'rtl' : 'ltr' }}
      >
        <div className="max-w-3xl">
          {/* Header */}
          <div className="mb-6">
            <h2
              className="text-2xl font-extrabold mb-1"
              style={{ fontFamily: "'Outfit', sans-serif", color: 'var(--text-primary)' }}
            >
              {isAr ? 'إضافة Chrome' : 'Chrome Extension'}
            </h2>
            <p style={{ color: 'var(--text-muted)' }}>
              {isAr
                ? 'الإضافة تعمل في الخلفية لتنفيذ حملاتك على LinkedIn'
                : 'The extension runs in the background to execute your LinkedIn campaigns'}
            </p>
          </div>

          {/* Extension detected banner */}
          {extensionDetected && (
            <div
              className="flex items-center gap-3 p-4 rounded-xl mb-4"
              style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}
            >
              <CheckCircle size={20} style={{ color: '#34d399', flexShrink: 0 }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: '#34d399' }}>
                  {isAr ? '✅ الإضافة مثبتة وتعمل' : '✅ Extension installed and active'}
                </p>
                <p className="text-xs mt-0.5" style={{ color: '#34d399' }}>
                  Wassel Extension v2.0.0
                </p>
              </div>
            </div>
          )}

          {/* Download card */}
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div
                style={{
                  width: 42, height: 42, borderRadius: 10,
                  background: 'linear-gradient(135deg, #8B5CF6, #6366F1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}
              >
                <Download size={20} color="#fff" />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
                  {isAr ? 'تحميل الإضافة' : 'Download Extension'}
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 14, lineHeight: 1.6 }}>
                  {isAr
                    ? 'تم اكتشاف نظام التشغيل تلقائياً. اختر نسختك أدناه.'
                    : 'Your OS was detected automatically. Pick your version below.'}
                </p>

                {/* Primary download (detected OS) */}
                <a
                  href={downloadUrl}
                  download
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    background: 'linear-gradient(135deg, #8B5CF6, #6366F1)',
                    color: '#fff', borderRadius: 8,
                    padding: '10px 20px', fontSize: 13, fontWeight: 600,
                    textDecoration: 'none', marginBottom: 10,
                  }}
                >
                  ⬇ {isAr ? `تحميل لـ ${osLabel}` : `Download for ${osLabel}`}
                </a>

                {/* Secondary — other OS */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {os !== 'windows' && (
                    <a
                      href="/wassel-extension-windows.zip"
                      download
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        color: 'var(--text-muted)', fontSize: 12,
                        border: '1px solid var(--border-subtle)', borderRadius: 6,
                        padding: '6px 12px', textDecoration: 'none',
                      }}
                    >
                      ⬇ Windows
                    </a>
                  )}
                  {os !== 'mac' && (
                    <a
                      href="/wassel-extension-mac.zip"
                      download
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        color: 'var(--text-muted)', fontSize: 12,
                        border: '1px solid var(--border-subtle)', borderRadius: 6,
                        padding: '6px 12px', textDecoration: 'none',
                      }}
                    >
                      ⬇ macOS
                    </a>
                  )}
                  <span style={{ color: 'var(--text-muted)', fontSize: 11, paddingTop: 7 }}>
                    Chrome only · Free
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Installation steps */}
          <div style={card}>
            <h3 style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
              {isAr ? '📦 خطوات التثبيت' : '📦 Installation Steps'}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(isAr
                ? [
                    'حمّل ملف ZIP أعلاه',
                    'فك ضغط الملف',
                    'افتح Chrome وانتقل إلى chrome://extensions',
                    'فعّل "وضع المطور" (زر في الأعلى)',
                    'اضغط "تحميل غير مضغوط"',
                    'اختر مجلد "wassel-extension" بعد فك الضغط',
                    '✅ ستظهر أيقونة الإضافة في شريط الأدوات',
                  ]
                : [
                    'Download the ZIP file above',
                    'Unzip the file on your computer',
                    'Open Chrome → chrome://extensions',
                    'Enable "Developer Mode" (top-right toggle)',
                    'Click "Load unpacked"',
                    'Select the unzipped "wassel-extension" folder',
                    '✅ The extension icon will appear in your toolbar',
                  ]
              ).map((text, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div
                    style={{
                      width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                      background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 700, color: '#a78bfa',
                    }}
                  >
                    {i + 1}
                  </div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 12, paddingTop: 3 }}>{text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* What the extension does */}
          <div style={card}>
            <h3 style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
              {isAr ? '⚡ ماذا تفعل الإضافة؟' : '⚡ What does the extension do?'}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {features.map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div
                    style={{
                      width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                      background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {f.icon}
                  </div>
                  <div>
                    <p style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{f.title}</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.5 }}>{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* What it does NOT do */}
          <div
            style={{
              ...card,
              background: 'rgba(239,68,68,0.05)',
              borderColor: 'rgba(239,68,68,0.15)',
            }}
          >
            <h3 style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 700, marginBottom: 10 }}>
              {isAr ? '🚫 ما لا تفعله الإضافة' : '🚫 What the extension does NOT do'}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {notFeatures.map((text, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <span style={{ color: '#ef4444', fontSize: 13, flexShrink: 0 }}>✕</span>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Auto-connect note */}
          <div
            style={{
              ...card,
              background: 'rgba(34,197,94,0.04)',
              borderColor: 'rgba(34,197,94,0.15)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <Monitor size={18} color="#34d399" style={{ marginTop: 2, flexShrink: 0 }} />
              <p style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.6 }}>
                {isAr
                  ? 'بمجرد تسجيل الدخول في Wassel، تتصل الإضافة تلقائياً — لا حاجة لنسخ أي رمز.'
                  : 'Once you\'re logged in to Wassel, the extension connects automatically — no tokens to copy or paste.'}
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
