import { Link } from 'wouter';

export default function ExtensionDownload() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f0a1e 0%, #1a1040 50%, #0f0a1e 100%)',
      color: '#f1f5f9',
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
    }}>
      {/* Nav */}
      <nav style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '20px 40px', maxWidth: 1100, margin: '0 auto',
      }}>
        <Link href="/">
          <span style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Syne', sans-serif", cursor: 'pointer' }}>
            <span style={{ background: 'linear-gradient(135deg, #7c3aed, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Wassel</span>
          </span>
        </Link>
        <Link href="/login">
          <span style={{ color: '#94a3b8', fontSize: 14, cursor: 'pointer', textDecoration: 'none' }}>Log in →</span>
        </Link>
      </nav>

      {/* Hero */}
      <main style={{ maxWidth: 700, margin: '0 auto', padding: '60px 24px 80px', textAlign: 'center' }}>
        {/* Icon */}
        <div style={{
          width: 80, height: 80, borderRadius: 20, margin: '0 auto 24px',
          background: 'linear-gradient(135deg, #8B5CF6, #6366F1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 40, boxShadow: '0 8px 40px rgba(139,92,246,0.3)',
        }}>⚡</div>

        <h1 style={{
          fontSize: 36, fontWeight: 800, fontFamily: "'Syne', sans-serif",
          marginBottom: 16, lineHeight: 1.2,
        }}>
          Wassel Extension
        </h1>

        <p style={{ color: '#94a3b8', fontSize: 16, lineHeight: 1.7, marginBottom: 8, maxWidth: 500, margin: '0 auto 32px' }}>
          Download the Wassel Chrome Extension to import prospects from LinkedIn,
          run automated outreach campaigns, and sync with your dashboard.
        </p>

        {/* Download Button */}
        <a
          href="/wassel-extension.zip"
          download
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            background: 'linear-gradient(135deg, #8B5CF6, #6366F1)',
            color: '#fff', border: 'none', borderRadius: 12,
            padding: '16px 40px', fontSize: 18, fontWeight: 700,
            textDecoration: 'none', cursor: 'pointer',
            boxShadow: '0 4px 24px rgba(139,92,246,0.4)',
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}
          onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(139,92,246,0.5)'; }}
          onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 24px rgba(139,92,246,0.4)'; }}
        >
          ⬇ Download Extension
        </a>

        <p style={{ color: '#475569', fontSize: 13, marginTop: 12 }}>
          Version 1.1.0 · Chrome only · Free
        </p>

        {/* Install Steps */}
        <div style={{
          background: 'rgba(30,41,59,0.5)', border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 16, padding: '32px 28px', marginTop: 48, textAlign: 'left',
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, fontFamily: "'Syne', sans-serif" }}>
            📦 Installation Steps
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { n: '1', text: 'Click "Download Extension" above' },
              { n: '2', text: 'Unzip the downloaded file' },
              { n: '3', text: 'Open Chrome → type chrome://extensions in the address bar' },
              { n: '4', text: 'Enable "Developer Mode" (toggle in top right)' },
              { n: '5', text: 'Click "Load unpacked"' },
              { n: '6', text: 'Select the unzipped "wassel-extension" folder' },
              { n: '7', text: 'Visit wassel-alpha.vercel.app to connect your account' },
            ].map(s => (
              <div key={s.n} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(99,102,241,0.15))',
                  border: '1px solid rgba(139,92,246,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, color: '#a78bfa',
                }}>{s.n}</div>
                <p style={{ color: '#cbd5e1', fontSize: 14, lineHeight: 1.5, paddingTop: 3 }}>{s.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Note box */}
        <div style={{
          background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)',
          borderRadius: 12, padding: '16px 20px', marginTop: 24, textAlign: 'left',
        }}>
          <p style={{ color: '#34d399', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>💡 Tip</p>
          <p style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.6 }}>
            Already have an account? Log in to Wassel first, then install the extension.
            It connects to your dashboard automatically — no setup needed.
          </p>
        </div>

        {/* Share link */}
        <div style={{
          marginTop: 40, padding: '16px 20px', borderRadius: 10,
          background: 'rgba(30,41,59,0.5)', border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 6 }}>Share with your team:</p>
          <code style={{
            color: '#a78bfa', fontSize: 13, background: 'rgba(139,92,246,0.1)',
            padding: '6px 12px', borderRadius: 6, display: 'inline-block',
            userSelect: 'all',
          }}>wassel-alpha.vercel.app/extension-download</code>
        </div>
      </main>
    </div>
  );
}
