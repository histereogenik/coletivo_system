import { api } from "../../shared/api";
import { fetchAllPages, type PaginatedResponse } from "../../shared/pagination";

export type Duty = {
  id: number;
  name: string;
  remuneration_cents?: number;
  members?: { id: number; full_name: string }[];
};

export async function fetchDuties(params?: Record<string, string | number | undefined>) {
  const { data } = await api.get<PaginatedResponse<Duty>>("/api/duties/duties/", { params });
  return data;
}

export async function fetchAllDuties() {
  return fetchAllPages<Duty>("/api/duties/duties/");
}

export async function createDuty(payload: Partial<Duty> & { member_ids?: number[] }) {
  const { data } = await api.post<Duty>("/api/duties/duties/", payload);
  return data;
}

export async function updateDuty(id: number, payload: Partial<Duty> & { member_ids?: number[] }) {
  const { data } = await api.patch<Duty>(`/api/duties/duties/${id}/`, payload);
  return data;
}

export async function deleteDuty(id: number) {
  await api.delete(`/api/duties/duties/${id}/`);
}
