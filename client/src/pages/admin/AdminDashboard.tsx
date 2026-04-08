import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/AdminLayout';
import { Card } from '@/components/ui/card';
import {
  Users, TrendingUp, Mail, Coins, DollarSign, Activity,
  CheckCircle, AlertCircle
} from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: 'primary' | 'secondary' | 'success' | 'warning';
}

const StatCard: React.FC<StatCardProps> = ({ label, value, icon, color }) => {
  const colorMap = {
    primary: 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]',
    secondary: 'bg-[var(--accent-secondary)]/10 text-[var(--accent-secondary)]',
    success: 'bg-green-500/10 text-green-600',
    warning: 'bg-orange-500/10 text-orange-600',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-[var(--text-secondary)] mb-2">{label}</p>
            <p className="text-3xl font-bold text-[var(--text-primary)]">{value}</p>
          </div>
          <div className={`p-3 rounded-lg ${colorMap[color]}`}>
            {icon}
          </div>
        </div>
      </Card>
    </motion.div>
  );
};

const HealthIndicator: React.FC<{ name: string; status: 'ok' | 'error' }> = ({
  name,
  status,
}) => {
  const isOk = status === 'ok';

  return (
    <div className="flex items-center justify-between py-3 border-b border-[var(--border-subtle)] last:border-0">
      <span className="text-sm text-[var(--text-secondary)]">{name}</span>
      <div className="flex items-center gap-2">
        <div
          className={`w-2 h-2 rounded-full ${
            isOk ? 'bg-green-500' : 'bg-red-500'
          }`}
        />
        <span className="text-xs font-medium text-[var(--text-secondary)]">
          {isOk ? 'OK' : 'Error'}
        </span>
      </div>
    </div>
  );
};

const AdminDashboard: React.FC = () => {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [stats, setStats] = useState({
    totalUsers: 156,
    activeUsers: 43,
    totalCampaigns: 89,
    emailsSent: 12450,
    tokensPurchased: 45000,
    mrr: 15400,
  });
  const [recentSignups, setRecentSignups] = useState([
    { id: '1', name: 'Ahmed Al-Rashid', email: 'ahmed@example.com', plan: 'pro', createdAt: '2 hours ago' },
    { id: '2', name: 'Fatima Al-Zahrani', email: 'fatima@example.com', plan: 'starter', createdAt: '4 hours ago' },
    { id: '3', name: 'Mohammed Al-Otaibi', email: 'mohammed@example.com', plan: 'free', createdAt: '6 hours ago' },
    { id: '4', name: 'Noor Al-Dosari', email: 'noor@example.com', plan: 'elite', createdAt: '1 day ago' },
    { id: '5', name: 'Layla Al-Kharji', email: 'layla@example.com', plan: 'starter', createdAt: '2 days ago' },
  ]);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // TODO: Fetch real stats from backend
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <AdminLayout pageTitle={t('admin.dashboard')}>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-[var(--accent-secondary)] border-t-[var(--accent-primary)] rounded-full animate-spin mx-auto mb-4" />
            <p className="text-[var(--text-secondary)]">{t('common.loading')}</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout pageTitle={t('admin.dashboard')}>
      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard
            label={t('admin.totalUsers')}
            value={stats.totalUsers}
            icon={<Users className="w-6 h-6" />}
            color="primary"
          />
          <StatCard
            label={t('admin.activeUsers')}
            value={stats.activeUsers}
            icon={<TrendingUp className="w-6 h-6" />}
            color="success"
          />
          <StatCard
            label={t('admin.totalCampaigns')}
            value={stats.totalCampaigns}
            icon={<Mail className="w-6 h-6" />}
            color="secondary"
          />
          <StatCard
            label={t('admin.emailsSent')}
            value={stats.emailsSent.toLocaleString()}
            icon={<Activity className="w-6 h-6" />}
            color="warning"
          />
          <StatCard
            label={t('admin.tokensPurchased')}
            value={stats.tokensPurchased.toLocaleString()}
            icon={<Coins className="w-6 h-6" />}
            color="primary"
          />
          <StatCard
            label={t('admin.mrr')}
            value={`${stats.mrr.toLocaleString()} SAR`}
            icon={<DollarSign className="w-6 h-6" />}
            color="success"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* System Health */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                {t('admin.systemHealth')}
              </h3>
              <div className="space-y-1">
                <HealthIndicator name={t('admin.claudeApi')} status="ok" />
                <HealthIndicator name={t('admin.apify')} status="ok" />
                <HealthIndicator name={t('admin.supabase')} status="ok" />
                <HealthIndicator name={t('admin.sendGrid')} status="ok" />
              </div>
            </Card>
          </motion.div>

          {/* Recent Signups */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="lg:col-span-2"
          >
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                <Users className="w-5 h-5" />
                {t('admin.recentSignups')}
              </h3>
              <div className="space-y-3">
                {recentSignups.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between py-3 border-b border-[var(--border-subtle)] last:border-0"
                  >
                    <div>
                      <p className="font-medium text-[var(--text-primary)]">
                        {user.name}
                      </p>
                      <p className="text-sm text-[var(--text-secondary)]">
                        {user.email}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="inline-block px-2 py-1 text-xs font-semibold rounded bg-[var(--accent-primary)] bg-opacity-20 text-[var(--accent-primary)] mb-1">
                        {user.plan.charAt(0).toUpperCase() + user.plan.slice(1)}
                      </span>
                      <p className="text-xs text-[var(--text-secondary)]">
                        {user.createdAt}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;