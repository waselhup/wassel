import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import { trpc } from '@/lib/trpc';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlan?: string;
}

export default function PricingModal({ isOpen, onClose, currentPlan = 'starter' }: PricingModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const { mutate: requestUpgrade, isPending } = trpc.billing.requestUpgrade.useMutation();

  if (!isOpen) return null;

  const plans = [
    {
      id: 'starter',
      nameAr: 'المبتدئ',
      priceAr: 'مجاني',
      monthlyLeadLimit: 100,
      maxCampaigns: 3,
      features: [
        'حتى 100 عميل شهرياً',
        '3 حملات',
        'تحليلات أساسية',
        'دعم البريد الإلكتروني',
      ],
      color: 'blue',
    },
    {
      id: 'pro',
      nameAr: 'احترافي',
      priceAr: '99 ر.س/شهر',
      monthlyLeadLimit: 500,
      maxCampaigns: 10,
      features: [
        'حتى 500 عميل شهرياً',
        '10 حملات',
        'تحليلات متقدمة',
        'دعم أولوي',
        'عرض متعدد العملاء',
        'العمليات الجماعية',
      ],
      color: 'purple',
      popular: true,
    },
    {
      id: 'agency',
      nameAr: 'وكالة',
      priceAr: '499 ر.س/شهر',
      monthlyLeadLimit: 5000,
      maxCampaigns: 100,
      features: [
        'حتى 5000 عميل شهرياً',
        'حملات غير محدودة',
        'تحليلات مخصصة',
        'دعم 24/7',
        'إدارة متعددة العملاء',
        'وصول API',
      ],
      color: 'gold',
    },
  ];

  const handleUpgrade = (planId: string) => {
    if (planId !== 'starter') {
      requestUpgrade(
        { targetPlan: planId as 'pro' | 'agency' },
        {
          onSuccess: () => {
            alert('تم استقبال طلبك. سيتواصل معك فريقنا قريباً.');
            onClose();
          },
        }
      );
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" dir="rtl">
      <div className="bg-[var(--bg-card)] rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">خطط وصل</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={24} className="text-gray-600" />
          </button>
        </div>

        {/* Plans Grid */}
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map(plan => (
              <div
                key={plan.id}
                className={`relative rounded-lg border-2 transition-all ${
                  currentPlan === plan.id
                    ? 'border-blue-600 bg-blue-50'
                    : plan.popular
                    ? 'border-purple-600 bg-purple-50'
                    : 'border-gray-200 bg-[var(--bg-card)]'
                } p-6`}
              >
                {/* Popular Badge */}
                {plan.popular && (
                  <div className="absolute -top-3 right-4 bg-purple-600 text-white px-3 py-1 rounded-full text-xs font-medium">
                    الأكثر شيوعاً
                  </div>
                )}

                {/* Current Plan Badge */}
                {currentPlan === plan.id && (
                  <div className="absolute -top-3 right-4 bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-medium">
                    خطتك الحالية
                  </div>
                )}

                {/* Plan Name */}
                <h3 className="text-xl font-bold text-gray-900 mb-2">{plan.nameAr}</h3>

                {/* Price */}
                <div className="mb-4">
                  <span className="text-3xl font-bold text-gray-900">{plan.priceAr}</span>
                </div>

                {/* Limits */}
                <div className="bg-[var(--bg-base)] rounded-lg p-3 mb-4 text-sm text-gray-700">
                  <div>• {plan.monthlyLeadLimit} عميل/شهر</div>
                  <div>• {plan.maxCampaigns} حملات</div>
                </div>

                {/* Features */}
                <div className="space-y-2 mb-6">
                  {plan.features.map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <Check size={18} className="text-green-600 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-700">{feature}</span>
                    </div>
                  ))}
                </div>

                {/* CTA Button */}
                {currentPlan === plan.id ? (
                  <button
                    disabled
                    className="w-full py-2 bg-gray-300 text-gray-700 rounded-lg font-medium cursor-not-allowed"
                  >
                    خطتك الحالية
                  </button>
                ) : plan.id === 'starter' ? (
                  <button
                    disabled
                    className="w-full py-2 bg-gray-100 text-gray-700 rounded-lg font-medium cursor-not-allowed"
                  >
                    مجاني
                  </button>
                ) : (
                  <button
                    onClick={() => handleUpgrade(plan.id)}
                    disabled={isPending}
                    className="w-full py-2 bg-[#8B5CF6] text-white rounded-lg font-medium hover:bg-[#7C3AED] transition-colors disabled:opacity-50"
                  >
                    {isPending ? 'جاري المعالجة...' : 'تواصل معنا للترقية'}
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg text-center">
            <p className="text-sm text-blue-900">
              هل تحتاج مساعدة؟{' '}
              <a href="https://wa.me/966XXXXXXXXX" className="font-medium underline">
                تواصل معنا عبر WhatsApp
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
