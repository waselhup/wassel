import React from 'react';
import { Link } from 'wouter';
import { ArrowLeft, Chrome, Download, CheckCircle, ArrowRight } from 'lucide-react';

export default function Extension() {
    const steps = [
        'Download the ZIP file below',
        'Open Chrome and go to chrome://extensions',
        'Enable "Developer mode" (top right toggle)',
        'Click "Load unpacked" and select the extracted folder',
        'The Wassel icon will appear in your Chrome toolbar',
        'Click it, sign in, and start capturing leads from LinkedIn',
    ];

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-4xl mx-auto px-6 py-16">
                <Link href="/">
                    <button className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-8 cursor-pointer">
                        <ArrowLeft size={20} />
                        Back to Home
                    </button>
                </Link>

                <div className="text-center mb-12">
                    <Chrome size={64} className="text-blue-600 mx-auto mb-6" />
                    <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">Wassel Chrome Extension</h1>
                    <p className="text-xl text-gray-600">Capture LinkedIn leads directly from your browser</p>
                </div>

                <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 mb-12">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">Installation Steps</h2>
                    <div className="space-y-4">
                        {steps.map((step, index) => (
                            <div key={index} className="flex items-start gap-3">
                                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <span className="text-blue-600 font-bold text-sm">{index + 1}</span>
                                </div>
                                <p className="text-gray-700">{step}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-gradient-to-r from-blue-600 to-blue-500 rounded-2xl p-12 text-center text-white">
                    <Download size={48} className="mx-auto mb-4" />
                    <h3 className="text-2xl font-bold mb-4">Download Extension</h3>
                    <p className="text-blue-100 mb-8">Version 1.0 — Compatible with Chrome, Edge, and Brave</p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <a
                            href="/wassel-extension-prod.zip"
                            download
                            className="bg-white text-blue-600 font-semibold px-8 py-4 rounded-lg hover:shadow-lg transition-all inline-flex items-center justify-center gap-2"
                        >
                            <Download size={20} />
                            Download ZIP
                        </a>
                        <Link href="/login">
                            <button className="border-2 border-white text-white font-semibold px-8 py-4 rounded-lg hover:bg-white/10 transition-all inline-flex items-center justify-center gap-2 cursor-pointer">
                                Sign In First
                                <ArrowRight size={20} />
                            </button>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
