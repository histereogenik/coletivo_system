import { api } from "./api";

export async function fetchAuthStatus() {
  const { data } = await api.get<{ id: number; username: string }>("/api/auth/status/");
  return data;
}
