/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from "react";
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

  const login = () => {
    setIsAuthenticated(true);
    sessionStorage.setItem("hasAuth", "true");
  };

  const logout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem("hasAuth");
    void api.post("/api/auth/logout/", {}, { withCredentials: true }).catch(() => {});
  };

  const value = useMemo(() => ({ isAuthenticated, login, logout }), [isAuthenticated]);

  // Hydrate auth status from cookie on load
  useEffect(() => {
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
