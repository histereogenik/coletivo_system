/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { notifications } from "@mantine/notifications";
import { useNavigate } from "react-router-dom";
import { api, ensureCsrfCookie } from "../shared/api";
import { fetchAuthStatus } from "../shared/authStatus";

type AuthContextType = {
  isAuthenticated: boolean;
  isAuthResolved: boolean;
  login: () => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthResolved, setIsAuthResolved] = useState(false);
  const hydrated = useRef(false);
  const navigate = useNavigate();

  const login = useCallback(() => {
    setIsAuthenticated(true);
    setIsAuthResolved(true);
    sessionStorage.setItem("hasAuth", "true");
  }, []);

  const logout = useCallback(() => {
    setIsAuthenticated(false);
    setIsAuthResolved(true);
    sessionStorage.removeItem("hasAuth");
    void ensureCsrfCookie()
      .then(() => api.post("/api/auth/logout/", {}, { withCredentials: true }))
      .catch(() => {});
    notifications.show({ message: "Sessão encerrada.", color: "blue" });
    navigate("/login");
  }, [navigate]);

  const value = useMemo(
    () => ({ isAuthenticated, isAuthResolved, login, logout }),
    [isAuthenticated, isAuthResolved, login, logout]
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
      .then(() => {
        setIsAuthenticated(true);
      })
      .catch(() => {
        setIsAuthenticated(false);
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
