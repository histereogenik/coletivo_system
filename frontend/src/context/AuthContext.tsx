/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { notifications } from "@mantine/notifications";
import { useNavigate } from "react-router-dom";
import { api } from "../shared/api";
import { fetchAuthStatus } from "../shared/authStatus";

type AuthContextType = {
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const hydrated = useRef(false);
  const navigate = useNavigate();

  const login = useCallback(() => {
    setIsAuthenticated(true);
    sessionStorage.setItem("hasAuth", "true");
  }, []);

  const logout = useCallback(() => {
    setIsAuthenticated(false);
    sessionStorage.removeItem("hasAuth");
    void api.post("/api/auth/logout/", {}, { withCredentials: true }).catch(() => {});
    notifications.show({ message: "Sessão encerrada.", color: "blue" });
    navigate("/login");
  }, [navigate]);

  const value = useMemo(() => ({ isAuthenticated, login, logout }), [isAuthenticated, login, logout]);

  // Hydrate auth status from cookie on load
  useEffect(() => {
    if (hydrated.current) return;
    if (sessionStorage.getItem("hasAuth")) {
      fetchAuthStatus()
        .then(() => {
          setIsAuthenticated(true);
        })
        .catch(() => {
          setIsAuthenticated(false);
          sessionStorage.removeItem("hasAuth");
        });
    }
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
