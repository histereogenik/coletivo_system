/* eslint-disable react-refresh/only-export-components */
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import type { CapabilityKey } from "../shared/authStatus";

const capabilityRoutes: Array<[CapabilityKey, string]> = [
  ["lunches", "/painel/almocos"],
  ["packages", "/painel/pacotes"],
  ["financial", "/painel/financeiro"],
  ["fiscal", "/painel/notas-fiscais"],
  ["credits", "/painel/creditos"],
  ["agenda", "/painel/agenda"],
  ["members", "/painel/integrantes"],
  ["duties", "/painel/funcoes"],
];

export function firstAllowedRoute(capabilities: CapabilityKey[], isSuperuser = false) {
  if (isSuperuser) return "/painel";
  return (
    capabilityRoutes.find(([key]) => capabilities.includes(key))?.[1] ?? "/painel/sem-acesso"
  );
}

export function RequireCapability({
  capability,
  children,
}: {
  capability: CapabilityKey;
  children: React.ReactNode;
}) {
  const { user, hasCapability } = useAuth();
  if (hasCapability(capability)) return children;
  return (
    <Navigate
      to={firstAllowedRoute(user?.capabilities ?? [], Boolean(user?.is_superuser))}
      replace
    />
  );
}

export function RequireSuperuser({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user?.is_superuser) return children;
  return (
    <Navigate
      to={firstAllowedRoute(user?.capabilities ?? [], Boolean(user?.is_superuser))}
      replace
    />
  );
}
