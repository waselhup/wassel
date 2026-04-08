import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { motion } from 'framer-motion';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Coins, Zap, FileText, Mail, TrendingUp, Lock } from 'lucide-react';

interface Transaction {
  id: string;
  created_at: string;
  type: 'purchase' | 'usage';
  amount: number;
  description: string;
  status: 'completed' | 'pending';
}

const Tokens: React.FC = () => {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchTransactions();
    }
  }, [user]);

  const fetchTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from('token_transactions')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && data) {
        setTransactions(data);
      }
    } catch (err) {
      console.error('Error fetching transactions:', err);
    } finally {
      setLoading(false);
    }
  };
  const packages = [
    { tokens: 100, price: 50, savings: 0 },
    { tokens: 500, price: 200, savings: 10 },
    { tokens: 1000, price: 350, savings: 25 },
  ];

  const costs = [
    {
      label: t('tokens.linkedinAnalysis'),
      cost: 5,
      icon: Zap,
      color: 'text-[var(--accent-secondary)]',
    },
    {
      label: t('tokens.cvTailor'),
      cost: 10,
      icon: FileText,
      color: 'text-blue-600',
    },
    {
      label: t('tokens.emailCampaign'),
      cost: 1,
      icon: Mail,
      color: 'text-green-600',
    },
  ];

  const getTransactionBadgeColor = (type: string) => {
    if (type === 'purchase') return 'success';
    return 'warning';
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };
  return (
    <DashboardLayout pageTitle={t('tokens.title')}>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >
        {/* Balance card */}
        <motion.div variants={itemVariants}>
          <Card className="bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-white">
            <CardContent className="p-8">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/80 mb-2">{t('tokens.balance')}</p>
                  <h2 className="text-5xl font-bold font-cairo">
                    {profile?.token_balance || 0}
                  </h2>
                </div>
                <Coins className="w-24 h-24 text-white/20" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Service costs */}
        <motion.div variants={itemVariants}>
          <h3 className="text-xl font-cairo font-semibold text-[var(--text-primary)] mb-4">
            {t('tokens.costs')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {costs.map((cost, idx) => {
              const Icon = cost.icon;
              return (
                <Card key={idx}>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-lg bg-[var(--bg-surface)] flex items-center justify-center">
                        <Icon className={`w-6 h-6 ${cost.color}`} />
                      </div>
                      <h4 className="font-semibold text-[var(--text-primary)]">
                        {cost.label}
                      </h4>
                    </div>
                    <p className="text-3xl font-bold text-[var(--accent-primary)]">
                      {cost.cost}
                    </p>
                    <p className="text-xs text-[var(--text-secondary)] mt-1">
                      {t('tokens.tokens')}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </motion.div>
        {/* Purchase section */}
        <motion.div variants={itemVariants}>
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-cairo font-semibold text-[var(--text-primary)]">
                {t('tokens.packages')}
              </h3>
              <Badge variant="warning" className="flex items-center gap-2">
                <Lock className="w-3 h-3" />
                {t('tokens.coming')}
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {packages.map((pkg, idx) => (
                <Card key={idx} className="relative overflow-hidden hover:shadow-lg transition-shadow">
                  {pkg.savings > 0 && (
                    <div className="absolute top-0 right-0 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                      Save {pkg.savings}%
                    </div>
                  )}
                  <CardContent className="p-6">
                    <div className="text-center space-y-4">
                      <div>
                        <p className="text-sm text-[var(--text-secondary)] mb-2">
                          {t('tokens.tokens')}
                        </p>
                        <p className="text-4xl font-bold text-[var(--accent-primary)]">
                          {pkg.tokens}
                        </p>
                      </div>

                      <div className="border-t border-b border-[var(--border-subtle)] py-4">
                        <p className="text-3xl font-bold text-[var(--text-primary)]">
                          {pkg.price}
                        </p>
                        <p className="text-sm text-[var(--text-secondary)]">SAR</p>
                      </div>

                      <Button
                        disabled
                        className="w-full opacity-50 cursor-not-allowed"
                      >
                        {t('tokens.coming')}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </motion.div>
        {/* Transaction history */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle className="font-cairo flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                {t('tokens.transactionHistory')}
              </CardTitle>
              <CardDescription>
                {transactions.length} {t('tokens.transactions')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">
                  <p className="text-[var(--text-secondary)]">{t('common.loading')}</p>
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-8">
                  <Coins className="w-12 h-12 text-[var(--text-secondary)] opacity-50 mx-auto mb-3" />
                  <p className="text-[var(--text-secondary)]">
                    {t('tokens.noTransactions')}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border-subtle)]">
                        <th className="text-left py-3 px-4 font-semibold text-[var(--text-secondary)]">
                          {t('tokens.date')}
                        </th>
                        <th className="text-left py-3 px-4 font-semibold text-[var(--text-secondary)]">
                          {t('tokens.type')}
                        </th>
                        <th className="text-right py-3 px-4 font-semibold text-[var(--text-secondary)]">
                          {t('tokens.amount')}
                        </th>
                        <th className="text-left py-3 px-4 font-semibold text-[var(--text-secondary)]">
                          {t('tokens.description')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((tx, idx) => (
                        <tr
                          key={tx.id}
                          className={`border-b border-[var(--border-subtle)] ${
                            idx % 2 === 0 ? 'bg-[var(--bg-surface)]' : ''
                          }`}
                        >
                          <td className="py-3 px-4">
                            {new Date(tx.created_at).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4">
                            <Badge
                              variant={getTransactionBadgeColor(tx.type)}
                              className="capitalize"
                            >
                              {tx.type}
                            </Badge>
                          </td>
                          <td className={`py-3 px-4 text-right font-semibold ${
                            tx.type === 'purchase'
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}>
                            {tx.type === 'purchase' ? '+' : '-'}{tx.amount}
                          </td>
                          <td className="py-3 px-4 text-[var(--text-secondary)]">
                            {tx.description}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </DashboardLayout>
  );
};

export default Tokens;