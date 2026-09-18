import { createContext, useCallback, useContext, useEffect, useState } from "react";
import api from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null); // null=checking, false=logged out, object=session

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setSession(data);
    } catch {
      setSession(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    setSession(data);
    return data;
  }, []);

  const signup = useCallback(async (body) => {
    const { data } = await api.post("/auth/signup", body);
    setSession(data);
    return data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {}
    setSession(false);
  }, []);

  const hasPerm = useCallback(
    (p) => {
      if (!session || !session.user) return false;
      const perms = session.permissions || [];
      return perms.includes("*") || perms.includes(p);
    },
    [session]
  );

  const hasFeature = useCallback(
    (code) => {
      if (!session || !session.features) return false;
      const f = session.features[code];
      return !!f && !!f.enabled;
    },
    [session]
  );

  return (
    <AuthContext.Provider value={{ session, login, signup, logout, refresh, hasPerm, hasFeature }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
