export const parseDateOnly = (value: string): Date => {
  if (!value) return new Date(NaN);
  if (value.includes("T")) return new Date(value);
  return new Date(`${value}T00:00:00`);
};

export const toLocalDateString = (date: Date): string => {
  if (!Number.isFinite(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
