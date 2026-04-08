import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Coins, Zap, FileText, Mail, AlertCircle, TrendingUp, CheckCircle
} from 'lucide-react';

const DashboardHome: React.FC = () => {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [, navigate] = useLocation();

  const isSetupComplete = profile?.linkedin_url && profile?.resume_url;

  const stats = [
    {
      title: t('dashboard.tokenBalance'),
      value: profile?.token_balance || 0,
      icon: Coins,
      color: 'text-[var(--accent-primary)]',
      bgColor: 'bg-[var(--accent-primary)] bg-opacity-10',
    },
    {
      title: t('dashboard.linkedinScore'),
      value: profile?.linkedin_score ? `${profile.linkedin_score}%` : t('dashboard.notAnalyzed'),
      icon: Zap,
      color: 'text-[var(--accent-secondary)]',
      bgColor: 'bg-[var(--accent-secondary)] bg-opacity-10',
    },
    {
      title: t('dashboard.cvsGenerated'),
      value: profile?.cvs_generated || 0,
      icon: FileText,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: t('dashboard.campaignsSent'),
      value: profile?.campaigns_sent || 0,
      icon: Mail,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
  ];
  const quickActions = [
    {
      label: t('dashboard.analyzeLinkedin'),
      icon: Zap,
      href: '/app/linkedin',
      color: 'bg-[var(--accent-secondary)]',
    },
    {
      label: t('dashboard.createCv'),
      icon: FileText,
      href: '/app/cv',
      color: 'bg-blue-600',
    },
    {
      label: t('dashboard.newCampaign'),
      icon: Mail,
      href: '/app/campaigns/new',
      color: 'bg-green-600',
    },
  ];

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
    <DashboardLayout pageTitle={t('dashboard.home')}>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >
        {/* Welcome section */}
        <motion.div variants={itemVariants}>
          <div className="mb-6">
            <h1 className="text-3xl font-cairo font-bold text-[var(--text-primary)] mb-2">
              {t('dashboard.welcomeBack')}, {profile?.full_name?.split(' ')[0]}!
            </h1>
            <p className="text-[var(--text-secondary)]">
              {t('dashboard.subtitle')}
            </p>
          </div>
        </motion.div>

        {/* Setup reminder */}
        {!isSetupComplete && (
          <motion.div variants={itemVariants}>
            <Card className="border-yellow-200 bg-yellow-50">
              <CardContent className="p-4 flex items-center gap-4">
                <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-yellow-900">
                    {t('dashboard.completeSetup')}
                  </p>
                  <p className="text-sm text-yellow-800">
                    {t('dashboard.completeSetupDesc')}
                  </p>
                </div>
                <Button
                  onClick={() => navigate('/app/setup')}
                  size="sm"
                  className="bg-yellow-600 hover:bg-yellow-700"
                >
                  {t('common.next')}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
        {/* Stats grid */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, idx) => {
            const Icon = stat.icon;
            return (
              <Card key={idx}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-[var(--text-secondary)] mb-2">
                        {stat.title}
                      </p>
                      <p className="text-3xl font-bold text-[var(--text-primary)]">
                        {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
                      </p>
                    </div>
                    <div className={`${stat.bgColor} p-3 rounded-lg`}>
                      <Icon className={`w-6 h-6 ${stat.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </motion.div>

        {/* Quick actions */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {quickActions.map((action, idx) => {
            const Icon = action.icon;
            return (
              <Card key={idx} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6 text-center">
                  <div className={`${action.color} w-12 h-12 rounded-lg flex items-center justify-center text-white mx-auto mb-4`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="font-semibold text-[var(--text-primary)] mb-3">
                    {action.label}
                  </h3>
                  <Button
                    onClick={() => navigate(action.href)}
                    variant="outline"
                    className="w-full"
                    size="sm"
                  >
                    {t('common.next')}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </motion.div>

        {/* Recent activity */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle className="font-cairo">
                {t('dashboard.recentActivity')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {!isSetupComplete ? (
                  <div className="flex items-center gap-4 p-4 bg-[var(--bg-surface)] rounded-lg">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-[var(--text-primary)]">
                        {t('onboarding.step1Title')}
                      </p>
                      <p className="text-sm text-[var(--text-secondary)]">
                        {t('onboarding.step1Description')}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
                    <p className="text-[var(--text-secondary)]">
                      {t('onboarding.setupComplete')}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </DashboardLayout>
  );
};

export default DashboardHome;