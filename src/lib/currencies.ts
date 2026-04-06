export type CurrencyCode = 'BRL' | 'USD' | 'CAD';

export interface CurrencyConfig {
  code: CurrencyCode;
  symbol: string;
  locale: string;
  name: string;
  flag: string;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyConfig> = {
  BRL: {
    code: 'BRL',
    symbol: 'R$',
    locale: 'pt-BR',
    name: 'Real Brasileiro',
    flag: '🇧🇷',
  },
  USD: {
    code: 'USD',
    symbol: 'US$',
    locale: 'en-US',
    name: 'US Dollar',
    flag: '🇺🇸',
  },
  CAD: {
    code: 'CAD',
    symbol: 'CA$',
    locale: 'en-CA',
    name: 'Canadian Dollar',
    flag: '🇨🇦',
  },
};

export const SUPPORTED_CURRENCIES = Object.values(CURRENCIES);

export const BASE_CURRENCY: CurrencyCode = 'BRL';

export function detectCurrencyFromLocale(): CurrencyCode {
  const lang = navigator.language || 'pt-BR';
  if (lang.startsWith('pt')) return 'BRL';
  if (lang === 'en-CA' || lang === 'fr-CA') return 'CAD';
  if (lang.startsWith('en')) return 'USD';
  return 'BRL';
}
