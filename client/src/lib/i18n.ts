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

// Apply RTL direction and font on language change
function applyLanguageSettings(lang: string) {
  const isArabic = lang === 'ar';
  document.documentElement.dir = isArabic ? 'rtl' : 'ltr';
  document.documentElement.lang = lang;
  document.body.style.fontFamily = isArabic
    ? "'Cairo', sans-serif"
    : "'Inter', 'Plus Jakarta Sans', sans-serif";
  localStorage.setItem('wassel_lang', lang);
}

applyLanguageSettings(i18n.language);

i18n.on('languageChanged', applyLanguageSettings);

export default i18n;
