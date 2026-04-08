import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpApi from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';

i18n
  .use(HttpApi)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    debug: false,
    interpolation: {
      escapeValue: false,
    },
    backend: {
      loadPath: '/locales/{{lng}}/translation.json',
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
    ns: ['translation'],
    defaultNS: 'translation',
  });

i18n.on('languageChanged', (lng) => {
  const htmlElement = document.documentElement;
  const isRTL = lng === 'ar';
  
  htmlElement.setAttribute('dir', isRTL ? 'rtl' : 'ltr');
  htmlElement.setAttribute('lang', lng);
  
  if (isRTL) {
    document.body.style.direction = 'rtl';
    document.body.style.textAlign = 'right';
  } else {
    document.body.style.direction = 'ltr';
    document.body.style.textAlign = 'left';
  }
});

// Set initial direction based on initial language
const initialLng = i18n.language || 'ar';
const isRTL = initialLng === 'ar';
document.documentElement.setAttribute('dir', isRTL ? 'rtl' : 'ltr');
document.documentElement.setAttribute('lang', initialLng);

export default i18n;