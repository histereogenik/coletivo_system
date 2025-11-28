/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { clearTokens, updateAccessToken } from "../shared/auth";

type AuthContextType = {
  token: string | null;
  refresh: string | null;
  login: (access: string) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [refresh, setRefreshState] = useState<string | null>(null);

  const login = (access: string) => {
    updateAccessToken(access);
    setTokenState(access);
  };

  const logout = () => {
    clearTokens();
    setTokenState(null);
    setRefreshState(null);
  };

  const value = useMemo(() => ({ token, refresh, login, logout }), [token, refresh]);

  useEffect(() => {
    const stored = localStorage.getItem("jwt_token");
    if (stored !== token) {
      setTokenState(stored);
    }
  }, [token]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
