import { Link } from 'wouter';
import { Shield, Clock, AlertTriangle, Server, Eye, CheckCircle } from 'lucide-react';

export default function Safety() {
  return (
    <div style={{ background: 'var(--bg-base)', color: 'var(--text-primary)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50" style={{ background: 'rgba(30,41,59,0.85)', backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/"><div className="flex items-center gap-2 cursor-pointer">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ background: 'var(--gradient-primary)' }}>W</div>
            <span className="text-lg font-extrabold" style={{ fontFamily: "'Outfit', sans-serif" }}>assel</span>
          </div></Link>
          <div className="flex items-center gap-4">
            <Link href="/features"><span className="text-sm cursor-pointer" style={{ color: 'var(--text-secondary)' }}>Features</span></Link>
            <Link href="/pricing"><span className="text-sm cursor-pointer" style={{ color: 'var(--text-secondary)' }}>Pricing</span></Link>
            <Link href="/login"><button className="text-sm px-5 py-2 rounded-lg font-semibold text-white" style={{ background: 'var(--gradient-primary)' }}>Get Started</button></Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-28 pb-16 px-4 text-center">
        <div className="max-w-3xl mx-auto">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
            <Shield className="w-8 h-8" style={{ color: '#34d399' }} />
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold mb-4" style={{ fontFamily: "'Outfit', sans-serif" }}>
            How Wassel Keeps Your LinkedIn Account Safe
          </h1>
          <p className="text-lg" style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            We built safety into every part of Wassel. Your LinkedIn account is your most valuable professional asset — we treat it that way.
          </p>
        </div>
      </section>

      {/* Section 1: Our Limits */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-extrabold mb-2 text-center" style={{ fontFamily: "'Outfit', sans-serif" }}>Conservative Daily Limits</h2>
          <p className="text-center text-sm mb-10" style={{ color: 'var(--text-muted)' }}>We stay well below LinkedIn's thresholds</p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: Clock, title: 'Max 20 Invites/Day', desc: 'LinkedIn allows ~100 per day. We cap at 20 to keep you safe with a large margin.' },
              { icon: Eye, title: 'Human-Like Delays', desc: 'Random delays of 30-90 seconds between each action. No robotic patterns that LinkedIn can detect.' },
              { icon: AlertTriangle, title: 'Auto-Pause', desc: 'If LinkedIn shows any warning or unusual activity, Wassel automatically pauses all actions.' },
            ].map((item, i) => (
              <div key={i} className="p-6 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-sm)' }}>
                <div className="w-10 h-10 rounded-lg mb-4 flex items-center justify-center" style={{ background: 'rgba(34,197,94,0.08)' }}>
                  <item.icon className="w-5 h-5" style={{ color: '#34d399' }} />
                </div>
                <h3 className="font-bold mb-2">{item.title}</h3>
                <p className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 2: Extension Safety */}
      <section className="py-16 px-4" style={{ background: 'rgba(255,255,255,0.04)' }}>
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col md:flex-row gap-8 items-center">
            <div className="flex-1">
              <h2 className="text-2xl font-extrabold mb-4" style={{ fontFamily: "'Outfit', sans-serif" }}>Chrome Extension Safety</h2>
              <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                Our Chrome extension operates with minimal permissions. It only activates on LinkedIn pages you visit, and never accesses your LinkedIn credentials directly.
              </p>
              <ul className="space-y-3">
                {[
                  'Extension only reads LinkedIn search results you see',
                  'Never stores your LinkedIn password',
                  'All data encrypted in transit and at rest',
                  'Open-source inspection available on request',
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#34d399' }} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="w-full md:w-72 p-6 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-md)' }}>
              <Server className="w-8 h-8 mb-3" style={{ color: 'var(--accent-primary)' }} />
              <h3 className="font-bold mb-2">Your Data, Protected</h3>
              <p className="text-xs" style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
                All prospect data is stored securely in your private workspace. We never share your data with third parties.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Monitoring */}
      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-extrabold mb-4" style={{ fontFamily: "'Outfit', sans-serif" }}>Daily Monitoring</h2>
          <p className="text-sm mb-8" style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            Our system monitors for LinkedIn restrictions and automatically pauses all automation if any unusual activity is detected. You'll receive an instant notification so you always know what's happening.
          </p>
          <Link href="/login">
            <button className="px-8 py-3.5 rounded-xl text-base font-semibold text-white transition-all hover:scale-105" style={{ background: 'var(--gradient-primary)' }}>
              Start Safe Automation →
            </button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 text-center" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          © 2025 Wassel. <Link href="/terms" className="hover:underline">Terms</Link> · <Link href="/privacy" className="hover:underline">Privacy</Link> · <Link href="/safety" className="hover:underline">Safety</Link>
        </p>
      </footer>
    </div>
  );
}
