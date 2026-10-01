/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { notifications } from "@mantine/notifications";
import { useNavigate } from "react-router-dom";
import { api, ensureCsrfCookie } from "../shared/api";
import { subscribeToSessionExpired } from "../shared/authSession";
import { fetchAuthStatus } from "../shared/authStatus";
import type { AuthUser, CapabilityKey } from "../shared/authStatus";
import { queryClient } from "../shared/queryClient";

type AuthContextType = {
  isAuthenticated: boolean;
  isAuthResolved: boolean;
  user: AuthUser | null;
  login: () => Promise<void>;
  logout: () => void;
  hasCapability: (capability: CapabilityKey) => boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthResolved, setIsAuthResolved] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const hydrated = useRef(false);
  const navigate = useNavigate();

  const login = useCallback(async () => {
    const authenticatedUser = await fetchAuthStatus();
    setUser(authenticatedUser);
    setIsAuthenticated(true);
    setIsAuthResolved(true);
    sessionStorage.setItem("hasAuth", "true");
  }, []);

  const logout = useCallback(() => {
    setIsAuthenticated(false);
    setUser(null);
    setIsAuthResolved(true);
    sessionStorage.removeItem("hasAuth");
    queryClient.clear();
    void ensureCsrfCookie()
      .then(() => api.post("/api/auth/logout/", {}, { withCredentials: true }))
      .catch(() => {});
    notifications.show({ message: "Sessão encerrada.", color: "blue" });
    navigate("/login");
  }, [navigate]);

  useEffect(
    () =>
      subscribeToSessionExpired(() => {
        setIsAuthenticated(false);
        setUser(null);
        setIsAuthResolved(true);
        sessionStorage.removeItem("hasAuth");
        queryClient.clear();
        navigate("/login", { replace: true });
      }),
    [navigate],
  );

  const hasCapability = useCallback(
    (capability: CapabilityKey) =>
      Boolean(user?.is_superuser || user?.capabilities.includes(capability)),
    [user]
  );

  const value = useMemo(
    () => ({ isAuthenticated, isAuthResolved, user, login, logout, hasCapability }),
    [isAuthenticated, isAuthResolved, user, login, logout, hasCapability]
  );

  useEffect(() => {
    void ensureCsrfCookie().catch(() => {});

    if (hydrated.current) return;

    if (!sessionStorage.getItem("hasAuth")) {
      setIsAuthResolved(true);
      hydrated.current = true;
      return;
    }

    fetchAuthStatus()
      .then((authenticatedUser) => {
        setUser(authenticatedUser);
        setIsAuthenticated(true);
      })
      .catch(() => {
        setIsAuthenticated(false);
        setUser(null);
        sessionStorage.removeItem("hasAuth");
      })
      .finally(() => {
        setIsAuthResolved(true);
      });

    hydrated.current = true;
  }, []);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
