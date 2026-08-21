import type { AuthUser, TokenResponse } from "@/lib/types";
import { api, getAccessToken, setAccessToken } from "@/services/api";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<AuthUser | null>;
  verifyEmail: (email: string, otp: string) => Promise<AuthUser | null>;
  logout: () => Promise<void>;
  refresh: () => Promise<AuthUser | null>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const applyTokenResponse = async (response: TokenResponse) => {
    setAccessToken(response.access_token);
    if (response.user) {
      setUser(response.user);
      return response.user;
    }
    return refreshUser();
  };

  const refreshUser = async () => {
    try {
      const currentUser = await api.auth.me();
      setUser(currentUser);
      return currentUser;
    } catch {
      setAccessToken(null);
      setUser(null);
      return null;
    }
  };

  useEffect(() => {
    const handleExpired = () => setUser(null);
    window.addEventListener("ai-memory-hub.auth-expired", handleExpired);
    if (!getAccessToken()) {
      setIsLoading(false);
      return () => window.removeEventListener("ai-memory-hub.auth-expired", handleExpired);
    }
    refreshUser().finally(() => setIsLoading(false));
    return () => window.removeEventListener("ai-memory-hub.auth-expired", handleExpired);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    isLoading,
    isAuthenticated: !!user,
    signIn: async (email, password) => applyTokenResponse(await api.auth.signIn(email, password)),
    verifyEmail: async (email, otp) => applyTokenResponse(await api.auth.verifyEmailOtp(email, otp)),
    logout: async () => {
      try {
        if (getAccessToken()) await api.auth.logout();
      } finally {
        setAccessToken(null);
        setUser(null);
      }
    },
    refresh: refreshUser,
  }), [isLoading, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
