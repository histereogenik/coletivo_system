import { api } from "../../shared/api";
import type { PaginatedResponse } from "../../shared/pagination";

export type FiscalDocumentStatus =
  | "PENDING"
  | "PROCESSING"
  | "AUTHORIZED"
  | "REJECTED"
  | "CANCELLED";

export type FiscalDocument = {
  id: number;
  reference: string;
  document_type: "NFE" | "NFCE";
  environment: "HOMOLOGATION" | "PRODUCTION";
  status: FiscalDocumentStatus;
  source_type: "LUNCH" | "PACKAGE" | "MANUAL";
  source_id: number | null;
  manual_description: string;
  manual_value_cents: number | null;
  manual_payment_method: string;
  sale_date: string;
  recipient: FiscalRecipient;
  items: Array<Record<string, unknown>>;
  payment_methods: Array<Record<string, unknown>>;
  focus_status: string;
  number: string;
  series: string;
  access_key: string;
  protocol: string;
  xml_url: string;
  danfe_url: string;
  sefaz_code: string;
  error_message: string;
  emitted_at: string | null;
  authorized_at: string | null;
  created_at: string;
  updated_at?: string;
};

export type FiscalAddress = {
  street: string;
  number: string;
  complement?: string;
  district: string;
  city: string;
  state: string;
  postal_code: string;
};

export type FiscalRecipient = {
  name?: string;
  tax_id?: string;
  email?: string;
  state_registration_indicator?: "1" | "2" | "9";
  state_registration?: string;
  address?: FiscalAddress;
};

export type FiscalEmissionPayload = {
  source_type: "LUNCH" | "PACKAGE" | "MANUAL";
  source_id?: number;
  manual?: {
    sale_date: string;
    description: string;
    value_cents: number;
    payment_method: "01" | "20" | "99";
    request_key: string;
  };
  recipient: FiscalRecipient;
  presence: 0 | 1 | 2 | 3 | 4 | 9;
};

export type FiscalConfiguration = {
  environment: "homologation" | "production";
  production_allowed: boolean;
  package_emission_allowed: boolean;
  manual_emission_allowed: boolean;
  webhook_configured: boolean;
  ready: boolean;
  missing: string[];
  fiscal_profile: {
    ncm: string;
    cfop: string;
    csosn: string;
  };
};

export async function fetchFiscalConfiguration() {
  const { data } = await api.get<FiscalConfiguration>("/api/fiscal/documents/configuration/");
  return data;
}

export async function fetchFiscalDocuments(params?: Record<string, string | number | undefined>) {
  const { data } = await api.get<PaginatedResponse<FiscalDocument>>("/api/fiscal/documents/", {
    params,
  });
  return data;
}

export async function emitFiscalDocument(payload: FiscalEmissionPayload) {
  const { data } = await api.post<FiscalDocument>("/api/fiscal/documents/emit/", payload);
  return data;
}

export async function refreshFiscalDocument(id: number) {
  const { data } = await api.post<FiscalDocument>(`/api/fiscal/documents/${id}/refresh/`);
  return data;
}
