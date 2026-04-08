import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import AdminLayout from '@/components/AdminLayout';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Settings, Save, AlertCircle } from 'lucide-react';

interface Settings {
  linkedinOptimizer: boolean;
  cvTailor: boolean;
  emailCampaign: boolean;
  freePlan: number;
  starterPlan: number;
  proPlan: number;
  elitePlan: number;
  token100Price: number;
  token500Price: number;
  token1000Price: number;
  dailyLimitFree: number;
  dailyLimitStarter: number;
  dailyLimitPro: number;
  dailyLimitElite: number;
}

const AdminSettings: React.FC = () => {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<Settings>({
    linkedinOptimizer: true,
    cvTailor: true,
    emailCampaign: true,
    freePlan: 0,
    starterPlan: 99,
    proPlan: 199,
    elitePlan: 299,
    token100Price: 50,
    token500Price: 200,
    token1000Price: 350,
    dailyLimitFree: 1,
    dailyLimitStarter: 5,
    dailyLimitPro: 20,
    dailyLimitElite: 999,
  });

  const [saved, setSaved] = useState(false);

  const handleToggleFeature = (feature: keyof Settings) => {
    if (typeof settings[feature] === 'boolean') {
      setSettings({
        ...settings,
        [feature]: !settings[feature],
      });
    }
  };

  const handleChange = (key: keyof Settings, value: any) => {
    setSettings({
      ...settings,
      [key]: value,
    });
  };

  const handleSave = async () => {
    // TODO: Save settings to backend
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <AdminLayout pageTitle={t('admin.settings')}>
      <div className="space-y-6 max-w-4xl">
        {/* Feature Flags */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5" />
              {t('admin.featureFlags')}
            </h3>

            <div className="space-y-4">
              {[
                {
                  key: 'linkedinOptimizer' as const,
                  label: t('admin.linkedinOptimizer'),
                },
                { key: 'cvTailor' as const, label: t('admin.cvTailor') },
                {
                  key: 'emailCampaign' as const,
                  label: t('admin.emailCampaign'),
                },
              ].map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between py-3 border-b border-[var(--border-subtle)] last:border-0"
                >
                  <label className="text-sm font-medium text-[var(--text-primary)]">
                    {item.label}
                  </label>
                  <button
                    onClick={() => handleToggleFeature(item.key)}
                    className={`relative w-14 h-8 rounded-full transition-colors ${
                      settings[item.key]
                        ? 'bg-[var(--accent-primary)]'
                        : 'bg-[var(--border-subtle)]'
                    }`}
                  >
                    <motion.div
                      animate={{
                        x: settings[item.key] ? '100%' : '0%',
                      }}
                      className="absolute top-1 left-1 w-6 h-6 bg-white rounded-full"
                    />
                  </button>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>

        {/* Plan Prices */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
              {t('admin.planPrices')}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { key: 'freePlan' as const, label: 'Free' },
                { key: 'starterPlan' as const, label: 'Starter' },
                { key: 'proPlan' as const, label: 'Pro' },
                { key: 'elitePlan' as const, label: 'Elite' },
              ].map((plan) => (
                <div key={plan.key}>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                    {plan.label} ({t('admin.sar')})
                  </label>
                  <Input
                    type="number"
                    min="0"
                    value={settings[plan.key]}
                    onChange={(e) =>
                      handleChange(plan.key, parseInt(e.target.value) || 0)
                    }
                  />
                </div>
              ))}
            </div>
          </Card>
        </motion.div>

        {/* Token Prices */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
              {t('admin.tokenPrices')}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { key: 'token100Price' as const, label: '100 Tokens' },
                { key: 'token500Price' as const, label: '500 Tokens' },
                { key: 'token1000Price' as const, label: '1000 Tokens' },
              ].map((token) => (
                <div key={token.key}>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                    {token.label} ({t('admin.sar')})
                  </label>
                  <Input
                    type="number"
                    min="0"
                    value={settings[token.key]}
                    onChange={(e) =>
                      handleChange(token.key, parseInt(e.target.value) || 0)
                    }
                  />
                </div>
              ))}
            </div>
          </Card>
        </motion.div>

        {/* Daily Limits */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
        >
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
              {t('admin.dailyLimits')}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                {
                  key: 'dailyLimitFree' as const,
                  label: 'Free {t("admin.limit")}',
                },
                {
                  key: 'dailyLimitStarter' as const,
                  label: 'Starter {t("admin.limit")}',
                },
                { key: 'dailyLimitPro' as const, label: 'Pro {t("admin.limit")}' },
                {
                  key: 'dailyLimitElite' as const,
                  label: 'Elite {t("admin.limit")}',
                },
              ].map((limit) => (
                <div key={limit.key}>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                    {limit.label.includes('{')
                      ? limit.label.split('{')[0]
                      : limit.label}
                  </label>
                  <Input
                    type="number"
                    min="1"
                    value={settings[limit.key]}
                    onChange={(e) =>
                      handleChange(limit.key, parseInt(e.target.value) || 1)
                    }
                  />
                </div>
              ))}
            </div>
          </Card>
        </motion.div>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            className="flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {t('common.save')}
          </Button>
        </div>

        {/* Success Message */}
        {saved && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-2 text-green-600"
          >
            <AlertCircle className="w-5 h-5" />
            <span className="text-sm font-medium">
              {t('admin.settingsSaved')}
            </span>
          </motion.div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminSettings;