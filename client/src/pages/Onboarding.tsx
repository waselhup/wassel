import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Upload, CheckCircle, ChevronRight } from 'lucide-react';

type Step = 1 | 2 | 3;

interface FormData {
  fullName: string;
  title: string;
  company: string;
  phone: string;
  location: string;
  linkedinUrl: string;
  resumeFile: File | null;
}

const Onboarding: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { user, profile } = useAuth();
  const [, navigate] = useLocation();
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState<FormData>({
    fullName: profile?.full_name || '',
    title: profile?.title || '',
    company: profile?.company || '',
    phone: profile?.phone || '',
    location: profile?.location || '',
    linkedinUrl: profile?.linkedin_url || '',
    resumeFile: null,
  });
  const isArabic = i18n.language === 'ar';

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const validateStep1 = () => {
    if (!formData.fullName.trim()) {
      setError(t('onboarding.fullName'));
      return false;
    }
    if (!formData.title.trim()) {
      setError(t('onboarding.title'));
      return false;
    }
    if (!formData.company.trim()) {
      setError(t('onboarding.company'));
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!formData.linkedinUrl.trim()) {
      setError(t('onboarding.linkedinUrl'));
      return false;
    }
    if (!formData.linkedinUrl.includes('linkedin.com/in/')) {
      setError(t('onboarding.linkedinInvalid'));
      return false;
    }
    return true;
  };

  const saveStep1 = async () => {
    if (!validateStep1()) return false;
    if (!user) return false;

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: formData.fullName,
          title: formData.title,
          company: formData.company,
          phone: formData.phone,
          location: formData.location,
        })
        .eq('id', user.id);

      if (updateError) {
        setError(t('common.error'));
        return false;
      }
      return true;
    } catch (err) {
      setError(t('common.error'));
      return false;
    }
  };
  const saveStep2 = async () => {
    if (!validateStep2()) return false;
    if (!user) return false;

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          linkedin_url: formData.linkedinUrl,
        })
        .eq('id', user.id);

      if (updateError) {
        setError(t('common.error'));
        return false;
      }
      return true;
    } catch (err) {
      setError(t('common.error'));
      return false;
    }
  };

  const handleNext = async () => {
    setLoading(true);
    setError('');

    if (currentStep === 1) {
      const saved = await saveStep1();
      if (saved) {
        setCurrentStep(2);
      }
    } else if (currentStep === 2) {
      const saved = await saveStep2();
      if (saved) {
        setCurrentStep(3);
      }
    }

    setLoading(false);
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as Step);
      setError('');
    }
  };

  const handleSkip = async () => {
    if (currentStep < 3) {
      setCurrentStep((currentStep + 1) as Step);
    } else {
      navigate('/app');
    }
  };
  const handleResumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError(t('onboarding.resumeSize'));
        return;
      }
      setFormData(prev => ({ ...prev, resumeFile: file }));
      setError('');
    }
  };

  const handleFinish = async () => {
    setLoading(true);
    setError('');

    try {
      if (formData.resumeFile && user) {
        const fileName = `${user.id}/resume-${Date.now()}.pdf`;
        const { error: uploadError } = await supabase.storage
          .from('resumes')
          .upload(fileName, formData.resumeFile);

        if (uploadError) {
          setError(t('common.error'));
          setLoading(false);
          return;
        }

        const { data } = supabase.storage
          .from('resumes')
          .getPublicUrl(fileName);

        await supabase
          .from('profiles')
          .update({
            resume_url: data.publicUrl,
          })
          .eq('id', user.id);
      }

      navigate('/app');
    } catch (err) {
      setError(t('common.error'));
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--bg-surface)] to-[var(--bg-base)] flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm font-semibold text-[var(--text-secondary)]">
              {t('onboarding.progressStep')} {currentStep} {t('onboarding.of')} 3
            </span>
          </div>
          <div className="w-full h-2 bg-[var(--border-subtle)] rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-[var(--accent-primary)]"
              initial={{ width: '0%' }}
              animate={{ width: `${(currentStep / 3) * 100}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>
        <Card className="p-8">
          <AnimatePresence mode="wait">
            {/* Step 1: Profile */}
            {currentStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: isArabic ? -50 : 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: isArabic ? 50 : -50 }}
                transition={{ duration: 0.3 }}
              >
                <h2 className="text-2xl font-cairo font-bold text-[var(--text-primary)] mb-2">
                  {t('onboarding.step1Title')}
                </h2>
                <p className="text-[var(--text-secondary)] mb-6">
                  {t('onboarding.step1Description')}
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                      {t('onboarding.fullName')}
                    </label>
                    <Input
                      type="text"
                      name="fullName"
                      placeholder={t('onboarding.fullName')}
                      value={formData.fullName}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                      {t('onboarding.title')}
                    </label>
                    <Input
                      type="text"
                      name="title"
                      placeholder={t('onboarding.title')}
                      value={formData.title}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                      {t('onboarding.company')}
                    </label>
                    <Input
                      type="text"
                      name="company"
                      placeholder={t('onboarding.company')}
                      value={formData.company}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                        {t('onboarding.phone')}
                      </label>
                      <Input
                        type="tel"
                        name="phone"
                        placeholder={t('onboarding.phone')}
                        value={formData.phone}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                        {t('onboarding.location')}
                      </label>
                      <Input
                        type="text"
                        name="location"
                        placeholder={t('onboarding.location')}
                        value={formData.location}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                      {error}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
            {/* Step 2: LinkedIn */}
            {currentStep === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: isArabic ? -50 : 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: isArabic ? 50 : -50 }}
                transition={{ duration: 0.3 }}
              >
                <h2 className="text-2xl font-cairo font-bold text-[var(--text-primary)] mb-2">
                  {t('onboarding.step2Title')}
                </h2>
                <p className="text-[var(--text-secondary)] mb-6">
                  {t('onboarding.step2Description')}
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                      {t('onboarding.linkedinUrl')}
                    </label>
                    <Input
                      type="url"
                      name="linkedinUrl"
                      placeholder={t('onboarding.linkedinPlaceholder')}
                      value={formData.linkedinUrl}
                      onChange={handleInputChange}
                    />
                  </div>

                  {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                      {error}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
            {/* Step 3: Resume */}
            {currentStep === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: isArabic ? -50 : 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: isArabic ? 50 : -50 }}
                transition={{ duration: 0.3 }}
              >
                <h2 className="text-2xl font-cairo font-bold text-[var(--text-primary)] mb-2">
                  {t('onboarding.step3Title')}
                </h2>
                <p className="text-[var(--text-secondary)] mb-6">
                  {t('onboarding.step3Description')}
                </p>

                <div className="space-y-4">
                  <label className="block">
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={handleResumeChange}
                      className="hidden"
                    />
                    <div className="border-2 border-dashed border-[var(--border-subtle)] rounded-lg p-8 text-center cursor-pointer hover:border-[var(--accent-primary)] hover:bg-[var(--accent-primary)] hover:bg-opacity-5 transition-colors">
                      <Upload className="w-8 h-8 text-[var(--accent-secondary)] mx-auto mb-3" />
                      <p className="font-medium text-[var(--text-primary)] mb-1">
                        {t('onboarding.resumeHint')}
                      </p>
                      <p className="text-sm text-[var(--text-secondary)]">
                        {t('onboarding.resumeSize')}
                      </p>
                    </div>
                  </label>

                  {formData.resumeFile && (
                    <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="text-sm text-green-700">{formData.resumeFile.name}</span>
                    </div>
                  )}

                  {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                      {error}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {/* Actions */}
          <div className="flex gap-3 mt-8 justify-between">
            <div className="flex gap-3">
              {currentStep > 1 && (
                <Button
                  onClick={handleBack}
                  variant="outline"
                  disabled={loading}
                >
                  {t('common.back')}
                </Button>
              )}
            </div>

            <div className="flex gap-3">
              <Button
                onClick={handleSkip}
                variant="ghost"
                disabled={loading}
              >
                {currentStep === 3 ? 'Skip' : t('common.skip')}
              </Button>

              {currentStep < 3 ? (
                <Button
                  onClick={handleNext}
                  disabled={loading}
                  className="gap-2"
                >
                  {loading ? t('common.loading') : t('common.next')}
                  <ChevronRight className="w-4 h-4" />
                </Button>
              ) : (
                <Button
                  onClick={handleFinish}
                  disabled={loading}
                  className="gap-2"
                >
                  {loading ? t('common.loading') : t('common.submit')}
                  <CheckCircle className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Onboarding;