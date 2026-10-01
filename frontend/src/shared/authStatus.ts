import { api } from "./api";

export type CapabilityKey =
  | "lunches"
  | "packages"
  | "financial"
  | "fiscal"
  | "credits"
  | "agenda"
  | "members"
  | "duties";

export type AuthUser = {
  id: number;
  username: string;
  display_name: string;
  is_superuser: boolean;
  capabilities: CapabilityKey[];
};

export async function fetchAuthStatus() {
  const { data } = await api.get<AuthUser>("/api/auth/status/");
  return data;
}
