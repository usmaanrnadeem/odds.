"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api, User, tokenStore } from "./api";

type AuthCtx = {
  user: User | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  updatePoints: (points: number) => void;
};

const Ctx = createContext<AuthCtx>({
  user: null,
  loading: true,
  refresh: async () => {},
  logout: async () => {},
  updatePoints: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    if (!tokenStore.get()) {
      setUser(null);
      return;
    }
    try {
      const u = await api.me();
      if (u.access_token) tokenStore.set(u.access_token);
      setUser(u);
    } catch {
      tokenStore.clear(); // token was invalid/expired — clear it
      setUser(null);
    }
  }

  function updatePoints(points: number) {
    setUser(prev => prev ? { ...prev, points } : null);
  }

  async function logout() {
    await api.logout().catch(() => {});
    tokenStore.clear();
    setUser(null);
  }

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  return <Ctx.Provider value={{ user, loading, refresh, logout, updatePoints }}>{children}</Ctx.Provider>;
}

export function useUser() {
  return useContext(Ctx);
}
