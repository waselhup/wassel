import React from 'react';
import { Link } from 'wouter';
import { ArrowLeft, Mail, MessageSquare } from 'lucide-react';

export default function Contact() {
    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-4xl mx-auto px-6 py-16">
                <Link href="/">
                    <button className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-8 cursor-pointer">
                        <ArrowLeft size={20} />
                        Back to Home
                    </button>
                </Link>

                <h1 className="text-4xl font-bold text-gray-900 mb-4">Contact Us</h1>
                <p className="text-xl text-gray-600 mb-12">We'd love to hear from you. Reach out anytime.</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
                        <Mail size={32} className="text-blue-600 mb-4" />
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">Email</h3>
                        <p className="text-gray-600 mb-4">For general inquiries and support</p>
                        <a
                            href="mailto:support@wassel.app"
                            className="text-blue-600 font-medium hover:text-blue-700"
                        >
                            support@wassel.app
                        </a>
                    </div>
                    <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
                        <MessageSquare size={32} className="text-blue-600 mb-4" />
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">Live Chat</h3>
                        <p className="text-gray-600 mb-4">Available 24/7 for quick questions</p>
                        <Link href="/login">
                            <button className="text-blue-600 font-medium hover:text-blue-700 cursor-pointer">
                                Login to start a chat →
                            </button>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
