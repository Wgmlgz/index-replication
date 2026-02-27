import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import zodEn from 'zod-i18n-map/locales/en/zod.json';
import commonEn from '@/locales/en/common.json';

const normalizeLanguage = (language: string) => {
  const lower = language.toLowerCase();
  if (lower.startsWith('en')) return 'en';
  return 'en';
};

const getInitialLanguage = () => {
  if (typeof navigator === 'undefined') return 'en';
  return normalizeLanguage(navigator.language || 'en');
};

export const initI18n = () => {
  if (i18next.isInitialized) return i18next;

  void i18next.use(initReactI18next).init({
    lng: getInitialLanguage(),
    fallbackLng: 'en',
    supportedLngs: ['en'],
    ns: ['common', 'zod'],
    defaultNS: 'common',
    resources: {
      en: { common: commonEn, zod: zodEn },
    },
    interpolation: { escapeValue: false },
  });

  return i18next;
};

export const setLanguage = (language: string) => {
  const nextLanguage = normalizeLanguage(language);
  void initI18n().changeLanguage(nextLanguage);
};
