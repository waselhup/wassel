import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import {
    Linkedin, Chrome, Search, Download, CheckCircle,
    ChevronRight, ArrowRight, Loader2, ExternalLink
} from 'lucide-react';
import { Link, useLocation } from 'wouter';

/**
 * Onboarding wizard for new client users.
 * Linear flow: Connect LinkedIn → Pair Extension → Open LinkedIn Search → Import → Dashboard
 */

type Step = {
    id: string;
    title: string;
    description: string;
    icon: React.ReactNode;
    completed: boolean;
};

export default function Onboarding() {
    const { user, accessToken } = useAuth();
    const [, navigate] = useLocation();
    const [currentStep, setCurrentStep] = useState(0);
    const [extensionToken, setExtensionToken] = useState<string | null>(null);
    const [tokenLoading, setTokenLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    // Determine completed steps from user state
    const [linkedInConnected, setLinkedInConnected] = useState(false);
    const [extensionPaired, setExtensionPaired] = useState(false);
    const [hasImports, setHasImports] = useState(false);

    useEffect(() => {
        checkProgress();
    }, []);

    const checkProgress = async () => {
        if (!accessToken) return;

        try {
            // Check if prospects exist (means they've imported)
            const res = await fetch('/api/ext/prospects', {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (res.ok) {
                const data = await res.json();
                if (data.count > 0) {
                    setHasImports(true);
                }
            }
        } catch { }
    };

    // If onboarding is complete, redirect to dashboard
    useEffect(() => {
        if (hasImports) {
            setCurrentStep(4); // All done
        }
    }, [hasImports]);

    const generateExtensionToken = async () => {
        if (!accessToken) return;
        setTokenLoading(true);
        try {
            const res = await fetch('/api/auth/extension-token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${accessToken}`,
                },
            });
            const data = await res.json();
            if (res.ok && data.token) {
                setExtensionToken(data.token);
            }
        } catch { }
        setTokenLoading(false);
    };

    const copyToken = () => {
        if (extensionToken) {
            navigator.clipboard.writeText(extensionToken);
            setCopied(true);
            setTimeout(() => setCopied(false), 3000);
        }
    };

    const steps: Step[] = [
        {
            id: 'linkedin',
            title: 'Connect LinkedIn',
            description: 'Link your LinkedIn account to Wassel',
            icon: <Linkedin className="w-5 h-5" />,
            completed: linkedInConnected,
        },
        {
            id: 'extension',
            title: 'Install Extension',
            description: 'Add the Wassel Chrome Extension',
            icon: <Chrome className="w-5 h-5" />,
            completed: extensionPaired,
        },
        {
            id: 'search',
            title: 'Search LinkedIn',
            description: 'Open LinkedIn People Search',
            icon: <Search className="w-5 h-5" />,
            completed: false,
        },
        {
            id: 'import',
            title: 'Import Prospects',
            description: 'Use the extension to import results',
            icon: <Download className="w-5 h-5" />,
            completed: hasImports,
        },
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
            <div className="w-full max-w-2xl">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-blue-600 mb-2">Welcome to Wassel!</h1>
                    <p className="text-gray-600">Let's get you set up in a few simple steps.</p>
                </div>

                {/* Progress bar */}
                <div className="flex items-center justify-between mb-8 px-4">
                    {steps.map((step, i) => (
                        <div key={step.id} className="flex items-center flex-1">
                            <div className={`
                w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm
                ${i < currentStep
                                    ? 'bg-green-500 text-white'
                                    : i === currentStep
                                        ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                                        : 'bg-gray-200 text-gray-500'
                                }
              `}>
                                {i < currentStep ? <CheckCircle className="w-5 h-5" /> : i + 1}
                            </div>
                            {i < steps.length - 1 && (
                                <div className={`flex-1 h-1 mx-2 rounded ${i < currentStep ? 'bg-green-400' : 'bg-gray-200'
                                    }`} />
                            )}
                        </div>
                    ))}
                </div>

                {/* Step labels */}
                <div className="flex items-center justify-between mb-8 px-1">
                    {steps.map((step, i) => (
                        <div key={step.id} className="flex-1 text-center">
                            <p className={`text-xs font-medium ${i === currentStep ? 'text-blue-600' : i < currentStep ? 'text-green-600' : 'text-gray-400'
                                }`}>
                                {step.title}
                            </p>
                        </div>
                    ))}
                </div>

                {/* Step content */}
                <Card className="p-8 shadow-lg">
                    {currentStep === 0 && (
                        <div className="text-center space-y-6">
                            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                                <Linkedin className="w-8 h-8 text-blue-600" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold text-gray-900 mb-2">Connect Your LinkedIn</h2>
                                <p className="text-gray-600 text-sm">
                                    Wassel needs access to your LinkedIn account to manage campaigns and import prospects.
                                    If you received an invite link, you may have already completed this step.
                                </p>
                            </div>
                            <div className="flex flex-col gap-3">
                                <Button
                                    onClick={() => setCurrentStep(1)}
                                    className="bg-blue-600 hover:bg-blue-700 text-white"
                                >
                                    I've connected LinkedIn <ArrowRight className="w-4 h-4 ml-2" />
                                </Button>
                                <p className="text-xs text-gray-400">
                                    If you haven't connected yet, check your email for an invite link from your campaign manager.
                                </p>
                            </div>
                        </div>
                    )}

                    {currentStep === 1 && (
                        <div className="text-center space-y-6">
                            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto">
                                <Chrome className="w-8 h-8 text-purple-600" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold text-gray-900 mb-2">Install the Chrome Extension</h2>
                                <p className="text-gray-600 text-sm mb-4">
                                    The Wassel Chrome Extension lets you import prospects directly from LinkedIn search results.
                                </p>
                            </div>

                            <div className="text-left bg-gray-50 rounded-lg p-4 space-y-3">
                                <p className="text-sm font-medium text-gray-700">Steps:</p>
                                <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
                                    <li>Open <code className="bg-gray-200 px-1 py-0.5 rounded text-xs">chrome://extensions</code> in Chrome</li>
                                    <li>Enable <strong>Developer mode</strong> (top right toggle)</li>
                                    <li>Click <strong>Load unpacked</strong> → select the <code className="bg-gray-200 px-1 py-0.5 rounded text-xs">wassel-extension</code> folder</li>
                                </ol>
                            </div>

                            {/* Extension token */}
                            <div className="border-t pt-4 space-y-3">
                                <p className="text-sm font-medium text-gray-700">Then paste this token in the extension popup:</p>
                                {!extensionToken ? (
                                    <Button
                                        onClick={generateExtensionToken}
                                        disabled={tokenLoading}
                                        variant="outline"
                                        className="w-full"
                                    >
                                        {tokenLoading ? (
                                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating...</>
                                        ) : (
                                            'Generate Extension Token'
                                        )}
                                    </Button>
                                ) : (
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                        <div className="flex items-center justify-between">
                                            <code className="text-xs text-blue-800 break-all">{extensionToken.substring(0, 50)}...</code>
                                            <Button variant="ghost" size="sm" onClick={copyToken}>
                                                {copied ? (
                                                    <span className="text-green-600 text-xs">✓ Copied</span>
                                                ) : (
                                                    <span className="text-xs">Copy</span>
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <Button
                                onClick={() => setCurrentStep(2)}
                                className="bg-blue-600 hover:bg-blue-700 text-white w-full"
                            >
                                Extension installed & paired <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                        </div>
                    )}

                    {currentStep === 2 && (
                        <div className="text-center space-y-6">
                            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto">
                                <Search className="w-8 h-8 text-orange-600" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold text-gray-900 mb-2">Search for Prospects on LinkedIn</h2>
                                <p className="text-gray-600 text-sm">
                                    Open LinkedIn and search for people you'd like to import. Use LinkedIn People Search
                                    to find your target audience.
                                </p>
                            </div>
                            <a
                                href="https://www.linkedin.com/search/results/people/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium"
                            >
                                <ExternalLink className="w-4 h-4" />
                                Open LinkedIn People Search
                            </a>
                            <Button
                                onClick={() => setCurrentStep(3)}
                                variant="outline"
                                className="w-full"
                            >
                                Done, I'm on LinkedIn <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                        </div>
                    )}

                    {currentStep === 3 && (
                        <div className="text-center space-y-6">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                                <Download className="w-8 h-8 text-green-600" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold text-gray-900 mb-2">Import Your First Prospects</h2>
                                <p className="text-gray-600 text-sm">
                                    While on a LinkedIn search results page, click the Wassel extension icon in your browser toolbar
                                    and click <strong>"Import Prospects"</strong>.
                                </p>
                            </div>
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-left">
                                <p className="text-sm text-green-800 font-medium mb-2">Quick steps:</p>
                                <ol className="text-sm text-green-700 space-y-1 list-decimal list-inside">
                                    <li>Make sure you see LinkedIn search results</li>
                                    <li>Click the Wassel extension icon (puzzle piece → Wassel)</li>
                                    <li>Click "Import Prospects"</li>
                                    <li>Wait for the success message</li>
                                </ol>
                            </div>
                            <div className="flex gap-3">
                                <Button
                                    onClick={() => { setCurrentStep(4); }}
                                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                                >
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    I've imported prospects
                                </Button>
                            </div>
                        </div>
                    )}

                    {currentStep === 4 && (
                        <div className="text-center space-y-6">
                            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                                <CheckCircle className="w-10 h-10 text-green-600" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-semibold text-gray-900 mb-2">You're All Set! 🎉</h2>
                                <p className="text-gray-600">
                                    Your Wassel account is ready. You can now manage campaigns, import prospects,
                                    and use the Chrome extension anytime.
                                </p>
                            </div>
                            <Link href="/app">
                                <Button className="bg-blue-600 hover:bg-blue-700 text-white px-8">
                                    Go to Dashboard <ArrowRight className="w-4 h-4 ml-2" />
                                </Button>
                            </Link>
                        </div>
                    )}
                </Card>

                {/* Skip option */}
                {currentStep < 4 && (
                    <div className="text-center mt-4">
                        <Link href="/app">
                            <button className="text-sm text-gray-400 hover:text-gray-600">
                                Skip setup → Go to dashboard
                            </button>
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}
