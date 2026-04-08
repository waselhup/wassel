import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'wouter';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card } from '../components/ui/card';
import { Globe } from 'lucide-react';

const Login: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [, navigate] = useLocation();
  const { signIn } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!email || !password) {
      setError(t('auth.errors.invalidCredentials'));
      return;
    }

    setLoading(true);    const { error: signInError } = await signIn(email, password);
    setLoading(false);

    if (signInError) {
      setError(signInError.message || t('auth.errors.invalidCredentials'));
    } else {
      navigate('/app');
    }
  };

  const toggleLanguage = () => {
    const newLang = i18n.language === 'ar' ? 'en' : 'ar';
    i18n.changeLanguage(newLang);
    document.documentElement.lang = newLang;
    document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr';
  };

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
            </h1>            <h2 className="text-xl font-semibold text-[var(--text-primary)]">
              {t('auth.login.title')}
            </h2>
            <p className="text-sm text-[var(--text-secondary)]">
              {t('auth.login.subtitle')}
            </p>
          </div>

          {error && (
            <div className="p-3 bg-[var(--danger)] bg-opacity-10 border border-[var(--danger)] rounded-lg">
              <p className="text-sm text-[var(--danger)]">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
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
              </label>              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('auth.password')}
                disabled={loading}
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={loading}
                  className="w-4 h-4 rounded border-[var(--border-subtle)] accent-[var(--accent-secondary)]"
                />
                <span className="text-sm text-[var(--text-secondary)]">
                  {t('auth.rememberMe')}
                </span>
              </label>
              <a
                href="/reset-password"
                className="text-sm text-[var(--accent-secondary)] hover:underline"
              >
                {t('auth.forgotPassword')}
              </a>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full"
            >
              {loading ? t('common.loading') : t('auth.signIn')}            </Button>
          </form>

          <div className="text-center">
            <p className="text-sm text-[var(--text-secondary)]">
              {t('auth.noAccount')}{' '}
              <a
                href="/signup"
                className="text-[var(--accent-secondary)] font-semibold hover:underline"
              >
                {t('auth.signUp')}
              </a>
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Login;