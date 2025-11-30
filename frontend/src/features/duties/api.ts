import { api } from "../../shared/api";

export type Duty = {
  id: number;
  name: string;
  remuneration_cents?: number;
};

export async function fetchDuties() {
  const { data } = await api.get<Duty[]>("/api/duties/duties/");
  return data;
}
