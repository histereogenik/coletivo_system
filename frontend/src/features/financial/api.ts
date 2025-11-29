import { api } from "../../shared/api";

export type FinancialEntry = {
  id: number;
  entry_type: "ENTRADA" | "SAIDA";
  category: string;
  description: string;
  value_cents: number;
  date: string;
};

export async function fetchFinancialEntries(params?: Record<string, string | number | undefined>) {
  const { data } = await api.get<FinancialEntry[]>("/api/financial/entries/", { params });
  return data;
}

export async function createFinancialEntry(payload: Partial<FinancialEntry>) {
  const { data } = await api.post<FinancialEntry>("/api/financial/entries/", payload);
  return data;
}

export async function updateFinancialEntry(id: number, payload: Partial<FinancialEntry>) {
  const { data } = await api.patch<FinancialEntry>(`/api/financial/entries/${id}/`, payload);
  return data;
}

export async function deleteFinancialEntry(id: number) {
  await api.delete(`/api/financial/entries/${id}/`);
}
