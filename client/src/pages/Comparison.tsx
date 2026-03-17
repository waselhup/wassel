import { Link } from 'wouter';
import { CheckCircle, X, ArrowRight } from 'lucide-react';

const rows = [
  { feature: 'Starting Price', wassel: '$0/mo (Free tier)', waalaxy: '$21/mo', wasselWin: true },
  { feature: 'Flat Pricing', wassel: '✓ No add-ons', waalaxy: 'Complex tiers + add-ons', wasselWin: true },
  { feature: 'Arabic Support', wassel: '✓ Full RTL', waalaxy: '✗', wasselWin: true },
  { feature: 'AI Messaging', wassel: '✓ Claude AI', waalaxy: '✓ Basic AI', wasselWin: true },
  { feature: 'Real-Time Analytics', wassel: '✓ Live dashboard', waalaxy: 'Limited', wasselWin: true },
  { feature: 'Chrome Extension', wassel: '✓ Optional', waalaxy: '✓ Required', wasselWin: true },
  { feature: 'Safety Limits', wassel: 'Conservative (20/day)', waalaxy: 'Standard', wasselWin: true },
  { feature: 'Multi-page Scraping', wassel: '✓ Up to 500', waalaxy: '✓ Up to 2,500', wasselWin: false },
  { feature: 'Email Finder', wassel: 'Coming soon', waalaxy: '✓ Paid add-on', wasselWin: false },
  { feature: 'Free Trial', wassel: '✓ 7 days', waalaxy: '✓ 7 days', wasselWin: false },
];

export default function Comparison() {
  return (
    <div style={{ background: 'var(--bg-base)', color: 'var(--text-primary)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50" style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/"><div className="flex items-center gap-2 cursor-pointer">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ background: 'var(--gradient-primary)' }}>W</div>
            <span className="text-lg font-extrabold" style={{ fontFamily: "'Outfit', sans-serif" }}>assel</span>
          </div></Link>
          <Link href="/login"><button className="text-sm px-5 py-2 rounded-lg font-semibold text-white" style={{ background: 'var(--gradient-primary)' }}>Get Started</button></Link>
        </div>
      </nav>

      <section className="pt-28 pb-8 px-4 text-center">
        <h1 className="text-4xl sm:text-5xl font-extrabold mb-4" style={{ fontFamily: "'Outfit', sans-serif" }}>Wassel vs Waalaxy</h1>
        <p className="text-lg max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          See how Wassel compares to Waalaxy on pricing, features, and safety.
        </p>
      </section>

      <section className="pb-20 px-4">
        <div className="max-w-3xl mx-auto rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-md)' }}>
          {/* Header */}
          <div className="grid grid-cols-3 text-center py-4 text-sm font-bold" style={{ background: '#f1f5f9', borderBottom: '1px solid var(--border-subtle)' }}>
            <span>Feature</span>
            <span style={{ color: 'var(--accent-primary)' }}>Wassel</span>
            <span>Waalaxy</span>
          </div>
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-3 text-center py-3.5 text-sm" style={{ borderBottom: '1px solid var(--border-subtle)', background: r.wasselWin ? '#f0fdf4' : 'white' }}>
              <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{r.feature}</span>
              <span style={{ color: r.wasselWin ? '#059669' : 'var(--text-secondary)' }}>{r.wassel}</span>
              <span style={{ color: 'var(--text-muted)' }}>{r.waalaxy}</span>
            </div>
          ))}
        </div>

        <div className="text-center mt-10">
          <Link href="/login">
            <button className="px-8 py-3.5 rounded-xl text-base font-semibold text-white" style={{ background: 'var(--gradient-primary)' }}>
              Try Wassel Free <ArrowRight className="w-4 h-4 inline ml-1" />
            </button>
          </Link>
          <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>No credit card required</p>
        </div>
      </section>

      <footer className="py-8 px-4 text-center" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>© 2025 Wassel</p>
      </footer>
    </div>
  );
}
