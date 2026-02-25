import { api } from "../../shared/api";
import { fetchAllPages } from "../../shared/pagination";

export type AgendaEntry = {
  id: number;
  date: string;
  start_time: string;
  end_time?: string | null;
  duty: number;
  duty_name?: string;
  status: string;
  notes?: string;
  members: { id: number; full_name: string }[];
};

export async function fetchAgenda(params?: Record<string, string | number | undefined>) {
  return fetchAllPages<AgendaEntry>("/api/agenda/entries/", params);
}

export async function createAgendaEntry(payload: Partial<AgendaEntry> & { member_ids?: number[] }) {
  const { data } = await api.post<AgendaEntry>("/api/agenda/entries/", payload);
  return data;
}

export async function updateAgendaEntry(
  id: number,
  payload: Partial<AgendaEntry> & { member_ids?: number[] }
) {
  const { data } = await api.patch<AgendaEntry>(`/api/agenda/entries/${id}/`, payload);
  return data;
}

export async function deleteAgendaEntry(id: number) {
  await api.delete(`/api/agenda/entries/${id}/`);
}
