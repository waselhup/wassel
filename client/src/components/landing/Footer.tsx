import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Linkedin, Twitter, Instagram } from 'lucide-react';
import { WasselLogo } from '@/components/WasselLogo';

const Footer: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';

  const footerLinks = t('footer.links', { returnObjects: true }) as any;

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
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4 },
    },
  };

  const socialLinks = [
    { icon: Linkedin, label: 'LinkedIn', href: '#' },
    { icon: Twitter, label: 'Twitter', href: '#' },
    { icon: Instagram, label: 'Instagram', href: '#' },
  ];

  return (
    <footer className="relative w-full bg-slate-950 border-t border-white/10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-16 md:py-24">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 ${isArabic ? 'rtl' : ''}`}
          >
            <motion.div variants={itemVariants}>
              <div className="flex items-center gap-2 mb-4">
              <WasselLogo size={36} />
              <span className="text-2xl font-bold text-white" style={{ fontFamily: isArabic ? 'Cairo' : 'Inter' }}>
                {isArabic ? 'وصّل' : 'Wassel'}
              </span>
            </div>
              <p className="text-gray-400 text-sm leading-relaxed mb-4">
                {t('footer.description')}
              </p>
              <div className={`flex gap-4 ${isArabic ? 'flex-row-reverse' : ''}`}>
                {socialLinks.map((social, index) => {
                  const Icon = social.icon;
                  return (
                    <motion.a
                      key={index}
                      href={social.href}
                      whileHover={{ scale: 1.2 }}
                      whileTap={{ scale: 0.9 }}
                      className="w-10 h-10 rounded-full bg-white/10 hover:bg-primary-600 text-gray-400 hover:text-white flex items-center justify-center transition-all duration-300"
                      title={social.label}
                    >
                      <Icon size={18} />
                    </motion.a>
                  );
                })}
              </div>
            </motion.div>
            <motion.div variants={itemVariants}>
              <h4 className="text-lg font-semibold text-white mb-6" style={{ fontFamily: isArabic ? 'Cairo' : 'Inter' }}>
                {footerLinks?.product?.title}
              </h4>
              <ul className="space-y-3">
                {footerLinks?.product?.items?.map((item: string, index: number) => (
                  <li key={index}>
                    <a
                      href="#"
                      className="text-gray-400 hover:text-primary-400 transition-colors duration-300 text-sm"
                    >
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </motion.div>

            <motion.div variants={itemVariants}>
              <h4 className="text-lg font-semibold text-white mb-6" style={{ fontFamily: isArabic ? 'Cairo' : 'Inter' }}>
                {footerLinks?.company?.title}
              </h4>
              <ul className="space-y-3">
                {footerLinks?.company?.items?.map((item: string, index: number) => (
                  <li key={index}>
                    <a
                      href="#"
                      className="text-gray-400 hover:text-primary-400 transition-colors duration-300 text-sm"
                    >
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </motion.div>

            <motion.div variants={itemVariants}>
              <h4 className="text-lg font-semibold text-white mb-6" style={{ fontFamily: isArabic ? 'Cairo' : 'Inter' }}>
                {footerLinks?.legal?.title}
              </h4>
              <ul className="space-y-3">
                {footerLinks?.legal?.items?.map((item: string, index: number) => (
                  <li key={index}>
                    <a
                      href="#"
                      className="text-gray-400 hover:text-primary-400 transition-colors duration-300 text-sm"
                    >
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </motion.div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="border-t border-white/10 py-8 flex flex-col md:flex-row items-center justify-between gap-4"
        >
          <p className="text-gray-400 text-sm">
            {t('footer.copyright')}
          </p>
          <p className="text-gray-400 text-sm font-medium">
            {t('footer.madeIn')}
          </p>
        </motion.div>
      </div>
    </footer>
  );
};

export default Footer;