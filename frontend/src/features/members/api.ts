import { api } from "../../shared/api";

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

export async function fetchMembers(params?: Record<string, string | number | undefined>) {
  const { data } = await api.get<Member[]>("/api/users/members/", { params });
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
