import { api } from "../../shared/api";

export type MemberOption = {
  id: number;
  full_name: string;
};

export async function fetchMembers() {
  const { data } = await api.get<MemberOption[]>("/api/users/members/");
  return data;
}
