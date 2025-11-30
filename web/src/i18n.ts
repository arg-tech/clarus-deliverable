import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enTranslation from './locales/en.json';
import elTranslation from './locales/el.json';
import fiTranslation from './locales/fi.json';
import ptTranslation from './locales/pt.json';
import csTranslation from './locales/cs.json';

const resources = {
  en: enTranslation,
  el: elTranslation,
  fi: fiTranslation,
  pt: ptTranslation,
  cs: csTranslation,
};

// Get saved language from localStorage or default to 'en'
const savedLanguage = localStorage.getItem('i18nextLng') || 'en';

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: savedLanguage,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

// Save language to localStorage whenever it changes
i18n.on('languageChanged', (lng) => {
  localStorage.setItem('i18nextLng', lng);
});

export default i18n;
