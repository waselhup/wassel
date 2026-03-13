import ClientNav from '@/components/ClientNav';
import { CheckCircle, Chrome, Puzzle, Wifi } from 'lucide-react';

export default function ExtensionPairing() {
    return (
        <div className="flex min-h-screen" style={{ background: 'var(--bg-base)' }}>
            <ClientNav />

            <main className="flex-1 overflow-y-auto p-6 lg:p-8" style={{ maxHeight: '100vh' }}>
                <div className="max-w-3xl">
                    <div className="mb-6">
                        <h2 className="text-2xl font-extrabold mb-1" style={{ fontFamily: "'Syne', sans-serif", color: 'var(--text-primary)' }}>Chrome Extension</h2>
                        <p style={{ color: 'var(--text-muted)' }}>Import LinkedIn prospects directly into your campaigns.</p>
                    </div>

                    {/* Auto-Connected Banner */}
                    <div className="rounded-xl p-5 mb-4" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)' }}>
                        <div className="flex items-start gap-4">
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(34,197,94,0.15)' }}>
                                <Wifi className="w-4 h-4" style={{ color: '#22c55e' }} />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold mb-1" style={{ color: '#86efac' }}>✅ Auto-Connected</h3>
                                <p className="text-xs" style={{ color: '#94a3b8' }}>
                                    Your extension connects automatically when you're logged in to Wassel. No tokens or manual setup required.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Step 1: Install */}
                    <div className="rounded-xl p-5 mb-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                        <div className="flex items-start gap-4">
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(124,58,237,0.12)' }}>
                                <Chrome className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Step 1: Install Extension</h3>
                                <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Load the Wassel extension in Chrome using Developer Mode.</p>
                                <ol className="text-xs space-y-1 list-decimal list-inside" style={{ color: 'var(--text-secondary)' }}>
                                    <li>Open <code className="px-1 py-0.5 rounded text-[10px]" style={{ background: 'rgba(255,255,255,0.06)' }}>chrome://extensions</code></li>
                                    <li>Enable "Developer mode" (top right toggle)</li>
                                    <li>Click "Load unpacked" and select the <strong>extension new 2</strong> folder from your Desktop</li>
                                </ol>
                            </div>
                        </div>
                    </div>

                    {/* Step 2: Open LinkedIn */}
                    <div className="rounded-xl p-5 mb-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                        <div className="flex items-start gap-4">
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(168,85,247,0.12)' }}>
                                <Puzzle className="w-4 h-4" style={{ color: '#a855f7' }} />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Step 2: Use on LinkedIn</h3>
                                <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Go to LinkedIn People search and click the ⚡ Wassel button.</p>
                                <ol className="text-xs space-y-1 list-decimal list-inside" style={{ color: 'var(--text-secondary)' }}>
                                    <li>Go to <a href="https://www.linkedin.com/search/results/people/" target="_blank" className="underline" style={{ color: 'var(--accent-secondary)' }}>LinkedIn People Search</a></li>
                                    <li>Click the ⚡ floating button in the bottom-right</li>
                                    <li>Click "Scan Page" to find prospects</li>
                                    <li>Select a campaign and click "Import Selected"</li>
                                </ol>
                            </div>
                        </div>
                    </div>

                    {/* Step 3: Done */}
                    <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                        <div className="flex items-start gap-4">
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(34,197,94,0.12)' }}>
                                <CheckCircle className="w-4 h-4" style={{ color: '#22c55e' }} />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>That's It!</h3>
                                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                    Prospects will appear in your campaign automatically. The extension syncs your login session — no tokens to copy or paste.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
