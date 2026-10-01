import { api } from "../../shared/api";
import type { CapabilityKey } from "../../shared/authStatus";

export type CapabilityOption = {
  key: CapabilityKey;
  label: string;
  route: string;
};

export type OperatorAccount = {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  display_name: string;
  is_active: boolean;
  last_login: string | null;
  granted_capabilities: CapabilityKey[];
};

export type OperatorPayload = {
  username: string;
  first_name: string;
  last_name: string;
  password?: string;
  is_active: boolean;
  capabilities: CapabilityKey[];
};

export async function fetchCapabilities() {
  const { data } = await api.get<CapabilityOption[]>("/api/auth/capabilities/");
  return data;
}

export async function fetchOperators() {
  const { data } = await api.get<OperatorAccount[]>("/api/auth/operators/");
  return data;
}

export async function createOperator(payload: OperatorPayload) {
  const { data } = await api.post<OperatorAccount>("/api/auth/operators/", payload);
  return data;
}

export async function updateOperator(id: number, payload: OperatorPayload) {
  const { data } = await api.patch<OperatorAccount>(`/api/auth/operators/${id}/`, payload);
  return data;
}
