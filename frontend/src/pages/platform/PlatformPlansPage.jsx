import { useEffect, useState } from "react";
import { toast } from "sonner";
import api, { apiError } from "../../lib/api";
import { money } from "../../lib/format";
import PageHeader from "../../components/PageHeader";

const FEATURE_CODES = ["POS", "ORDERS", "REPORTS", "INVENTORY", "KITCHEN", "MULTI_OUTLET", "DISCOUNTS", "ADVANCED_REPORTS", "AUDIT_LOG", "OFFLINE_POS", "RECEIPT_PRINTING", "BARCODE"];

export default function PlatformPlansPage() {
  const [plans, setPlans] = useState([]);
  const [editing, setEditing] = useState(null);

  const load = () => api.get("/platform/plans").then((r) => setPlans(r.data)).catch((e) => toast.error(apiError(e)));
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      await api.patch(`/platform/plans/${editing.code}`, {
        price: parseInt(editing.price, 10) || 0,
        active: editing.active,
        features: editing.features,
      });
      toast.success(`Plan ${editing.code} updated`);
      setEditing(null);
      load();
    } catch (e) { toast.error(apiError(e)); }
  };

  const setFeature = (code, enabled) =>
    setEditing((s) => ({ ...s, features: { ...s.features, [code]: { ...s.features[code], enabled } } }));
  const setLimit = (code, val) =>
    setEditing((s) => ({ ...s, features: { ...s.features, [code]: { enabled: true, limit: val === "" ? null : parseInt(val, 10) } } }));

  return (
    <div data-testid="platform-plans-page">
      <PageHeader title="Subscription Plans" subtitle="Feature entitlements & resource limits per plan" testid="platform-plans-header" />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {plans.map((p) => (
          <button key={p.code} onClick={() => setEditing(JSON.parse(JSON.stringify(p)))} data-testid={`plan-card-${p.code.toLowerCase()}`} className="text-left bg-card border border-border rounded-2xl p-5 hover:bg-secondary/40 transition">
            <div className="flex justify-between items-start">
              <h3 className="font-heading text-xl font-extrabold text-primary">{p.name}</h3>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${p.active ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>{p.active ? "ACTIVE" : "INACTIVE"}</span>
            </div>
            <p className="font-mono font-bold mt-1">{money(p.price)}<span className="text-xs text-muted-foreground font-sans">/{p.billing_interval === "YEARLY" ? "yr" : "mo"}</span></p>
            <p className="text-xs text-muted-foreground mt-2">
              {p.features?.OUTLET_LIMIT?.limit == null ? "∞" : p.features?.OUTLET_LIMIT?.limit} outlets · {p.features?.USER_LIMIT?.limit == null ? "∞" : p.features?.USER_LIMIT?.limit} users
            </p>
            <div className="flex flex-wrap gap-1 mt-3">
              {FEATURE_CODES.filter((c) => p.features?.[c]?.enabled).map((c) => (
                <span key={c} className="px-1.5 py-0.5 rounded bg-secondary text-[9px] font-bold text-muted-foreground">{c}</span>
              ))}
            </div>
            <span className="inline-flex items-center gap-1 mt-3 text-[11px] font-bold text-primary" data-testid={`plan-edit-hint-${p.code.toLowerCase()}`}>Edit plan →</span>
          </button>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-card border border-border w-full max-w-lg rounded-2xl p-6 space-y-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} data-testid="plan-edit-modal">
            <h3 className="font-heading text-lg font-bold">Edit Plan · {editing.code}</h3>
            <div className="grid grid-cols-2 gap-2">
              <input data-testid="plan-edit-price" type="number" min="0" value={editing.price} onChange={(e) => setEditing({ ...editing, price: e.target.value })} className="h-11 px-3 rounded-lg bg-secondary border border-border text-sm font-mono focus:border-primary focus:outline-none" />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} data-testid="plan-edit-active" /> Active</label>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">Features</p>
              <div className="grid grid-cols-2 gap-1.5">
                {FEATURE_CODES.map((c) => (
                  <label key={c} className="flex items-center gap-2 text-xs bg-secondary/40 rounded-lg px-2.5 py-2">
                    <input type="checkbox" checked={!!editing.features?.[c]?.enabled} onChange={(e) => setFeature(c, e.target.checked)} data-testid={`plan-feature-${c.toLowerCase()}`} /> {c}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Outlet limit (empty = unlimited)</p>
                <input data-testid="plan-edit-outlet-limit" type="number" min="0" value={editing.features?.OUTLET_LIMIT?.limit ?? ""} onChange={(e) => setLimit("OUTLET_LIMIT", e.target.value)} className="w-full h-11 px-3 rounded-lg bg-secondary border border-border text-sm font-mono focus:border-primary focus:outline-none" />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">User limit (empty = unlimited)</p>
                <input data-testid="plan-edit-user-limit" type="number" min="0" value={editing.features?.USER_LIMIT?.limit ?? ""} onChange={(e) => setLimit("USER_LIMIT", e.target.value)} className="w-full h-11 px-3 rounded-lg bg-secondary border border-border text-sm font-mono focus:border-primary focus:outline-none" />
              </div>
            </div>
            <button onClick={save} data-testid="plan-edit-submit" className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-bold text-sm">Save Plan</button>
          </div>
        </div>
      )}
    </div>
  );
}
