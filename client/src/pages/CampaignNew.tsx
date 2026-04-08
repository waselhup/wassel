import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, ChevronLeft, Mail, Users, FileText, CheckCircle, AlertCircle } from 'lucide-react';

interface FormData {
  campaignName: string;
  targetJobTitle: string;
  targetCompanies: string;
  language: 'ar' | 'en';
  numRecipients: number;
}

interface Recipient {
  full_name: string;
  email: string;
  company: string;
  job_title: string;
}

interface EmailSample {
  recipientName: string;
  subject: string;
  body: string;
}

const mockRecipients: Recipient[] = [
  {
    full_name: 'Ahmed Al-Rashid',
    email: 'ahmed.r@techco.sa',
    company: 'TechCo Saudi',
    job_title: 'HR Director',
  },
  {
    full_name: 'Sarah Hassan',
    email: 'sarah.h@innovate.sa',
    company: 'Innovate Labs',
    job_title: 'Talent Acquisition Manager',
  },
  {
    full_name: 'Fahad Al-Dosari',
    email: 'fahad@megacorp.sa',
    company: 'MegaCorp',
    job_title: 'Hiring Manager',
  },
  {
    full_name: 'Noura Al-Salem',
    email: 'noura@startup.sa',
    company: 'Saudi Startup Hub',
    job_title: 'People Operations Lead',
  },
  {
    full_name: 'Khalid Ibrahim',
    email: 'khalid@enterprise.sa',
    company: 'Enterprise Solutions',
    job_title: 'VP of Engineering',
  },
];

const mockEmails: EmailSample[] = [
  {
    recipientName: 'Ahmed Al-Rashid',
    subject: 'Experienced Software Engineer — Available for TechCo Saudi',
    body: `Dear Ahmed,

I noticed TechCo Saudi is growing its engineering team, and I believe my 5+ years of experience in React, Node.js, and cloud technologies would be a strong fit.

I've led development of SaaS platforms serving 10,000+ users and have deep expertise in the technologies your team uses.

I'd love to schedule a brief conversation about how I can contribute to your team's goals.

Best regards,
[User Name]

---
To unsubscribe from future emails, click here.`,
  },
];

const CampaignNew: React.FC = () => {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const { user, profile } = useAuth();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [findingRecipients, setFindingRecipients] = useState(false);
  const [foundRecipients, setFoundRecipients] = useState<Recipient[]>([]);

  const [formData, setFormData] = useState<FormData>({
    campaignName: '',
    targetJobTitle: '',
    targetCompanies: '',
    language: 'en',
    numRecipients: 100,
  });

  const handleFormChange = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const validateStep1 = (): boolean => {
    if (!formData.campaignName.trim()) {
      setError(t('common.error'));
      return false;
    }
    if (!formData.targetJobTitle.trim()) {
      setError(t('common.error'));
      return false;
    }
    if (!formData.targetCompanies.trim()) {
      setError(t('common.error'));
      return false;
    }
    return true;
  };

  const handleNextStep = () => {
    if (step === 1 && !validateStep1()) return;

    if (step === 1) {
      setStep(2);
      simulateFindingRecipients();
    } else if (step === 2) {
      setStep(3);
    } else if (step === 3) {
      setStep(4);
    }
  };

  const simulateFindingRecipients = () => {
    setFindingRecipients(true);
    setTimeout(() => {
      setFoundRecipients(mockRecipients.slice(0, 5));
      setFindingRecipients(false);
    }, 2000);
  };

  const handleSubmitCampaign = async () => {
    if (!user || !profile) return;    const tokenCost = formData.numRecipients;
    if (profile.token_balance < tokenCost) {
      setError(t('campaigns.wizard.insufficientTokens'));
      return;
    }

    setLoading(true);
    try {
      const { data, error: insertError } = await supabase
        .from('email_campaigns')
        .insert([
          {
            user_id: user.id,
            name: formData.campaignName,
            status: 'running',
            target_job_title: formData.targetJobTitle,
            target_companies: formData.targetCompanies,
            language: formData.language,
            total_recipients: formData.numRecipients,
            total_sent: 0,
            total_opened: 0,
            total_replied: 0,
            total_bounced: 0,
          },
        ])
        .select();

      if (insertError) {
        setError(insertError.message);
        setLoading(false);
        return;
      }

      if (data && data[0]) {
        const campaignId = data[0].id;

        // Deduct tokens
        const newBalance = profile.token_balance - tokenCost;
        await supabase
          .from('profiles')
          .update({ token_balance: newBalance })
          .eq('id', user.id);

        // Log transaction
        await supabase.from('token_transactions').insert([
          {
            user_id: user.id,
            type: 'usage',
            amount: tokenCost,
            description: `Email campaign: ${formData.campaignName}`,
            status: 'completed',
          },
        ]);

        navigate(`/app/campaigns/${campaignId}`);
      }
    } catch (err) {
      console.error('Error creating campaign:', err);
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const tokenCost = formData.numRecipients;
  const hasEnoughTokens = profile && profile.token_balance >= tokenCost;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.3 } },
  };

  const stepVariants = {
    hidden: { opacity: 0, x: 20 },
    visible: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
  };

  return (
    <DashboardLayout pageTitle={t('campaigns.wizard.step' + step)}>
      <div className="space-y-6">
        {/* Progress Steps */}
        <motion.div variants={containerVariants} initial="hidden" animate="visible">
          <div className="flex items-center justify-between mb-8">
            {[1, 2, 3, 4].map(s => (
              <div key={s} className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-colors ${
                    s === step
                      ? 'bg-[var(--accent-primary)] text-white'
                      : s < step
                      ? 'bg-green-500 text-white'
                      : 'bg-[var(--bg-surface)] text-[var(--text-secondary)]'
                  }`}
                >
                  {s < step ? '✓' : s}
                </div>
                {s < 4 && (
                  <div
                    className={`w-12 h-1 transition-colors ${
                      s < step ? 'bg-green-500' : 'bg-[var(--border-subtle)]'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </motion.div>

        {/* Step Content */}
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              variants={stepVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="space-y-6"
            >
              <Card>
                <CardHeader>
                  <CardTitle className="font-cairo">
                    {t('campaigns.wizard.step1')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                      {t('campaigns.wizard.campaignName')}
                    </label>
                    <Input
                      placeholder={t('campaigns.wizard.campaignNamePlaceholder')}
                      value={formData.campaignName}
                      onChange={e => handleFormChange('campaignName', e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                      {t('campaigns.wizard.targetJobTitle')}
                    </label>
                    <Input
                      placeholder={t('campaigns.wizard.targetJobTitlePlaceholder')}
                      value={formData.targetJobTitle}
                      onChange={e => handleFormChange('targetJobTitle', e.target.value)}
                    />
                  </div>                  <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                      {t('campaigns.wizard.targetCompanies')}
                    </label>
                    <Input
                      placeholder={t('campaigns.wizard.targetCompaniesPlaceholder')}
                      value={formData.targetCompanies}
                      onChange={e => handleFormChange('targetCompanies', e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-3">
                      {t('campaigns.wizard.language')}
                    </label>
                    <div className="flex gap-4">
                      {['ar', 'en'].map(lang => (
                        <label key={lang} className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="radio"
                            name="language"
                            value={lang}
                            checked={formData.language === lang}
                            onChange={() => handleFormChange('language', lang)}
                            className="w-4 h-4"
                          />
                          <span className="font-medium text-[var(--text-primary)]">
                            {lang === 'ar'
                              ? t('campaigns.wizard.languageArabic')
                              : t('campaigns.wizard.languageEnglish')}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                      {t('campaigns.wizard.numRecipients')}: {formData.numRecipients}
                    </label>
                    <input
                      type="range"
                      min="50"
                      max="500"
                      step="50"
                      value={formData.numRecipients}
                      onChange={e => handleFormChange('numRecipients', parseInt(e.target.value))}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-[var(--text-secondary)] mt-2">
                      <span>50</span>
                      <span>500</span>
                    </div>
                  </div>

                  <div className="bg-[var(--bg-surface)] p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-[var(--text-secondary)]">
                          {t('campaigns.wizard.tokenCost')}
                        </p>
                        <p className="text-lg font-bold text-[var(--accent-primary)]">
                          {tokenCost} {t('campaigns.wizard.costPerEmail')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-[var(--text-secondary)]">
                          {t('sidebar.tokens')}
                        </p>
                        <p
                          className={`text-2xl font-bold ${
                            hasEnoughTokens
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}
                        >
                          {profile?.token_balance || 0}
                        </p>
                      </div>
                    </div>
                  </div>

                  {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                      <p className="text-sm text-red-600">{error}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              variants={stepVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="space-y-6"
            >
              <Card>
                <CardHeader>
                  <CardTitle className="font-cairo">
                    {t('campaigns.wizard.step2')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {findingRecipients ? (
                    <div className="text-center py-12">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="inline-block"
                      >
                        <Users className="w-12 h-12 text-[var(--accent-primary)]" />
                      </motion.div>
                      <p className="text-[var(--text-secondary)] mt-4">
                        {t('campaigns.wizard.findingRecipients')}
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="bg-[var(--accent-primary)] bg-opacity-10 border border-[var(--accent-primary)] border-opacity-20 rounded-lg p-4">
                        <p className="text-[var(--accent-primary)] font-semibold">
                          {t('campaigns.wizard.foundRecipients', {
                            count: formData.numRecipients,
                          })}
                        </p>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-[var(--border-subtle)]">
                              <th className="text-left py-3 px-4 font-semibold text-[var(--text-secondary)]">
                                {t('campaigns.wizard.recipient')}
                              </th>
                              <th className="text-left py-3 px-4 font-semibold text-[var(--text-secondary)]">
                                {t('campaigns.wizard.company')}
                              </th>
                              <th className="text-left py-3 px-4 font-semibold text-[var(--text-secondary)]">
                                {t('campaigns.wizard.jobTitle')}
                              </th>
                              <th className="text-left py-3 px-4 font-semibold text-[var(--text-secondary)]">
                                Email
                              </th>
                            </tr>
                          </thead>                          <tbody>
                            {foundRecipients.map((r, idx) => (
                              <tr
                                key={idx}
                                className={`border-b border-[var(--border-subtle)] ${
                                  idx % 2 === 0 ? 'bg-[var(--bg-surface)]' : ''
                                }`}
                              >
                                <td className="py-3 px-4">{r.full_name}</td>
                                <td className="py-3 px-4">{r.company}</td>
                                <td className="py-3 px-4">{r.job_title}</td>
                                <td className="py-3 px-4 text-[var(--text-secondary)]">
                                  {r.email}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              variants={stepVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="space-y-6"
            >
              <Card>
                <CardHeader>
                  <CardTitle className="font-cairo">
                    {t('campaigns.wizard.step3')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {mockEmails.map((email, idx) => (
                    <Card key={idx} className="bg-[var(--bg-surface)]">
                      <CardContent className="p-6">
                        <p className="text-sm text-[var(--text-secondary)] mb-3">
                          {t('campaigns.wizard.emailSample')} - {email.recipientName}
                        </p>
                        <div className="space-y-4 font-mono text-sm">
                          <div>
                            <p className="font-semibold text-[var(--text-secondary)] mb-1">
                              {t('campaigns.wizard.subject')}
                            </p>
                            <p className="text-[var(--text-primary)]">{email.subject}</p>
                          </div>
                          <div>
                            <p className="font-semibold text-[var(--text-secondary)] mb-1">
                              {t('campaigns.wizard.body')}
                            </p>
                            <div className="bg-[var(--bg-base)] p-4 rounded text-[var(--text-primary)] whitespace-pre-wrap text-xs overflow-auto max-h-60">
                              {email.body}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
                    <Mail className="w-5 h-5 text-blue-600 flex-shrink-0" />
                    <p className="text-sm text-blue-600">
                      {t('campaigns.wizard.unsubscribeNote')}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div
              key="step4"
              variants={stepVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="space-y-6"
            >
              <Card>
                <CardHeader>
                  <CardTitle className="font-cairo">
                    {t('campaigns.wizard.step4')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="bg-[var(--accent-primary)] bg-opacity-5 border border-[var(--accent-primary)] border-opacity-20 rounded-lg p-6 space-y-4">
                    <h3 className="font-cairo font-semibold text-[var(--text-primary)]">
                      {t('campaigns.wizard.summary')}
                    </h3>

                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-[var(--text-secondary)]">
                          {t('campaigns.name')}:
                        </span>
                        <span className="font-semibold text-[var(--text-primary)]">
                          {formData.campaignName}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--text-secondary)]">
                          {t('campaigns.wizard.targetJobTitle')}:
                        </span>
                        <span className="font-semibold text-[var(--text-primary)]">
                          {formData.targetJobTitle}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--text-secondary)]">
                          {t('campaigns.wizard.numRecipients')}:
                        </span>
                        <span className="font-semibold text-[var(--text-primary)]">
                          {formData.numRecipients}
                        </span>
                      </div>
                      <div className="border-t border-[var(--border-subtle)] pt-3 flex justify-between">
                        <span className="text-[var(--text-secondary)] font-medium">
                          {t('campaigns.wizard.totalCost')}:
                        </span>
                        <span
                          className={`text-lg font-bold ${
                            hasEnoughTokens
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}
                        >
                          {tokenCost} {t('sidebar.tokens')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {!hasEnoughTokens && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-red-600">
                          {t('campaigns.wizard.insufficientTokens')}
                        </p>
                        <p className="text-sm text-red-600 mt-1">
                          {t('campaigns.wizard.reviewDetails')}
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action Buttons */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="flex gap-4"
        >
          <Button
            variant="outline"
            onClick={() => setStep(Math.max(1, step - 1))}
            disabled={step === 1}
            className="flex items-center gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            {t('common.back')}
          </Button>

          {step < 4 ? (
            <Button
              onClick={handleNextStep}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2"
            >
              {t('common.next')}
              <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => navigate('/app/campaigns')}
                className="flex-1"
              >
                {t('campaigns.wizard.backToList')}
              </Button>
              <Button
                onClick={handleSubmitCampaign}
                disabled={loading || !hasEnoughTokens}
                className="flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                {loading ? t('common.loading') : t('campaigns.wizard.confirmSend')}
              </Button>
            </>
          )}
        </motion.div>
      </div>
    </DashboardLayout>
  );
};

export default CampaignNew;