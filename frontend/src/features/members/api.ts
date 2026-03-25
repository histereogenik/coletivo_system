import { api } from "../../shared/api";
import { type PaginatedResponse } from "../../shared/pagination";

export type Member = {
  id: number;
  full_name: string;
  is_child: boolean;
  responsible?: number | null;
  responsible_name?: string | null;
  phone?: string | null;
  email?: string | null;
  address: string;
  heard_about: string;
  role: "SUSTENTADOR" | "MENSALISTA" | "AVULSO" | null;
  diet: "VEGANO" | "VEGETARIANO" | "CARNIVORO";
  observations?: string;
  created_at?: string;
  updated_at?: string;
};

export type PublicRegistrationChild = {
  id: number;
  full_name: string;
  diet: Member["diet"];
  observations?: string;
  created_at?: string;
  updated_at?: string;
};

export type PublicRegistration = {
  id: number;
  full_name: string;
  phone?: string | null;
  email?: string | null;
  address: string;
  heard_about: string;
  role: Exclude<Member["role"], null>;
  diet: Member["diet"];
  observations?: string;
  status: "PENDENTE" | "APROVADO" | "REJEITADO";
  review_notes?: string;
  children: PublicRegistrationChild[];
  created_at?: string;
  updated_at?: string;
};

export type PublicRegistrationMeta = {
  role: Array<{ value: Exclude<Member["role"], null>; label: string }>;
  diet: Array<{ value: Member["diet"]; label: string }>;
};

export async function fetchMembers(params?: Record<string, string | number | undefined>) {
  const { data } = await api.get<Member[]>("/api/users/members/", { params });
  return data;
}

export async function fetchMembersPage(params?: Record<string, string | number | undefined>) {
  const { data } = await api.get<PaginatedResponse<Member>>("/api/users/members/", { params });
  return data;
}

export async function createMember(payload: Partial<Member>) {
  const { data } = await api.post<Member>("/api/users/members/", payload);
  return data;
}

export async function updateMember(id: number, payload: Partial<Member>) {
  const { data } = await api.patch<Member>(`/api/users/members/${id}/`, payload);
  return data;
}

export async function deleteMember(id: number) {
  await api.delete(`/api/users/members/${id}/`);
}

export async function fetchPublicRegistrations(
  params?: Record<string, string | number | undefined>
) {
  const { data } = await api.get<PaginatedResponse<PublicRegistration>>(
    "/api/users/public-registrations-admin/",
    { params }
  );
  return data;
}

export async function fetchPublicRegistration(id: number) {
  const { data } = await api.get<PublicRegistration>(`/api/users/public-registrations-admin/${id}/`);
  return data;
}

export async function approvePublicRegistration(id: number) {
  const { data } = await api.post<PublicRegistration>(
    `/api/users/public-registrations-admin/${id}/approve/`,
    {}
  );
  return data;
}

export async function rejectPublicRegistration(id: number, payload: { review_notes?: string }) {
  const { data } = await api.post<PublicRegistration>(
    `/api/users/public-registrations-admin/${id}/reject/`,
    payload
  );
  return data;
}

export async function fetchPublicRegistrationMeta() {
  const { data } = await api.get<PublicRegistrationMeta>("/api/users/public-registrations/meta/");
  return data;
}
