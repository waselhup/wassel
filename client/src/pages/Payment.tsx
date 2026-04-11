import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Coins, CreditCard, Apple, AlertCircle, TrendingUp, History, Info
} from 'lucide-react';

interface TokenPackage {
  tokens: number;
  price: number;
  savings?: number;
}

interface SubscriptionPlan {
  name: string;
  price: number;
  tokens: number;
  features: string[];
}

const Payment: React.FC = () => {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [selectedTab, setSelectedTab] = useState<'tokens' | 'subscription'>(
    'tokens'
  );
  const [selectedPackage, setSelectedPackage] = useState<number | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  const enablePayments = import.meta.env.VITE_ENABLE_PAYMENTS === 'true';

  const tokenPackages: TokenPackage[] = [
    { tokens: 100, price: 50 },
    { tokens: 500, price: 200, savings: 10 },
    { tokens: 1000, price: 350, savings: 30 },
  ];

  const subscriptionPlans: SubscriptionPlan[] = [
    {
      name: 'free',
      price: 0,
      tokens: 0,
      features: [
        t('payment.featureLimited'),
        t('payment.feature1Analysis'),
        t('payment.feature1Campaign'),
      ],
    },
    {
      name: 'starter',
      price: 99,
      tokens: 500,
      features: [
        t('payment.featureUnlimited'),
        t('payment.feature5Analyses'),
        t('payment.feature5Campaigns'),
        t('payment.featurePriority'),
      ],
    },
    {
      name: 'pro',
      price: 199,
      tokens: 1500,
      features: [
        t('payment.featureUnlimited'),
        t('payment.feature15Analyses'),
        t('payment.feature20Campaigns'),
        t('payment.featurePriority'),
        t('payment.featureAnalytics'),
      ],
    },
    {
      name: 'elite',
      price: 299,
      tokens: 5000,
      features: [
        t('payment.featureUnlimited'),
        t('payment.featureUnlimitedAnalyses'),
        t('payment.featureUnlimitedCampaigns'),
        t('payment.featurePriority'),
        t('payment.featureAnalytics'),
        t('payment.featureDedicatedSupport'),
      ],
    },
  ];
  const mockTransactions = [
    {
      id: '1',
      date: '2024-03-10',
      type: 'purchase',
      amount: 50,
      tokens: 100,
      status: 'completed',
    },
    {
      id: '2',
      date: '2024-02-28',
      type: 'spend',
      amount: -5,
      tokens: -50,
      status: 'completed',
    },
    {
      id: '3',
      date: '2024-02-20',
      type: 'purchase',
      amount: 200,
      tokens: 500,
      status: 'completed',
    },
  ];

  if (!enablePayments) {
    return (
      <DashboardLayout pageTitle={t('payment.title')}>
        <div className="max-w-2xl mx-auto">
          <Card className="p-12 text-center">
            <AlertCircle className="w-16 h-16 mx-auto mb-4 text-[var(--accent-primary)]" />
            <h2 className="text-2xl font-semibold text-[var(--text-primary)] mb-2">
              {t('payment.comingSoon')}
            </h2>
            <p className="text-[var(--text-secondary)] mb-4">
              {t('payment.comingSoonDesc')}
            </p>
            <p className="text-sm text-[var(--text-secondary)]">
              {t('payment.contactSupport')}
            </p>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout pageTitle={t('payment.title')}>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Current Balance */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="p-6 bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-primary)]/80">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 mb-2">{t('payment.currentBalance')}</p>
                <p className="text-4xl font-bold text-white">
                  {profile?.token_balance || 0}
                </p>
                <p className="text-sm text-white/80 mt-1">
                  {t('payment.tokensAvailable')}
                </p>
              </div>
              <Coins className="w-16 h-16 text-white/30" />
            </div>
          </Card>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-[var(--border-subtle)]">
          <button
            onClick={() => setSelectedTab('tokens')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              selectedTab === 'tokens'
                ? 'border-[var(--accent-primary)] text-[var(--accent-primary)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {t('payment.tokens')}
          </button>
          <button
            onClick={() => setSelectedTab('subscription')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              selectedTab === 'subscription'
                ? 'border-[var(--accent-primary)] text-[var(--accent-primary)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {t('payment.subscription')}
          </button>
        </div>
        {/* Tokens Tab */}
        {selectedTab === 'tokens' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <Card className="p-4 bg-blue-50 border border-blue-200 flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-900">
                  {t('payment.tokenInfo')}
                </p>
                <p className="text-xs text-blue-800 mt-1">
                  {t('payment.tokenInfoDesc')}
                </p>
              </div>
            </Card>

            <div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
                {t('payment.packages')}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {tokenPackages.map((pkg, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: idx * 0.1 }}
                  >
                    <Card
                      className={`p-6 cursor-pointer transition-all ${
                        selectedPackage === idx
                          ? 'ring-2 ring-[var(--accent-primary)]'
                          : 'hover:shadow-lg'
                      }`}
                      onClick={() => setSelectedPackage(idx)}
                    >
                      <div className="text-center space-y-4">
                        <div>
                          <p className="text-3xl font-bold text-[var(--text-primary)]">
                            {pkg.tokens}
                          </p>
                          <p className="text-sm text-[var(--text-secondary)]">
                            {t('payment.tokensLabel')}
                          </p>
                        </div>

                        <div className="py-4 border-t border-b border-[var(--border-subtle)]">
                          <p className="text-2xl font-bold text-[var(--accent-primary)]">
                            {pkg.price} {t('payment.sar')}
                          </p>
                          {pkg.savings && (
                            <p className="text-xs text-green-600 font-semibold mt-1">
                              {t('payment.save')} {pkg.savings}%
                            </p>
                          )}
                        </div>

                        <Button
                          className="w-full"
                          variant={selectedPackage === idx ? 'default' : 'outline'}
                        >
                          {t('payment.select')}
                        </Button>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Payment Method (Placeholder) */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
                {t('payment.paymentMethod')}
              </h3>
              <div className="space-y-3">
                <Button
                  disabled
                  className="w-full flex items-center justify-center gap-2"
                >
                  <Apple className="w-5 h-5" />
                  {t('payment.applyPay')}
                </Button>
                <Button
                  disabled
                  className="w-full flex items-center justify-center gap-2"
                >
                  <CreditCard className="w-5 h-5" />
                  {t('payment.visaMada')}
                </Button>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-4">
                {t('payment.paymentNote')}
              </p>
            </Card>
          </motion.div>
        )}
        {/* Subscription Tab */}
        {selectedTab === 'subscription' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {subscriptionPlans.map((plan, idx) => (
                <motion.div
                  key={plan.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: idx * 0.1 }}
                >
                  <Card
                    className={`p-6 cursor-pointer transition-all flex flex-col ${
                      selectedPlan === plan.name
                        ? 'ring-2 ring-[var(--accent-primary)]'
                        : 'hover:shadow-lg'
                    }`}
                    onClick={() => setSelectedPlan(plan.name)}
                  >
                    <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2 capitalize">
                      {plan.name}
                    </h3>

                    <div className="mb-4">
                      <p className="text-2xl font-bold text-[var(--accent-primary)]">
                        {plan.price} {t('payment.sar')}
                      </p>
                      <p className="text-xs text-[var(--text-secondary)]">
                        {t('payment.monthly')}
                      </p>
                    </div>

                    {plan.tokens > 0 && (
                      <div className="mb-4 pb-4 border-b border-[var(--border-subtle)]">
                        <p className="text-sm font-medium text-[var(--text-primary)]">
                          {plan.tokens} {t('payment.includedTokens')}
                        </p>
                      </div>
                    )}

                    <ul className="space-y-2 flex-1 mb-4">
                      {plan.features.map((feature, fidx) => (
                        <li
                          key={fidx}
                          className="text-sm text-[var(--text-secondary)] flex items-start gap-2"
                        >
                          <span className="text-[var(--accent-primary)] font-bold">
                            ✓
                          </span>
                          {feature}
                        </li>
                      ))}
                    </ul>

                    <Button
                      disabled
                      className="w-full"
                      variant={selectedPlan === plan.name ? 'default' : 'outline'}
                    >
                      {t('payment.subscribe')}
                    </Button>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
        {/* Transaction History */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
        >
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
              <History className="w-5 h-5" />
              {t('payment.transactionHistory')}
            </h3>

            <div className="space-y-3">
              {mockTransactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between py-3 border-b border-[var(--border-subtle)] last:border-0"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        tx.type === 'purchase'
                          ? 'bg-green-500/20'
                          : 'bg-teal-600/20'
                      }`}
                    >
                      <TrendingUp
                        className={`w-5 h-5 ${
                          tx.type === 'purchase'
                            ? 'text-green-600'
                            : 'text-teal-700'
                        }`}
                      />
                    </div>
                    <div>
                      <p className="font-medium text-[var(--text-primary)]">
                        {tx.type === 'purchase'
                          ? t('payment.purchase')
                          : t('payment.spend')}
                      </p>
                      <p className="text-xs text-[var(--text-secondary)]">
                        {tx.date}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p
                      className={`font-semibold ${
                        tx.type === 'purchase'
                          ? 'text-green-600'
                          : 'text-teal-700'
                      }`}
                    >
                      {tx.type === 'purchase' ? '+' : ''}{tx.tokens}
                    </p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {Math.abs(tx.amount)} {t('payment.sar')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      </div>
    </DashboardLayout>
  );
};

export default Payment;