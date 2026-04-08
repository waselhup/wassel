import React from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'wouter';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Globe, LogOut, Zap, FileText, Mail, BarChart3 } from 'lucide-react';

const Dashboard: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [, navigate] = useLocation();
  const { profile, signOut } = useAuth();

  const handleLogout = async () => {
    const { error } = await signOut();
    if (!error) {
      navigate('/');
    }
  };

  const toggleLanguage = () => {
    const newLang = i18n.language === 'ar' ? 'en' : 'ar';
    i18n.changeLanguage(newLang);
    document.documentElement.lang = newLang;
    document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr';
  };

  const features = [
    {
      icon: Zap,
      title: t('features.phase1.title'),
      description: t('features.phase1.description'),
      coming: true,
    },
    {
      icon: FileText,
      title: t('features.phase2.title'),
      description: t('features.phase2.description'),
      coming: true,
    },
    {
      icon: Mail,
      title: t('dashboard.campaigns'),
      description: t('dashboard.campaignsDesc'),
      coming: true,
    },
    {
      icon: BarChart3,
      title: t('dashboard.analytics'),
      description: t('dashboard.analyticsDesc'),
      coming: true,
    },
  ];
  return (
    <div className="min-h-screen bg-[var(--bg-surface)]">
      <header className="bg-[var(--bg-base)] border-b border-[var(--border-subtle)] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-cairo font-bold text-[var(--accent-primary)]">
              وصّل
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={toggleLanguage}
              className="p-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:bg-[var(--bg-surface-hover)] transition-colors flex items-center gap-2 text-sm text-[var(--text-secondary)]"
            >
              <Globe className="w-4 h-4" />
              {i18n.language === 'ar' ? 'EN' : 'AR'}
            </button>

            <Button
              onClick={handleLogout}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              {t('nav.logout')}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-cairo font-bold text-[var(--text-primary)] mb-2">
            {t('dashboard.welcome')}, {profile?.full_name || 'Professional'}!
          </h2>
          <p className="text-[var(--text-secondary)]">
            {t('dashboard.subtitle')}
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, idx) => {
            const Icon = feature.icon;
            return (
              <Card
                key={idx}
                className="p-6 hover:shadow-lg transition-shadow cursor-pointer group"
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 bg-[var(--accent-secondary)] bg-opacity-10 rounded-lg flex items-center justify-center group-hover:bg-opacity-20 transition-colors">
                      <Icon className="w-6 h-6 text-[var(--accent-secondary)]" />
                    </div>
                    {feature.coming && (
                      <span className="text-xs font-semibold px-2 py-1 bg-[var(--warning)] bg-opacity-10 text-[var(--warning)] rounded">
                        {t('dashboard.comingSoon')}
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="font-cairo font-semibold text-[var(--text-primary)] mb-1">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-[var(--text-secondary)]">
                      {feature.description}
                    </p>
                  </div>

                  <div className="pt-2">
                    <Button
                      disabled
                      variant="outline"
                      size="sm"
                      className="w-full opacity-50 cursor-not-allowed"
                    >
                      {t('common.comingSoon')}
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        <div className="mt-12 p-8 bg-[var(--accent-primary)] bg-opacity-5 border border-[var(--accent-primary)] border-opacity-20 rounded-lg text-center">
          <h3 className="text-xl font-cairo font-semibold text-[var(--text-primary)] mb-2">
            {t('dashboard.betaMessage')}
          </h3>
          <p className="text-[var(--text-secondary)] max-w-2xl mx-auto">
            {t('dashboard.betaDescription')}
          </p>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;