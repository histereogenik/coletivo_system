import { api } from "../../lib/api";

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
  const { data } = await api.get<AgendaEntry[]>("/api/agenda/entries/", { params });
  return data;
}
