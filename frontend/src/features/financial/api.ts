import { api } from "../../shared/api";
import { type PaginatedResponse } from "../../shared/pagination";

export type FinancialEntry = {
  id: number;
  entry_type: "ENTRADA" | "SAIDA";
  category: string;
  description: string;
  value_cents: number;
  date: string;
};

export type FinancialSummary = {
  month: {
    entradas_cents: number;
    saidas_cents: number;
    saldo_cents: number;
  };
  total: {
    entradas_cents: number;
    saidas_cents: number;
    saldo_cents: number;
  };
  filtered?: {
    entradas_cents: number;
    saidas_cents: number;
    saldo_cents: number;
    count: number;
  };
};

export async function fetchFinancialEntries(params?: Record<string, string | number | undefined>) {
  const { data } = await api.get<PaginatedResponse<FinancialEntry>>("/api/financial/entries/", {
    params,
  });
  return data;
}

export async function fetchFinancialSummary(params?: Record<string, string | number | undefined>) {
  const { data } = await api.get<FinancialSummary>("/api/financial/summary/", { params });
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
