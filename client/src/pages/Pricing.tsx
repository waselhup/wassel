import React from 'react';
import { Link } from 'wouter';
import { ArrowLeft, Check, ArrowRight } from 'lucide-react';

export default function Pricing() {
    const plans = [
        {
            name: 'Starter',
            price: 'Free',
            period: '14 days',
            description: 'Perfect for trying out Wassel',
            features: ['1 Campaign', '100 Leads', 'Basic Analytics', 'Email Support'],
            cta: 'Start Free Trial',
            highlighted: false,
        },
        {
            name: 'Professional',
            price: '$49',
            period: '/month',
            description: 'Best for growing teams',
            features: ['Unlimited Campaigns', '5,000 Leads', 'Advanced Analytics', 'Priority Support', 'Chrome Extension', 'Custom Templates'],
            cta: 'Get Started',
            highlighted: true,
        },
        {
            name: 'Enterprise',
            price: 'Custom',
            period: '',
            description: 'For large organizations',
            features: ['Everything in Pro', 'Unlimited Leads', 'Dedicated Account Manager', 'Custom Integrations', 'SLA', 'On-premise Option'],
            cta: 'Contact Sales',
            highlighted: false,
        },
    ];

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-6xl mx-auto px-6 py-16">
                <Link href="/">
                    <button className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-8 cursor-pointer">
                        <ArrowLeft size={20} />
                        Back to Home
                    </button>
                </Link>

                <div className="text-center mb-16">
                    <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">Simple, Transparent Pricing</h1>
                    <p className="text-xl text-gray-600">Start free, scale as you grow</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {plans.map((plan, index) => (
                        <div
                            key={index}
                            className={`rounded-2xl p-8 ${plan.highlighted
                                    ? 'bg-blue-600 text-white shadow-xl scale-105'
                                    : 'bg-white shadow-lg border border-gray-200'
                                }`}
                        >
                            <h3 className={`text-xl font-semibold mb-2 ${plan.highlighted ? 'text-white' : 'text-gray-900'}`}>
                                {plan.name}
                            </h3>
                            <p className={`text-sm mb-4 ${plan.highlighted ? 'text-blue-100' : 'text-gray-500'}`}>
                                {plan.description}
                            </p>
                            <div className="mb-6">
                                <span className={`text-4xl font-bold ${plan.highlighted ? 'text-white' : 'text-gray-900'}`}>
                                    {plan.price}
                                </span>
                                <span className={`text-sm ${plan.highlighted ? 'text-blue-200' : 'text-gray-500'}`}>
                                    {plan.period}
                                </span>
                            </div>
                            <ul className="space-y-3 mb-8">
                                {plan.features.map((feature, i) => (
                                    <li key={i} className="flex items-center gap-2">
                                        <Check size={16} className={plan.highlighted ? 'text-blue-200' : 'text-green-500'} />
                                        <span className={`text-sm ${plan.highlighted ? 'text-blue-100' : 'text-gray-600'}`}>
                                            {feature}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                            <Link href="/login">
                                <button
                                    className={`w-full py-3 rounded-lg font-semibold flex items-center justify-center gap-2 cursor-pointer ${plan.highlighted
                                            ? 'bg-white text-blue-600 hover:bg-blue-50'
                                            : 'bg-blue-600 text-white hover:bg-blue-700'
                                        }`}
                                >
                                    {plan.cta}
                                    <ArrowRight size={16} />
                                </button>
                            </Link>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
