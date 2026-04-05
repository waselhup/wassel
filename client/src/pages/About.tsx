import React from 'react';
import { Link } from 'wouter';
import { ArrowLeft, ArrowRight } from 'lucide-react';

export default function About() {
    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-4xl mx-auto px-6 py-16">
                <Link href="/">
                    <button className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-8 cursor-pointer">
                        <ArrowLeft size={20} />
                        Back to Home
                    </button>
                </Link>

                <h1 className="text-4xl font-bold text-gray-900 mb-4">About Wassel</h1>
                <p className="text-xl text-gray-600 mb-12">Professional LinkedIn campaign management, built for modern teams.</p>

                <div className="prose prose-lg max-w-none text-gray-700 space-y-6">
                    <p>
                        Wassel is a professional platform designed to help businesses and individuals manage their LinkedIn
                        outreach campaigns intelligently. From prospecting to follow-up, everything is automated while
                        maintaining a personal, human touch.
                    </p>
                    <p>
                        Our mission is to make LinkedIn outreach accessible, effective, and scalable — whether you're a
                        solo entrepreneur or a large sales team.
                    </p>
                    <p>
                        Built with cutting-edge technology and a focus on security, Wassel ensures your LinkedIn account
                        stays safe while maximizing your outreach potential.
                    </p>
                </div>

                <div className="mt-12">
                    <Link href="/login">
                        <button className="bg-blue-600 text-white px-8 py-4 text-lg rounded-lg font-semibold hover:bg-blue-700 transition-all inline-flex items-center gap-2 cursor-pointer">
                            Get Started
                            <ArrowRight size={20} />
                        </button>
                    </Link>
                </div>
            </div>
        </div>
    );
}
