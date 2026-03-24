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
