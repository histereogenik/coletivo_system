import { api } from "../../shared/api";

export type FinancialEntry = {
  id: number;
  entry_type: string;
  category: string;
  description: string;
  value_cents: number;
  date: string;
};

export async function fetchFinancialEntries(params?: Record<string, string | number | undefined>) {
  const { data } = await api.get<FinancialEntry[]>("/api/financial/entries/", { params });
  return data;
}
