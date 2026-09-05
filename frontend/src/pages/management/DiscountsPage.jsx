import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import api, { apiError } from "../../lib/api";
import { money } from "../../lib/format";
import PageHeader from "../../components/PageHeader";

const EMPTY = { name: "", type: "PERCENTAGE", value: 10, min_purchase: 0, max_discount: null, active: true };

export default function DiscountsPage() {
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [isNew, setIsNew] = useState(false);
  const [forbidden, setForbidden] = useState("");

  const load = () =>
    api.get("/discounts").then((r) => setItems(r.data)).catch((e) => {
      if (e?.response?.status === 403) setForbidden(apiError(e));
      else toast.error(apiError(e));
    });
  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...editing, value: parseInt(editing.value, 10) || 0, min_purchase: parseInt(editing.min_purchase, 10) || 0, max_discount: editing.max_discount ? parseInt(editing.max_discount, 10) : null };
      if (isNew) await api.post("/discounts", payload);
      else await api.patch(`/discounts/${editing.id}`, payload);
      toast.success("Discount saved");
      setEditing(null);
      load();
    } catch (err) { toast.error(apiError(err)); }
  };

  if (forbidden) {
    return (
      <div data-testid="discounts-page">
        <PageHeader title="Discounts" testid="discounts-header" />
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-6 text-center max-w-lg" data-testid="discounts-upgrade-notice">
          <p className="font-semibold text-amber-400">{forbidden}</p>
          <p className="text-sm text-muted-foreground mt-1">Upgrade your plan in Settings → Subscription to enable discounts.</p>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="discounts-page">
      <PageHeader title="Discounts" subtitle="Server-calculated order discounts" testid="discounts-header">
        <button onClick={() => { setEditing({ ...EMPTY }); setIsNew(true); }} data-testid="discount-create-button" className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-bold flex items-center gap-2"><Plus size={16} /> New Discount</button>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((d) => (
          <button key={d.id} onClick={() => { setEditing({ ...EMPTY, ...d }); setIsNew(false); }} data-testid={`discount-card-${d.name.toLowerCase().replace(/\s+/g, "-")}`} className="text-left bg-card border border-border rounded-2xl p-5 hover:bg-secondary/40 transition">
            <div className="flex justify-between items-start">
              <h3 className="font-heading font-semibold">{d.name}</h3>
              <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${d.active ? "bg-emerald-500/15 text-emerald-400" : "bg-secondary text-muted-foreground"}`}>{d.active ? "ACTIVE" : "INACTIVE"}</span>
            </div>
            <p className="font-mono text-xl font-bold text-primary mt-2">{d.type === "PERCENTAGE" ? `${d.value}%` : money(d.value)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Min. purchase {money(d.min_purchase || 0)}{d.max_discount ? ` · max ${money(d.max_discount)}` : ""}
            </p>
          </button>
        ))}
        {items.length === 0 && <p className="text-sm text-muted-foreground">No discounts configured.</p>}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <form onSubmit={save} className="bg-card border border-border w-full max-w-md rounded-2xl p-6 space-y-3" onClick={(e) => e.stopPropagation()} data-testid="discount-form-modal">
            <h3 className="font-heading text-lg font-bold">{isNew ? "New Discount" : `Edit ${editing.name}`}</h3>
            <input data-testid="discount-form-name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Discount name" required className="w-full h-11 px-3 rounded-lg bg-secondary border border-border text-sm focus:border-primary focus:outline-none" />
            <div className="grid grid-cols-2 gap-2">
              <select data-testid="discount-form-type" value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value })} className="h-11 px-3 rounded-lg bg-secondary border border-border text-sm focus:border-primary focus:outline-none">
                <option value="PERCENTAGE">Percentage</option>
                <option value="FIXED">Fixed amount</option>
              </select>
              <input data-testid="discount-form-value" type="number" min="0" value={editing.value} onChange={(e) => setEditing({ ...editing, value: e.target.value })} placeholder="Value" required className="h-11 px-3 rounded-lg bg-secondary border border-border text-sm font-mono focus:border-primary focus:outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input data-testid="discount-form-min" type="number" min="0" value={editing.min_purchase} onChange={(e) => setEditing({ ...editing, min_purchase: e.target.value })} placeholder="Min purchase" className="h-11 px-3 rounded-lg bg-secondary border border-border text-sm font-mono focus:border-primary focus:outline-none" />
              <input data-testid="discount-form-max" type="number" min="0" value={editing.max_discount ?? ""} onChange={(e) => setEditing({ ...editing, max_discount: e.target.value })} placeholder="Max discount (optional)" className="h-11 px-3 rounded-lg bg-secondary border border-border text-sm font-mono focus:border-primary focus:outline-none" />
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} data-testid="discount-form-active" /> Active</label>
            <button type="submit" data-testid="discount-form-submit" className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-bold text-sm">Save Discount</button>
          </form>
        </div>
      )}
    </div>
  );
}
