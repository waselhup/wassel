import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Menu, X, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Navbar: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [, navigate] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isArabic = i18n.language === 'ar';

  const toggleLanguage = () => {
    const newLang = isArabic ? 'en' : 'ar';
    i18n.changeLanguage(newLang);
  };

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const navLinks = [
    { label: t('nav.features'), id: 'features' },
    { label: t('nav.pricing'), id: 'pricing' },
    { label: t('nav.faq'), id: 'faq' },
  ];
  return (
    <motion.nav
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-white/10 border-b border-white/20"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`flex items-center justify-between h-16 ${isArabic ? 'flex-row-reverse' : ''}`}>
          <motion.div
            whileHover={{ scale: 1.05 }}
            onClick={() => navigate('/')}
            className="cursor-pointer"
          >
            <h1 className="text-2xl font-bold text-primary-600" style={{ fontFamily: isArabic ? 'Cairo' : 'Inter' }}>
              {isArabic ? 'وصّل' : 'Wassel'}
            </h1>
          </motion.div>

          <div className={`hidden md:flex items-center gap-8 ${isArabic ? 'flex-row-reverse' : ''}`}>
            {navLinks.map((link) => (
              <button
                key={link.id}
                onClick={() => scrollToSection(link.id)}
                className="text-text-primary hover:text-primary-600 transition-colors font-medium"
              >
                {link.label}
              </button>
            ))}
          </div>

          <div className={`hidden md:flex items-center gap-4 ${isArabic ? 'flex-row-reverse' : ''}`}>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={toggleLanguage}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              title={t('nav.language')}
            >
              <Globe size={20} className="text-text-primary" />
            </motion.button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/login')}
              className="text-text-primary hover:text-primary-600"
            >
              {t('nav.login')}
            </Button>
            <Button
              size="sm"
              onClick={() => navigate('/signup')}
              className="bg-primary-600 hover:bg-primary-700 text-white"
            >
              {t('nav.signup')}
            </Button>
          </div>

          <div className="flex md:hidden items-center gap-2">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={toggleLanguage}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              <Globe size={18} className="text-text-primary" />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              {mobileMenuOpen ? (
                <X size={24} className="text-text-primary" />
              ) : (
                <Menu size={24} className="text-text-primary" />
              )}
            </motion.button>
          </div>
        </div>
        <motion.div
          initial={false}
          animate={{
            height: mobileMenuOpen ? 'auto' : 0,
            opacity: mobileMenuOpen ? 1 : 0,
          }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden md:hidden border-t border-white/10"
        >
          <div className={`py-4 space-y-3 ${isArabic ? '' : ''}`}>
            {navLinks.map((link) => (
              <button
                key={link.id}
                onClick={() => scrollToSection(link.id)}
                className="block w-full text-left px-4 py-2 text-text-primary hover:bg-white/5 rounded-lg transition-colors font-medium"
              >
                {link.label}
              </button>
            ))}
            <div className="pt-3 px-4 space-y-2 border-t border-white/10">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setMobileMenuOpen(false);
                  navigate('/login');
                }}
              >
                {t('nav.login')}
              </Button>
              <Button
                className="w-full bg-primary-600 hover:bg-primary-700 text-white"
                onClick={() => {
                  setMobileMenuOpen(false);
                  navigate('/signup');
                }}
              >
                {t('nav.signup')}
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.nav>
  );
};

export default Navbar;