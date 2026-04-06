import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

import enUS from './locales/en-US.json';
import ptBR from './locales/pt-BR.json';

export type AppLanguage = 'pt-BR' | 'en-US';

export const LANGUAGES: Record<AppLanguage, { flag: string; label: string }> = {
  'pt-BR': { flag: '🇧🇷', label: 'Português' },
  'en-US': { flag: '🇺🇸', label: 'English' },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      'pt-BR': { translation: ptBR },
      'en-US': { translation: enUS },
    },
    fallbackLng: 'pt-BR',
    supportedLngs: ['pt-BR', 'en-US'],
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'display-language',
      caches: ['localStorage'],
      convertDetectedLanguage: (lng: string) => {
        if (lng.startsWith('pt')) return 'pt-BR';
        if (lng.startsWith('en')) return 'en-US';
        return 'pt-BR';
      },
    },
    interpolation: {
      escapeValue: false, // React already escapes
    },
  });

export default i18n;
