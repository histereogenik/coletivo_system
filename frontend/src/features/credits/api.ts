import { api } from "../../shared/api";
import { type PaginatedResponse } from "../../shared/pagination";

export type CreditEntry = {
  id: number;
  owner: number;
  owner_name: string;
  beneficiary: number | null;
  beneficiary_name?: string | null;
  entry_type: "CREDITO" | "DEBITO";
  origin: "AGENDA" | "MANUAL" | "LUNCH" | "ESTORNO";
  value_cents: number;
  description: string;
  agenda_entry?: number | null;
  lunch?: number | null;
  created_by?: number | null;
  created_by_username?: string | null;
  created_at: string;
  updated_at: string;
};

export type CreditSummary = {
  owner: number;
  owner_name: string;
  credits_cents: number;
  debits_cents: number;
  balance_cents: number;
};

export type ManualCreditPayload = {
  owner: number;
  value_cents: number;
  description: string;
  beneficiary?: number | null;
};

export async function fetchCreditEntries(params?: Record<string, string | number | undefined>) {
  const { data } = await api.get<PaginatedResponse<CreditEntry>>("/api/credits/entries/", {
    params,
  });
  return data;
}

export async function fetchCreditSummary(owner: number) {
  const { data } = await api.get<CreditSummary>("/api/credits/summary/", {
    params: { owner },
  });
  return data;
}

export async function fetchCreditSummaries(
  params?: Record<string, string | number | undefined>
) {
  const { data } = await api.get<PaginatedResponse<CreditSummary>>("/api/credits/summary/", {
    params,
  });
  return data;
}

export async function createManualCredit(payload: ManualCreditPayload) {
  const { data } = await api.post<CreditEntry>("/api/credits/manual-credit/", payload);
  return data;
}

export async function createManualDebit(payload: ManualCreditPayload) {
  const { data } = await api.post<CreditEntry>("/api/credits/manual-debit/", payload);
  return data;
}
