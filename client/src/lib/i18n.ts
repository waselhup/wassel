import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translations
import ar from '../../public/locales/ar/translation.json';
import en from '../../public/locales/en/translation.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ar: { translation: ar },
      en: { translation: en },
    },
    fallbackLng: 'en',
    lng: localStorage.getItem('wassel_lang') || 'ar', // Arabic default
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage'],
      lookupLocalStorage: 'wassel_lang',
      caches: ['localStorage'],
    },
  });

// Apply RTL direction on language change
const applyDirection = (lang: string) => {
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.lang = lang;
  document.body.style.fontFamily = lang === 'ar'
    ? "'Cairo', 'Plus Jakarta Sans', sans-serif"
    : "'Plus Jakarta Sans', 'Inter', sans-serif";
};

applyDirection(i18n.language);

i18n.on('languageChanged', (lang) => {
  localStorage.setItem('wassel_lang', lang);
  applyDirection(lang);
});

export default i18n;
