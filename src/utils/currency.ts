export const parseCurrencyInput = (input: string): string => {
  const digitsOnly = input.replace(/\D/g, '');
  if (!digitsOnly) {
    return '';
  }

  const normalized = Number(digitsOnly) / 100;
  if (Number.isNaN(normalized)) {
    return '';
  }

  return normalized.toFixed(2);
};

export const formatCurrencyDisplay = (value: string): string => {
  if (!value) {
    return '';
  }

  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) {
    return '';
  }

  return numericValue.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const initializeCurrencyValue = (value?: number | null): string => {
  if (value === undefined || value === null) {
    return '';
  }

  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) {
    return '';
  }

  return numericValue.toFixed(2);
};
