import React from 'react';
import { Link } from 'wouter';
import { ArrowLeft, FileText, Scale, AlertTriangle, Users } from 'lucide-react';

export default function Terms() {
    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-4xl mx-auto px-6 py-16">
                <Link href="/">
                    <button className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-8 cursor-pointer">
                        <ArrowLeft size={20} />
                        Back to Home
                    </button>
                </Link>

                <h1 className="text-4xl font-bold text-gray-900 mb-4">Terms of Service</h1>
                <p className="text-gray-500 mb-12">Last updated: March 2026</p>

                <div className="space-y-8 text-gray-700 leading-relaxed">
                    <section>
                        <div className="flex items-center gap-3 mb-4">
                            <FileText size={24} className="text-blue-600" />
                            <h2 className="text-2xl font-semibold text-gray-900">Agreement</h2>
                        </div>
                        <p>By using Wassel, you agree to these Terms of Service. Wassel provides LinkedIn campaign management tools designed to help professionals manage their outreach efficiently and responsibly.</p>
                    </section>

                    <section>
                        <div className="flex items-center gap-3 mb-4">
                            <Users size={24} className="text-blue-600" />
                            <h2 className="text-2xl font-semibold text-gray-900">Acceptable Use</h2>
                        </div>
                        <p>You agree to use Wassel in compliance with LinkedIn's Terms of Service and all applicable laws. Automated outreach must be respectful and professional. Spam, harassment, or misleading campaigns are strictly prohibited.</p>
                    </section>

                    <section>
                        <div className="flex items-center gap-3 mb-4">
                            <Scale size={24} className="text-blue-600" />
                            <h2 className="text-2xl font-semibold text-gray-900">Liability</h2>
                        </div>
                        <p>Wassel provides tools on an "as is" basis. While we strive for maximum uptime and reliability, we are not responsible for any consequences arising from your use of the platform or interactions with LinkedIn.</p>
                    </section>

                    <section>
                        <div className="flex items-center gap-3 mb-4">
                            <AlertTriangle size={24} className="text-blue-600" />
                            <h2 className="text-2xl font-semibold text-gray-900">Account Termination</h2>
                        </div>
                        <p>We reserve the right to suspend or terminate accounts that violate these terms. You may cancel your account at any time, and your data will be permanently deleted within 30 days of cancellation.</p>
                    </section>
                </div>
            </div>
        </div>
    );
}
