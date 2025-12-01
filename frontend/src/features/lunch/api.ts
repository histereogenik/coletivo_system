import { api } from "../../shared/api";

export type Lunch = {
  id: number;
  member: number;
  member_name?: string;
  value_cents: number;
  date: string;
  lunch_type: string;
  payment_status: string;
  quantity?: number | null;
  remaining_quantity?: number | null;
  package_expiration?: string | null;
  package_status?: string | null;
  payment_mode?: string | null;
};

export async function fetchLunches(params?: Record<string, string | number | undefined>) {
  const { data } = await api.get<Lunch[]>("/api/lunch/lunches/", { params });
  return data;
}

export async function markLunchPaid(id: number) {
  const { data } = await api.patch<Lunch>(`/api/lunch/lunches/${id}/`, {
    payment_status: "PAGO",
  });
  return data;
}

export async function createLunch(payload: Partial<Lunch>) {
  const { data } = await api.post<Lunch>("/api/lunch/lunches/", payload);
  return data;
}

export async function updateLunch(id: number, payload: Partial<Lunch>) {
  const { data } = await api.patch<Lunch>(`/api/lunch/lunches/${id}/`, payload);
  return data;
}

export async function deleteLunch(id: number) {
  await api.delete(`/api/lunch/lunches/${id}/`);
}

export async function decrementLunch(id: number, amount = 1) {
  const { data } = await api.post<Lunch>(`/api/lunch/lunches/${id}/decrement/`, { amount });
  return data;
}

export async function incrementLunch(id: number, amount = 1) {
  const { data } = await api.post<Lunch>(`/api/lunch/lunches/${id}/increment/`, { amount });
  return data;
}
