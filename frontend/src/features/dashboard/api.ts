import { api } from "../../lib/api";
import { DashboardSummary } from "./types";

export async function fetchDashboardSummary() {
  const { data } = await api.get<DashboardSummary>("/api/dashboard/summary/");
  return data;
}
