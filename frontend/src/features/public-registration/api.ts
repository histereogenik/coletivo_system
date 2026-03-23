import { api } from "../../shared/api";
import type {
  PublicRegistrationMeta,
  PublicRegistrationPayload,
  PublicRegistrationSubmitResponse,
} from "./types";

export async function fetchPublicRegistrationMeta() {
  const { data } = await api.get<PublicRegistrationMeta>("/api/users/public-registrations/meta/");
  return data;
}

export async function submitPublicRegistration(payload: PublicRegistrationPayload) {
  const { data } = await api.post<PublicRegistrationSubmitResponse>("/api/users/public-registrations/", payload);
  return data;
}
