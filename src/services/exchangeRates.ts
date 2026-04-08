import type { CurrencyCode } from '@/lib/currencies';

export interface ExchangeRates {
  base: 'BRL';
  date: string;
  rates: Partial<Record<CurrencyCode, number>>;
}

const API_URL = 'https://api.frankfurter.dev/v1/latest';

export async function fetchExchangeRates(): Promise<ExchangeRates> {
  const response = await fetch(`${API_URL}?from=BRL&to=USD,CAD`);

  if (!response.ok) {
    throw new Error(`Exchange rate API error: ${response.status}`);
  }

  const data = await response.json();

  return {
    base: 'BRL',
    date: data.date,
    rates: {
      BRL: 1,
      USD: data.rates.USD,
      CAD: data.rates.CAD,
    },
  };
}

export function convertFromBRL(
  amountBRL: number,
  targetCurrency: CurrencyCode,
  rates: ExchangeRates['rates']
): number {
  if (targetCurrency === 'BRL') return amountBRL;

  const rate = rates[targetCurrency];
  if (!rate) return amountBRL;

  return Math.round(amountBRL * rate * 100) / 100;
}

export function convertToBRL(
  amount: number,
  sourceCurrency: CurrencyCode,
  rates: ExchangeRates['rates']
): number {
  if (sourceCurrency === 'BRL') return amount;

  const rate = rates[sourceCurrency];
  if (!rate) return amount;

  return Math.round((amount / rate) * 100) / 100;
}
