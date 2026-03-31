export const formatCents = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

export const formatCentsInput = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const parseReaisToCents = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const parsed = parseFloat(trimmed.replace(/\./g, "").replace(",", "."));
  if (Number.isNaN(parsed)) return NaN;
  return Math.round(parsed * 100);
};

