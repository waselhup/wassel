import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card } from '../components/ui/card';
import { Globe, Check, AlertCircle } from 'lucide-react';

type PasswordStrength = 'weak' | 'medium' | 'strong';

const Signup: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { signUp } = useAuth();
  
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength>('weak');

  const calculatePasswordStrength = (pwd: string): PasswordStrength => {
    if (pwd.length < 8) return 'weak';
    const hasUpperCase = /[A-Z]/.test(pwd);
    const hasLowerCase = /[a-z]/.test(pwd);
    const hasNumbers = /\d/.test(pwd);
    const hasSpecialChar = /[!@#$%^&*]/.test(pwd);    
    const strength = [hasUpperCase, hasLowerCase, hasNumbers, hasSpecialChar].filter(Boolean).length;
    if (strength >= 3) return 'strong';
    if (strength >= 2) return 'medium';
    return 'weak';
  };

  const handlePasswordChange = (pwd: string) => {
    setPassword(pwd);
    setPasswordStrength(calculatePasswordStrength(pwd));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!fullName || !email || !password || !confirmPassword) {
      setError(t('auth.errors.invalidCredentials'));
      return;
    }

    if (password !== confirmPassword) {
      setError(t('auth.errors.passwordMismatch'));
      return;
    }

    if (password.length < 8) {
      setError(t('auth.errors.passwordTooShort'));
      return;
    }

    setLoading(true);
    const { error: signUpError } = await signUp(email, password, fullName);
    setLoading(false);

    if (signUpError) {
      setError(signUpError.message || t('auth.errors.emailExists'));
    } else {
      setSuccess(true);
    }
  };
  const toggleLanguage = () => {
    const newLang = i18n.language === 'ar' ? 'en' : 'ar';
    i18n.changeLanguage(newLang);
    document.documentElement.lang = newLang;
    document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr';
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[var(--bg-surface)] flex items-center justify-center p-4">
        <button
          onClick={toggleLanguage}
          className="absolute top-4 right-4 md:top-6 md:right-6 p-2 rounded-lg bg-[var(--bg-base)] border border-[var(--border-subtle)] hover:bg-[var(--bg-surface-hover)] transition-colors flex items-center gap-2 text-sm text-[var(--text-secondary)]"
        >
          <Globe className="w-4 h-4" />
          {i18n.language === 'ar' ? 'EN' : 'AR'}
        </button>

        <Card className="w-full max-w-md">
          <div className="p-8 space-y-6 text-center">
            <div className="flex justify-center">
              <div className="w-12 h-12 bg-[var(--success)] rounded-full flex items-center justify-center">
                <Check className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-[var(--text-primary)]">
                {t('common.success')}
              </h2>
              <p className="text-sm text-[var(--text-secondary)]">
                {t('auth.signup.checkEmail')}
              </p>
            </div>
            <a href="/login" className="text-[var(--accent-secondary)] font-semibold hover:underline">
              {t('auth.hasAccount')}
            </a>
          </div>
        </Card>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-[var(--bg-surface)] flex items-center justify-center p-4">
      <button
        onClick={toggleLanguage}
        className="absolute top-4 right-4 md:top-6 md:right-6 p-2 rounded-lg bg-[var(--bg-base)] border border-[var(--border-subtle)] hover:bg-[var(--bg-surface-hover)] transition-colors flex items-center gap-2 text-sm text-[var(--text-secondary)]"
      >
        <Globe className="w-4 h-4" />
        {i18n.language === 'ar' ? 'EN' : 'AR'}
      </button>

      <Card className="w-full max-w-md">
        <div className="p-8 space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-cairo font-bold text-[var(--accent-primary)]">
              وصّل
            </h1>
            <h2 className="text-xl font-semibold text-[var(--text-primary)]">
              {t('auth.signup.title')}
            </h2>
            <p className="text-sm text-[var(--text-secondary)]">
              {t('auth.signup.subtitle')}
            </p>
          </div>

          {error && (
            <div className="p-3 bg-[var(--danger)] bg-opacity-10 border border-[var(--danger)] rounded-lg flex gap-2">
              <AlertCircle className="w-5 h-5 text-[var(--danger)] flex-shrink-0" />
              <p className="text-sm text-[var(--danger)]">{error}</p>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="fullName" className="block text-sm font-medium text-[var(--text-primary)]">
                {t('auth.fullName')}
              </label>
              <Input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={t('auth.fullName')}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-medium text-[var(--text-primary)]">
                {t('auth.email')}
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('auth.email')}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium text-[var(--text-primary)]">
                {t('auth.password')}
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => handlePasswordChange(e.target.value)}
                placeholder={t('auth.password')}
                disabled={loading}
              />              
              {password && (
                <div className="space-y-2">
                  <div className="h-1 bg-[var(--bg-surface)] rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        passwordStrength === 'strong'
                          ? 'w-full bg-[var(--success)]'
                          : passwordStrength === 'medium'
                          ? 'w-2/3 bg-[var(--warning)]'
                          : 'w-1/3 bg-[var(--danger)]'
                      }`}
                    />
                  </div>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {passwordStrength === 'strong'
                      ? t('auth.passwordStrength.strong', 'Strong password')
                      : passwordStrength === 'medium'
                      ? t('auth.passwordStrength.medium', 'Medium password')
                      : t('auth.passwordStrength.weak', 'Weak password')}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-[var(--text-primary)]">
                {t('auth.confirmPassword')}
              </label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t('auth.confirmPassword')}
                disabled={loading}
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full"
            >
              {loading ? t('common.loading') : t('auth.signUp')}
            </Button>
          </form>
          <div className="text-center">
            <p className="text-sm text-[var(--text-secondary)]">
              {t('auth.hasAccount')}{' '}
              <a
                href="/login"
                className="text-[var(--accent-secondary)] font-semibold hover:underline"
              >
                {t('auth.signIn')}
              </a>
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Signup;