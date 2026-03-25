import { parseDateOnly } from "@/lib/date";

export type TransactionCandidate = {
  description: string;
  amount: number;
  type: 'despesa' | 'receita' | string;
  date: string;
  candidateKey?: string;
};

export type FixedCostCandidate = {
  title: string;
  amount: number;
  due_day: number | null;
};

export type FixedCostConflict = {
  transaction: TransactionCandidate;
  fixedCost: FixedCostCandidate;
  reason: 'exact' | 'different_day' | 'different_name' | 'different_amount';
};

export type DuplicateConflict = {
  transaction: TransactionCandidate;
  existingDates: string[];
  candidateKey: string;
};

const cents = (value: number) => Math.round(Number(value) * 100);

export const buildDuplicateKey = (description: string, amount: number) =>
  `${normalizeMatchText(description)}:${cents(amount)}`;

export const buildDuplicateCandidateKey = (candidate: TransactionCandidate) =>
  `${buildDuplicateKey(candidate.description, candidate.amount)}:${candidate.date}`;

export const normalizeMatchText = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const getDayOfMonth = (dateValue: string) => {
  const parsed = parseDateOnly(dateValue);
  if (!Number.isFinite(parsed.getTime())) return null;
  return parsed.getDate();
};

export const isInCurrentMonth = (dateValue: string, reference: Date) => {
  const parsed = parseDateOnly(dateValue);
  if (!Number.isFinite(parsed.getTime())) return false;
  return parsed.getFullYear() === reference.getFullYear() && parsed.getMonth() === reference.getMonth();
};

export const findFixedCostConflicts = (
  transactions: TransactionCandidate[],
  fixedCosts: FixedCostCandidate[],
): FixedCostConflict[] => {
  if (!transactions.length || !fixedCosts.length) return [];

  return transactions.reduce<FixedCostConflict[]>((acc, transaction) => {
    if (transaction.type !== 'despesa') return acc;

    const transactionName = normalizeMatchText(transaction.description);
    const transactionAmount = cents(transaction.amount);
    const transactionDay = getDayOfMonth(transaction.date);

    for (const cost of fixedCosts) {
      const costName = normalizeMatchText(cost.title);
      const costAmount = cents(cost.amount);
      const costDay = cost.due_day ?? null;

      const nameMatches = Boolean(transactionName && costName && transactionName === costName);
      const amountMatches = transactionAmount === costAmount;
      const dateMatches =
        transactionDay !== null && costDay !== null && transactionDay === costDay;

      const matchCount = Number(nameMatches) + Number(amountMatches) + Number(dateMatches);
      if (matchCount < 2) continue;

      let reason: FixedCostConflict['reason'] = 'exact';
      if (matchCount === 2) {
        if (nameMatches && amountMatches && !dateMatches) reason = 'different_day';
        if (amountMatches && dateMatches && !nameMatches) reason = 'different_name';
        if (nameMatches && dateMatches && !amountMatches) reason = 'different_amount';
      }

      acc.push({ transaction, fixedCost: cost, reason });
      break;
    }

    return acc;
  }, []);
};

export const findDuplicateConflicts = (
  transactions: TransactionCandidate[],
  existingTransactions: Array<{ description: string; amount: number; type: string; transaction_date: string }>,
): DuplicateConflict[] => {
  if (!transactions.length || !existingTransactions.length) return [];

  const existingMap = new Map<string, string[]>();
  existingTransactions.forEach((existing) => {
    if (existing.type !== 'despesa') return;
    const key = buildDuplicateKey(existing.description, existing.amount);
    const current = existingMap.get(key) ?? [];
    current.push(existing.transaction_date);
    existingMap.set(key, current);
  });

  return transactions.reduce<DuplicateConflict[]>((acc, transaction) => {
    if (transaction.type !== 'despesa') return acc;
    const key = buildDuplicateKey(transaction.description, transaction.amount);
    const existingDates = existingMap.get(key);
    if (existingDates && existingDates.length > 0) {
      const candidateKey = transaction.candidateKey ?? buildDuplicateCandidateKey(transaction);
      acc.push({ transaction, existingDates, candidateKey });
    }
    return acc;
  }, []);
};
