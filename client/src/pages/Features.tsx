import { Link } from 'wouter';
import { Zap, Users, Brain, BarChart3, Shield, ArrowRight } from 'lucide-react';

const features = [
  {
    icon: Zap,
    name: 'Smart Campaign Sequences',
    desc: 'Build multi-step automation flows: Profile Visit → Connection Invite → Message → Follow Up. Each step triggers automatically when the previous one succeeds.',
    color: '#1a56db',
    bg: '#eff6ff',
    details: ['Auto-visit profiles before sending invites', 'Customizable delays between steps', 'Conditional branching based on responses', 'Pause/resume campaigns anytime'],
  },
  {
    icon: Users,
    name: 'LinkedIn Prospect Import',
    desc: 'Import up to 500 prospects at once directly from LinkedIn search results using our Chrome extension. Multi-page scraping with automatic deduplication.',
    color: '#059669',
    bg: '#ecfdf5',
    details: ['Scan multiple LinkedIn search pages', 'Quantity selector: 25, 50, 100, 200, 500', 'Auto-deduplication of existing prospects', 'Import with name, title, company data'],
  },
  {
    icon: Brain,
    name: 'AI-Powered Messaging',
    desc: 'Claude AI writes personalized invitation and follow-up messages based on each prospect\'s profile. Higher acceptance rates through genuine personalization.',
    color: '#6366f1',
    bg: '#eef2ff',
    details: ['AI reads prospect profile context', 'Generates unique messages per person', 'Template variables for full personalization', 'A/B test different message styles'],
  },
  {
    icon: BarChart3,
    name: 'Real-Time Analytics',
    desc: 'Track acceptance rates, reply rates, and funnel performance across every campaign. Live dashboards with actionable metrics.',
    color: '#d97706',
    bg: '#fffbeb',
    details: ['Live acceptance rate tracking', 'Campaign funnel visualization', 'Daily activity charts', 'Export analytics data'],
  },
  {
    icon: Shield,
    name: 'Safe Automation',
    desc: 'Conservative daily limits, human-like timing delays, and automatic pause if LinkedIn shows any warnings. Your account safety comes first.',
    color: '#059669',
    bg: '#ecfdf5',
    details: ['Max 20 invites per day limit', 'Random 30-90 second delays', 'Auto-pause on LinkedIn warnings', 'Daily monitoring and alerts'],
  },
];

export default function Features() {
  return (
    <div style={{ background: 'var(--bg-base)', color: 'var(--text-primary)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50" style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/"><div className="flex items-center gap-2 cursor-pointer">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ background: 'var(--gradient-primary)' }}>W</div>
            <span className="text-lg font-extrabold" style={{ fontFamily: "'Outfit', sans-serif" }}>assel</span>
          </div></Link>
          <div className="flex items-center gap-4">
            <Link href="/safety"><span className="text-sm cursor-pointer" style={{ color: 'var(--text-secondary)' }}>Safety</span></Link>
            <Link href="/pricing"><span className="text-sm cursor-pointer" style={{ color: 'var(--text-secondary)' }}>Pricing</span></Link>
            <Link href="/login"><button className="text-sm px-5 py-2 rounded-lg font-semibold text-white" style={{ background: 'var(--gradient-primary)' }}>Get Started</button></Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-28 pb-12 px-4 text-center">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl sm:text-5xl font-extrabold mb-4" style={{ fontFamily: "'Outfit', sans-serif" }}>
            Everything You Need to Scale LinkedIn Outreach
          </h1>
          <p className="text-lg mb-8" style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            From prospect import to automated follow-ups — Wassel handles your entire LinkedIn workflow.
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="pb-20 px-4">
        <div className="max-w-4xl mx-auto space-y-8">
          {features.map((f, i) => (
            <div key={i} className="flex flex-col md:flex-row gap-6 p-6 rounded-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-sm)' }}>
              <div className="flex-shrink-0">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center" style={{ background: f.bg }}>
                  <f.icon className="w-7 h-7" style={{ color: f.color }} />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold mb-2" style={{ fontFamily: "'Outfit', sans-serif" }}>{f.name}</h3>
                <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>{f.desc}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {f.details.map((d, j) => (
                    <div key={j} className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                      <span style={{ color: f.color }}>✓</span>
                      <span>{d}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4 text-center" style={{ background: '#f1f5f9' }}>
        <h2 className="text-2xl font-extrabold mb-4" style={{ fontFamily: "'Outfit', sans-serif" }}>Ready to automate your LinkedIn outreach?</h2>
        <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>Start free. No credit card required.</p>
        <Link href="/login">
          <button className="px-8 py-3.5 rounded-xl text-base font-semibold text-white transition-all hover:scale-105" style={{ background: 'var(--gradient-primary)' }}>
            Get Started Free <ArrowRight className="w-4 h-4 inline ml-1" />
          </button>
        </Link>
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
