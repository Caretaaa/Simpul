import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { PublicUser } from "@simpul/shared";
import { api, ApiError } from "../../lib/api";

interface AuthState {
  user: PublicUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<PublicUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [online, setOnline] = useState(navigator.onLine);
  const me = useQuery({
    queryKey: ["me"],
    // 401 = belum/ tidak lagi masuk → null, bukan error.
    queryFn: async () => {
      try {
        const r: { user: PublicUser } = await api.get<{ user: PublicUser }>("/auth/me");
        return r.user;
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    retry: false,
  });

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const r = await api.post<{ user: PublicUser }>("/auth/login", { email, password });
      await qc.invalidateQueries({ queryKey: ["me"] });
      return r.user;
    },
    [qc],
  );

  const logout = useCallback(async () => {
    await api.post("/auth/logout", {});
    qc.setQueryData(["me"], null);
  }, [qc]);

  const value = useMemo<AuthState>(
    () => ({ user: me.data ?? null, loading: me.isLoading, login, logout }),
    [me.data, me.isLoading, login, logout],
  );

  return (
    <AuthContext.Provider value={value}>
      {!online && (
        <div role="status" className="w-full text-center text-sm py-1.5 font-mono2" style={{ background: "var(--warn)", color: "#171d24" }}>
          MODE LURING — sebagian fitur membutuhkan internet
        </div>
      )}
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth harus dipakai di dalam AuthProvider");
  return ctx;
}
