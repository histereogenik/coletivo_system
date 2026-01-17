import { api } from "../../shared/api";

export type Lunch = {
  id: number;
  member: number;
  member_name?: string;
  value_cents: number;
  date: string;
  payment_status: string;
  payment_mode?: string | null;
  package?: number | null;
  package_remaining?: number | null;
};

export type Package = {
  id: number;
  member: number;
  member_name?: string;
  value_cents: number;
  date: string;
  payment_status: string;
  payment_mode?: string | null;
  quantity: number;
  remaining_quantity: number;
  expiration: string;
  status: string;
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

export async function createLunch(payload: Partial<Lunch> & { use_package?: boolean }) {
  const { data } = await api.post<Lunch>("/api/lunch/lunches/", payload);
  return data;
}

export async function updateLunch(id: number, payload: Partial<Lunch> & { use_package?: boolean }) {
  const { data } = await api.patch<Lunch>(`/api/lunch/lunches/${id}/`, payload);
  return data;
}

export async function deleteLunch(id: number) {
  await api.delete(`/api/lunch/lunches/${id}/`);
}

export async function fetchPackages(params?: Record<string, string | number | undefined>) {
  const { data } = await api.get<Package[]>("/api/lunch/packages/", { params });
  return data;
}

export async function createPackage(payload: Partial<Package>) {
  const { data } = await api.post<Package>("/api/lunch/packages/", payload);
  return data;
}

export async function updatePackage(id: number, payload: Partial<Package>) {
  const { data } = await api.patch<Package>(`/api/lunch/packages/${id}/`, payload);
  return data;
}

export async function deletePackage(id: number) {
  await api.delete(`/api/lunch/packages/${id}/`);
}

export async function decrementPackage(id: number, amount = 1) {
  const { data } = await api.post<Package>(`/api/lunch/packages/${id}/decrement/`, { amount });
  return data;
}

export async function incrementPackage(id: number, amount = 1) {
  const { data } = await api.post<Package>(`/api/lunch/packages/${id}/increment/`, { amount });
  return data;
}
