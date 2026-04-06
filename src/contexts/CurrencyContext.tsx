import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { CURRENCIES, BASE_CURRENCY, detectCurrencyFromLocale, type CurrencyCode, type CurrencyConfig } from '@/lib/currencies';
import { convertFromBRL, convertToBRL, type ExchangeRates } from '@/services/exchangeRates';
import { useExchangeRates } from '@/hooks/useExchangeRates';
import { useProfile, useSetDisplayCurrency } from '@/hooks/useProfile';

interface CurrencyContextValue {
  currency: CurrencyCode;
  currencyConfig: CurrencyConfig;
  setCurrency: (code: CurrencyCode) => void;
  formatAmount: (amountInBRL: number) => string;
  convertAmount: (amountInBRL: number) => number;
  toBaseCurrency: (amountInDisplayCurrency: number) => number;
  rates: ExchangeRates['rates'] | null;
  isLoadingRates: boolean;
  isConverted: boolean;
  formatter: Intl.NumberFormat;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

function getInitialCurrency(): CurrencyCode {
  const saved = localStorage.getItem('display-currency');
  if (saved && (saved === 'BRL' || saved === 'USD' || saved === 'CAD')) {
    return saved;
  }
  return detectCurrencyFromLocale();
}

function isValidCurrency(val: string | undefined | null): val is CurrencyCode {
  return val === 'BRL' || val === 'USD' || val === 'CAD';
}

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyCode>(getInitialCurrency);
  const { data: ratesData, isLoading: isLoadingRates } = useExchangeRates();
  const { data: profile } = useProfile();
  const setDisplayCurrency = useSetDisplayCurrency();

  // Sync currency from profile on load (profile takes precedence over localStorage)
  useEffect(() => {
    if (profile?.display_currency && isValidCurrency(profile.display_currency)) {
      setCurrencyState(profile.display_currency);
      localStorage.setItem('display-currency', profile.display_currency);
    }
  }, [profile?.display_currency]);

  const currencyConfig = CURRENCIES[currency];
  const rates = ratesData?.rates ?? null;
  const isConverted = currency !== BASE_CURRENCY;

  const setCurrency = useCallback((code: CurrencyCode) => {
    setCurrencyState(code);
    localStorage.setItem('display-currency', code);
    // Persist to database (fire-and-forget)
    setDisplayCurrency.mutate(code);
  }, [setDisplayCurrency]);

  const formatter = useMemo(
    () =>
      new Intl.NumberFormat(currencyConfig.locale, {
        style: 'currency',
        currency: currencyConfig.code,
      }),
    [currencyConfig]
  );

  const convertAmount = useCallback(
    (amountInBRL: number): number => {
      if (!isConverted) return amountInBRL;
      if (!rates) return amountInBRL;
      return convertFromBRL(amountInBRL, currency, rates);
    },
    [currency, rates, isConverted]
  );

  const toBaseCurrency = useCallback(
    (amountInDisplayCurrency: number): number => {
      if (!isConverted) return amountInDisplayCurrency;
      if (!rates) return amountInDisplayCurrency;
      return convertToBRL(amountInDisplayCurrency, currency, rates);
    },
    [currency, rates, isConverted]
  );

  const formatAmount = useCallback(
    (amountInBRL: number): string => {
      const converted = convertAmount(amountInBRL);
      return formatter.format(converted);
    },
    [convertAmount, formatter]
  );

  const value = useMemo<CurrencyContextValue>(
    () => ({
      currency,
      currencyConfig,
      setCurrency,
      formatAmount,
      convertAmount,
      toBaseCurrency,
      rates,
      isLoadingRates,
      isConverted,
      formatter,
    }),
    [currency, currencyConfig, setCurrency, formatAmount, convertAmount, toBaseCurrency, rates, isLoadingRates, isConverted, formatter]
  );

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return ctx;
}
