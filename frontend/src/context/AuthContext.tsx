/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from "../shared/auth";

type AuthContextType = {
  token: string | null;
  refresh: string | null;
  login: (access: string, refreshToken?: string) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(getAccessToken());
  const [refresh, setRefreshState] = useState<string | null>(getRefreshToken());

  const login = (access: string, refreshToken?: string) => {
    if (refreshToken) {
      setTokens(access, refreshToken);
      setRefreshState(refreshToken);
    }
    setTokenState(access);
  };

  const logout = () => {
    clearTokens();
    setTokenState(null);
    setRefreshState(null);
  };

  const value = useMemo(() => ({ token, refresh, login, logout }), [token, refresh]);

  useEffect(() => {
    const stored = getAccessToken();
    const storedRefresh = getRefreshToken();
    if (stored !== token) {
      setTokenState(stored);
    }
    if (storedRefresh !== refresh) {
      setRefreshState(storedRefresh);
    }
  }, [token, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
