import type { CurrencyCode } from './currencies';
import { CURRENCIES } from './currencies';

// --- Input parsing (always BRL — users enter amounts in BRL) ---

export const formatCurrencyInput = (value: string): string => {
  const numbers = value.replace(/\D/g, "");
  if (!numbers) return "";
  const amount = parseFloat(numbers) / 100;
  return amount.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const parseCurrencyToDecimal = (value: string): string => {
  const numbers = value.replace(/\D/g, "");
  if (!numbers) return "0";
  return (parseFloat(numbers) / 100).toString();
};

export const formatDecimalToDisplay = (decimal: string | number): string => {
  if (decimal === null || decimal === undefined || decimal === "" || decimal === "0") {
    return "";
  }
  const num =
    typeof decimal === "number" ? decimal : parseFloat(decimal.replace(",", "."));
  if (Number.isNaN(num)) return "";
  return num.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

// --- Locale-aware amount input formatting ---

/**
 * Format a numeric string with thousand separators and 2 decimal places
 * using the given locale. Used for amount input fields on blur.
 */
export function formatAmountForInput(value: string | number, locale: string): string {
  const num = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'));
  if (!num && num !== 0) return '';
  if (Number.isNaN(num)) return '';
  return num.toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Parse a locale-formatted amount string back to a plain decimal number string.
 * Handles both comma-decimal (pt-BR: "1.000,50") and dot-decimal (en-US: "1,000.50") formats.
 */
export function parseAmountFromInput(value: string): number {
  if (!value) return 0;
  const trimmed = value.trim();

  // Detect format by looking at the last separator
  const lastComma = trimmed.lastIndexOf(',');
  const lastDot = trimmed.lastIndexOf('.');

  let normalized: string;
  if (lastComma > lastDot) {
    // Comma is decimal separator (pt-BR style: "1.000,50")
    normalized = trimmed.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma) {
    // Dot is decimal separator (en-US style: "1,000.50")
    normalized = trimmed.replace(/,/g, '');
  } else {
    // No separators or only one type
    normalized = trimmed.replace(/,/g, '');
  }

  const num = parseFloat(normalized);
  return Number.isNaN(num) ? 0 : num;
}

// --- Locale-aware display formatting ---

export function createCurrencyFormatter(currencyCode: CurrencyCode = 'BRL'): Intl.NumberFormat {
  const config = CURRENCIES[currencyCode];
  return new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency: config.code,
  });
}

export function formatAmountForLocale(
  amount: number,
  currencyCode: CurrencyCode = 'BRL'
): string {
  const formatter = createCurrencyFormatter(currencyCode);
  return formatter.format(amount);
}
