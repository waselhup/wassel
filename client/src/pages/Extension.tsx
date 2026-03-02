import { useState } from 'react';
import { Link } from 'wouter';
import { ArrowLeft, Chrome, Download, ArrowRight, Copy, CheckCircle2, Wifi, WifiOff } from 'lucide-react';

export default function Extension() {
    const [pairingCopied, setPairingCopied] = useState(false);
    const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'fail'>('idle');

    const installSteps = [
        { num: 1, text: 'Download the extension ZIP file below', icon: '📦' },
        { num: 2, text: 'Extract the ZIP to a folder on your computer', icon: '📂' },
        { num: 3, text: 'Open Chrome → type chrome://extensions in the address bar', icon: '🌐' },
        { num: 4, text: 'Enable "Developer mode" (toggle in the top right)', icon: '🔧' },
        { num: 5, text: 'Click "Load unpacked" → select the extracted folder', icon: '📁' },
        { num: 6, text: 'You should see the Wassel icon in your Chrome toolbar', icon: '✅' },
    ];

    const copyPairingConfig = () => {
        const config = {
            apiUrl: `${window.location.origin}/api`,
            appUrl: window.location.origin,
        };
        navigator.clipboard.writeText(JSON.stringify(config, null, 2));
        setPairingCopied(true);
        setTimeout(() => setPairingCopied(false), 3000);
    };

    const testExtensionConnection = async () => {
        setTestStatus('testing');
        try {
            const res = await fetch('/api/health');
            if (res.ok) {
                setTestStatus('success');
            } else {
                setTestStatus('fail');
            }
        } catch {
            setTestStatus('fail');
        }
        setTimeout(() => setTestStatus('idle'), 5000);
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-4xl mx-auto px-6 py-16">
                <Link href="/">
                    <button className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-8 cursor-pointer">
                        <ArrowLeft size={20} />
                        Back to Home
                    </button>
                </Link>

                {/* Header */}
                <div className="text-center mb-12">
                    <Chrome size={64} className="text-blue-600 mx-auto mb-6" />
                    <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">Wassel Chrome Extension</h1>
                    <p className="text-xl text-gray-600">Import prospects directly from LinkedIn search results</p>
                </div>

                {/* Installation Steps */}
                <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 mb-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                        <span className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-sm font-bold">1</span>
                        Install the Extension
                    </h2>
                    <div className="space-y-4">
                        {installSteps.map((step) => (
                            <div key={step.num} className="flex items-start gap-3">
                                <div className="w-8 h-8 bg-blue-50 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <span className="text-sm">{step.icon}</span>
                                </div>
                                <p className="text-gray-700 pt-1">{step.text}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Download Section */}
                <div className="bg-gradient-to-r from-blue-600 to-blue-500 rounded-2xl p-8 text-center text-white mb-8 shadow-lg">
                    <Download size={40} className="mx-auto mb-4" />
                    <h3 className="text-2xl font-bold mb-2">Download Extension</h3>
                    <p className="text-blue-100 mb-6">Version 1.0 — Chrome, Edge, and Brave compatible</p>
                    <a
                        href="/wassel-extension-prod.zip"
                        download
                        className="bg-white text-blue-600 font-semibold px-8 py-4 rounded-lg hover:shadow-lg transition-all inline-flex items-center justify-center gap-2"
                    >
                        <Download size={20} />
                        Download ZIP
                    </a>
                </div>

                {/* Pairing Config */}
                <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 mb-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
                        <span className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 text-sm font-bold">2</span>
                        Pair with Wassel
                    </h2>
                    <p className="text-gray-600 mb-4">
                        After installing the extension, click the Wassel icon in Chrome and paste this config to pair it with your account:
                    </p>
                    <div className="bg-gray-50 rounded-lg p-4 mb-4 font-mono text-sm text-gray-700 border">
                        <pre className="whitespace-pre-wrap">{JSON.stringify({ apiUrl: `${window.location.origin}/api`, appUrl: window.location.origin }, null, 2)}</pre>
                    </div>
                    <button
                        onClick={copyPairingConfig}
                        className="bg-indigo-600 text-white font-semibold px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors inline-flex items-center gap-2"
                    >
                        {pairingCopied ? (
                            <>
                                <CheckCircle2 size={18} />
                                Copied!
                            </>
                        ) : (
                            <>
                                <Copy size={18} />
                                Copy Pairing Config
                            </>
                        )}
                    </button>
                </div>

                {/* Test Connection */}
                <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 mb-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
                        <span className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-green-600 text-sm font-bold">3</span>
                        Test Connection
                    </h2>
                    <p className="text-gray-600 mb-4">
                        Click below to verify the extension can reach the Wassel backend.
                    </p>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={testExtensionConnection}
                            disabled={testStatus === 'testing'}
                            className={`font-semibold px-6 py-3 rounded-lg transition-colors inline-flex items-center gap-2 ${testStatus === 'success'
                                    ? 'bg-green-600 text-white'
                                    : testStatus === 'fail'
                                        ? 'bg-red-600 text-white'
                                        : 'bg-gray-800 text-white hover:bg-gray-900'
                                }`}
                        >
                            {testStatus === 'testing' ? (
                                <>
                                    <Wifi size={18} className="animate-pulse" />
                                    Testing...
                                </>
                            ) : testStatus === 'success' ? (
                                <>
                                    <CheckCircle2 size={18} />
                                    Connected ✓
                                </>
                            ) : testStatus === 'fail' ? (
                                <>
                                    <WifiOff size={18} />
                                    Connection Failed
                                </>
                            ) : (
                                <>
                                    <Wifi size={18} />
                                    Test Extension Connection
                                </>
                            )}
                        </button>
                        {testStatus === 'success' && (
                            <span className="text-green-600 text-sm font-medium">Backend is reachable!</span>
                        )}
                        {testStatus === 'fail' && (
                            <span className="text-red-600 text-sm font-medium">Check if extension is installed correctly</span>
                        )}
                    </div>
                </div>

                {/* Next Steps */}
                <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 mb-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
                        <span className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 text-sm font-bold">4</span>
                        Start Importing
                    </h2>
                    <p className="text-gray-600 mb-6">
                        With the extension installed and paired, go to LinkedIn and search for prospects.
                        The Wassel sidebar will appear — click "Import" to bring them into your campaign.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4">
                        <a
                            href="https://www.linkedin.com/search/results/people/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-blue-600 text-white font-semibold px-8 py-4 rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center justify-center gap-2"
                        >
                            Open LinkedIn Search ↗
                        </a>
                        <Link href="/dashboard">
                            <button className="border-2 border-gray-300 text-gray-700 font-semibold px-8 py-4 rounded-lg hover:bg-gray-50 transition-colors inline-flex items-center justify-center gap-2 cursor-pointer w-full">
                                Go to Dashboard
                                <ArrowRight size={20} />
                            </button>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
