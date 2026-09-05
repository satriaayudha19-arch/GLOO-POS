import { createContext, useCallback, useContext, useEffect, useState } from "react";
import api from "../lib/api";
import { useAuth } from "./AuthContext";

const PosContext = createContext(null);

export function PosProvider({ children }) {
  const { session } = useAuth();
  const [outletId, setOutletIdState] = useState(() => localStorage.getItem("gloo.outlet") || "");
  const [shift, setShift] = useState(null);
  const [online, setOnline] = useState(navigator.onLine);

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

  const outlets = session?.outlets || [];

  useEffect(() => {
    if (outlets.length && !outlets.find((o) => o.id === outletId)) {
      setOutletIdState(outlets[0].id);
      localStorage.setItem("gloo.outlet", outlets[0].id);
    }
  }, [outlets, outletId]);

  const setOutletId = useCallback((id) => {
    setOutletIdState(id);
    localStorage.setItem("gloo.outlet", id);
  }, []);

  const outlet = outlets.find((o) => o.id === outletId) || null;

  const refreshShift = useCallback(async () => {
    if (!outletId) {
      setShift(null);
      return;
    }
    try {
      const { data } = await api.get("/shifts/current", { params: { outlet_id: outletId } });
      setShift(data && data.id ? data : null);
    } catch {
      setShift(null);
    }
  }, [outletId]);

  useEffect(() => {
    refreshShift();
  }, [refreshShift]);

  return (
    <PosContext.Provider value={{ outlets, outlet, outletId, setOutletId, shift, refreshShift, online }}>
      {children}
    </PosContext.Provider>
  );
}

export function usePos() {
  return useContext(PosContext);
}
