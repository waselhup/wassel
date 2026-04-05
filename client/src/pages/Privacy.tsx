import React from 'react';
import { Link } from 'wouter';
import { ArrowLeft, Shield, Lock, Eye, Database } from 'lucide-react';

export default function Privacy() {
    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-4xl mx-auto px-6 py-16">
                <Link href="/">
                    <button className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-8 cursor-pointer">
                        <ArrowLeft size={20} />
                        Back to Home
                    </button>
                </Link>

                <h1 className="text-4xl font-bold text-gray-900 mb-4">Privacy Policy</h1>
                <p className="text-gray-500 mb-12">Last updated: March 2026</p>

                <div className="space-y-8 text-gray-700 leading-relaxed">
                    <section>
                        <div className="flex items-center gap-3 mb-4">
                            <Shield size={24} className="text-blue-600" />
                            <h2 className="text-2xl font-semibold text-gray-900">Data Protection</h2>
                        </div>
                        <p>At Wassel, we take your privacy seriously. We collect only the data necessary to provide our LinkedIn campaign management services. Your personal information is encrypted end-to-end and never shared with third parties without your explicit consent.</p>
                    </section>

                    <section>
                        <div className="flex items-center gap-3 mb-4">
                            <Database size={24} className="text-blue-600" />
                            <h2 className="text-2xl font-semibold text-gray-900">What We Collect</h2>
                        </div>
                        <ul className="list-disc list-inside space-y-2 ml-4">
                            <li>Account information (email, name) for authentication</li>
                            <li>LinkedIn campaign data you create within Wassel</li>
                            <li>Usage analytics to improve our service</li>
                            <li>Payment information processed securely via our payment provider</li>
                        </ul>
                    </section>

                    <section>
                        <div className="flex items-center gap-3 mb-4">
                            <Lock size={24} className="text-blue-600" />
                            <h2 className="text-2xl font-semibold text-gray-900">Security</h2>
                        </div>
                        <p>All data is stored on secure servers with enterprise-grade encryption. We use Supabase for data storage with Row Level Security (RLS) policies ensuring your data is only accessible to you.</p>
                    </section>

                    <section>
                        <div className="flex items-center gap-3 mb-4">
                            <Eye size={24} className="text-blue-600" />
                            <h2 className="text-2xl font-semibold text-gray-900">Your Rights</h2>
                        </div>
                        <p>You have the right to access, modify, or delete your personal data at any time. Contact us at support@wassel.app to exercise these rights.</p>
                    </section>
                </div>
            </div>
        </div>
    );
}
