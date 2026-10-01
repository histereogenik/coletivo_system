import { api } from "../../shared/api";
import type { PaginatedResponse } from "../../shared/pagination";

export type AuditEvent = {
  id: number;
  actor_name: string;
  action: string;
  action_label: string;
  source: string;
  entity_type: string;
  object_id: string;
  object_repr: string;
  changes: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
};

export type AuditFilters = {
  actor?: string;
  action?: string;
  source?: string;
  entity_type?: string;
  object_id?: string;
  created_from?: string;
  created_to?: string;
};

export type AuditFilterOptions = {
  actors: Array<{ value: string; label: string }>;
  actions: Array<{ value: string; label: string }>;
  sources: Array<{ value: string; label: string }>;
  entity_types: string[];
};

export async function fetchAuditEvents(
  page: number,
  pageSize: number,
  filters: AuditFilters = {}
) {
  const { data } = await api.get<PaginatedResponse<AuditEvent>>("/api/common/audit-events/", {
    params: { page, page_size: pageSize, ...filters },
  });
  return data;
}

export async function fetchAuditFilterOptions() {
  const { data } = await api.get<AuditFilterOptions>(
    "/api/common/audit-events/filter-options/"
  );
  return data;
}
