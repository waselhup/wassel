import React from 'react';
import { Link } from 'wouter';
import { ArrowLeft, Play, BarChart3, Users, Zap, ArrowRight } from 'lucide-react';

export default function Demo() {
    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-5xl mx-auto px-6 py-16">
                <Link href="/">
                    <button className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-8 cursor-pointer">
                        <ArrowLeft size={20} />
                        Back to Home
                    </button>
                </Link>

                <div className="text-center mb-16">
                    <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">See Wassel in Action</h1>
                    <p className="text-xl text-gray-600">Discover how Wassel transforms your LinkedIn outreach</p>
                </div>

                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-16 mb-16 flex items-center justify-center">
                    <div className="text-center">
                        <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Play size={32} className="text-white ml-1" />
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900 mb-2">Product Walkthrough</h3>
                        <p className="text-gray-600">A guided tour of Wassel's key features</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
                    <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100 text-center">
                        <BarChart3 size={32} className="text-green-500 mx-auto mb-4" />
                        <h3 className="font-semibold text-gray-900 mb-2">Analytics Dashboard</h3>
                        <p className="text-gray-600 text-sm">Track campaign performance with real-time metrics</p>
                    </div>
                    <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100 text-center">
                        <Users size={32} className="text-blue-500 mx-auto mb-4" />
                        <h3 className="font-semibold text-gray-900 mb-2">Lead Management</h3>
                        <p className="text-gray-600 text-sm">Organize and segment your prospects efficiently</p>
                    </div>
                    <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100 text-center">
                        <Zap size={32} className="text-yellow-500 mx-auto mb-4" />
                        <h3 className="font-semibold text-gray-900 mb-2">Smart Automation</h3>
                        <p className="text-gray-600 text-sm">Automate outreach while maintaining a personal touch</p>
                    </div>
                </div>

                <div className="text-center">
                    <Link href="/login">
                        <button className="bg-blue-600 text-white px-10 py-4 text-lg rounded-lg font-semibold hover:bg-blue-700 transition-all shadow-lg inline-flex items-center gap-2 cursor-pointer">
                            Try It Yourself — Free for 14 Days
                            <ArrowRight size={20} />
                        </button>
                    </Link>
                </div>
            </div>
        </div>
    );
}
