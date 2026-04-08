import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { motion } from 'framer-motion';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { User, Coins, CheckCircle, AlertCircle } from 'lucide-react';

const Profile: React.FC = () => {
  const { t } = useTranslation();
  const { user, profile, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    fullName: profile?.full_name || '',
    email: profile?.email || '',
    title: profile?.title || '',
    company: profile?.company || '',
    phone: profile?.phone || '',
    location: profile?.location || '',
    linkedinUrl: profile?.linkedin_url || '',
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        fullName: profile.full_name || '',
        email: profile.email || '',
        title: profile.title || '',
        company: profile.company || '',
        phone: profile.phone || '',
        location: profile.location || '',
        linkedinUrl: profile.linkedin_url || '',
      });
    }
  }, [profile]);
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setSaved(false);
    setError('');
  };

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    setSaved(false);

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: formData.fullName,
          title: formData.title,
          company: formData.company,
          phone: formData.phone,
          location: formData.location,
          linkedin_url: formData.linkedinUrl,
        })
        .eq('id', user.id);

      if (updateError) {
        setError(t('profile.error'));
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (err) {
      setError(t('profile.error'));
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <DashboardLayout pageTitle={t('profile.title')}>
        <div className="flex items-center justify-center h-96">
          <p className="text-[var(--text-secondary)]">{t('common.loading')}</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout pageTitle={t('profile.title')}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="max-w-2xl space-y-6"
      >
        {/* Header */}
        <div className="flex items-center gap-4 p-6 bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] rounded-lg text-white">
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold">
            {profile?.full_name?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-cairo font-bold">{profile?.full_name || 'User'}</h1>
            <p className="text-white/80">{profile?.email}</p>
          </div>
        </div>
        {/* Profile Information */}
        <Card>
          <CardHeader>
            <CardTitle className="font-cairo flex items-center gap-2">
              <User className="w-5 h-5" />
              {t('profile.editProfile')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                  {t('profile.fullName')}
                </label>
                <Input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  placeholder={t('profile.fullName')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                  {t('profile.email')}
                </label>
                <Input
                  type="email"
                  value={formData.email}
                  disabled
                  placeholder={t('profile.email')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                  {t('profile.title')}
                </label>
                <Input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  placeholder={t('profile.title')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                  {t('profile.company')}
                </label>
                <Input
                  type="text"
                  name="company"
                  value={formData.company}
                  onChange={handleInputChange}
                  placeholder={t('profile.company')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                  {t('profile.phone')}
                </label>
                <Input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder={t('profile.phone')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                  {t('profile.location')}
                </label>
                <Input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  placeholder={t('profile.location')}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                {t('profile.linkedinUrl')}
              </label>
              <Input
                type="url"
                name="linkedinUrl"
                value={formData.linkedinUrl}
                onChange={handleInputChange}
                placeholder="https://linkedin.com/in/..."
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            {saved && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-sm text-green-700">
                <CheckCircle className="w-4 h-4" />
                {t('profile.saved')}
              </div>
            )}

            <Button
              onClick={handleSave}
              disabled={loading}
              className="w-full"
            >
              {loading ? t('common.loading') : t('profile.saveChanges')}
            </Button>
          </CardContent>
        </Card>
        {/* Account Plan */}
        <Card>
          <CardHeader>
            <CardTitle className="font-cairo">{t('profile.currentPlan')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-[var(--bg-surface)] rounded-lg">
              <div>
                <p className="font-semibold text-[var(--text-primary)] capitalize">
                  {profile?.plan || 'free'} {t('common.plan')}
                </p>
                <p className="text-sm text-[var(--text-secondary)]">
                  {profile?.plan === 'free'
                    ? 'Basic access to Wassel'
                    : 'Premium features unlocked'}
                </p>
              </div>
              <Badge className="capitalize">{profile?.plan || 'free'}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Token Balance */}
        <Card>
          <CardHeader>
            <CardTitle className="font-cairo flex items-center gap-2">
              <Coins className="w-5 h-5" />
              {t('profile.tokenBalance')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-[var(--accent-primary)] from-opacity-10 to-[var(--accent-secondary)] to-opacity-10 rounded-lg">
              <div>
                <p className="text-sm text-[var(--text-secondary)] mb-1">
                  {t('tokens.balance')}
                </p>
                <p className="text-3xl font-bold text-[var(--accent-primary)]">
                  {profile?.token_balance || 0}
                </p>
              </div>
              <Button
                onClick={() => window.location.href = '/app/tokens'}
                className="bg-[var(--accent-primary)]"
              >
                {t('tokens.purchase')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </DashboardLayout>
  );
};

export default Profile;