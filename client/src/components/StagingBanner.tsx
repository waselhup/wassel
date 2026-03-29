export default function StagingBanner() {
  if (import.meta.env.VITE_APP_ENV !== 'staging') return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0,
      background: '#F59E0B', color: '#000',
      textAlign: 'center', padding: '6px',
      fontSize: '13px', fontWeight: 700,
      zIndex: 99999,
      fontFamily: "'Cairo', sans-serif",
    }}>
      ⚠️ بيئة الاختبار (Staging) — التغييرات هنا لا تؤثر على الإنتاج
      <a
        href="https://wassel-alpha.vercel.app"
        style={{ marginInlineStart: 12, textDecoration: 'underline', color: '#000' }}
      >
        الذهاب للإنتاج ←
      </a>
    </div>
  );
}
