import { parseDateOnly, toLocalDateString } from "@/lib/date";

export interface InstallmentLike {
  date: string;
  description: string;
  amount: number;
  installment_number?: number;
  installment_total?: number;
  installment_key?: string | null;
}

export const normalizeDescription = (text: string) =>
  stripInstallmentInfo(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export const buildInstallmentKey = (t: Pick<InstallmentLike, 'description' | 'amount' | 'date'>) => {
  const cents = Math.round(Math.abs(Number(t.amount) || 0) * 100);
  const day = (() => {
    const d = parseDateOnly(t.date);
    return Number.isFinite(d.getTime()) ? d.getDate() : 1;
  })();
  return `${normalizeDescription(t.description)}|${cents}|${String(day).padStart(2, '0')}`;
};

const stripInstallmentInfo = (text: string): string => {
  if (!text) return "";
  let result = text;

  // Remove patterns at the end like "1/5", " 1/5 "
  result = result.replace(/(\d{1,2})\s*\/\s*(\d{1,2})\s*$/i, "");

  // Remove "parcela 1 de 5" / "parcela 1/5"
  result = result.replace(/parcela\s+\d{1,2}\s*(?:de|\/)\s*\d{1,2}\s*$/i, "");

  // Remove "3a de 7"
  result = result.replace(/(\d{1,2})[ªa]?\s+de\s+\d{1,2}\s*$/i, "");

  return result.trim();
};

export const addMonthsKeepDay = (
  dateStr: string,
  offset: number,
  reference?: { month: number; year: number }
) => {
  const base = reference
    ? new Date(reference.year, reference.month - 1, 1)
    : parseDateOnly(dateStr);
  if (Number.isNaN(base.getTime())) return dateStr;
  const original = parseDateOnly(dateStr);
  const day = Number.isNaN(original.getTime()) ? 1 : original.getDate();
  const target = new Date(base.getFullYear(), base.getMonth() + offset + 1, 0);
  const safeDay = Math.min(day, target.getDate());
  target.setDate(safeDay);
  return toLocalDateString(target);
};

export const expandInstallment = <T extends InstallmentLike>(
  t: T,
  options?: { referenceMonth?: number; referenceYear?: number }
): T[] => {
  if (!t.installment_number || !t.installment_total || t.installment_total < t.installment_number) {
    return [t];
  }

  const key = t.installment_key || buildInstallmentKey(t);
  const reference =
    options?.referenceMonth && options.referenceYear
      ? { month: options.referenceMonth, year: options.referenceYear }
      : undefined;

  const parcels: T[] = [];
  for (let i = 1; i <= t.installment_total; i++) {
    const monthOffset = i - t.installment_number;
    parcels.push({
      ...t,
      date: addMonthsKeepDay(t.date, monthOffset, reference),
      installment_number: i,
      installment_total: t.installment_total,
      installment_key: key,
    });
  }
  return parcels;
};
