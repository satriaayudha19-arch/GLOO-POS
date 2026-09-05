import { useEffect, useState } from "react";
import { Plus, Store } from "lucide-react";
import { toast } from "sonner";
import api, { apiError } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import PageHeader from "../../components/PageHeader";

export default function OutletsPage() {
  const { session } = useAuth();
  const [items, setItems] = useState([]);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ name: "", address: "", phone: "", email: "" });
  const isOwner = session?.user?.role === "OWNER";

  const load = () => api.get("/outlets").then((r) => setItems(r.data)).catch((e) => toast.error(apiError(e)));
  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    try {
      await api.post("/outlets", form);
      toast.success("Outlet created");
      setShow(false);
      setForm({ name: "", address: "", phone: "", email: "" });
      load();
    } catch (err2) {
      toast.error(apiError(err2));
    }
  };

  return (
    <div data-testid="outlets-page">
      <PageHeader title="Outlets" subtitle="Manage your business locations" testid="outlets-header">
        {isOwner && (
          <button onClick={() => setShow(true)} data-testid="outlet-create-button" className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-bold flex items-center gap-2 hover:opacity-90 active:scale-[0.98]">
            <Plus size={16} /> New Outlet
          </button>
        )}
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((o) => (
          <div key={o.id} className="bg-card border border-border rounded-2xl p-5" data-testid={`outlet-card-${o.code}`}>
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center"><Store size={18} /></div>
              <span className="font-mono text-xs text-muted-foreground">{o.code}</span>
            </div>
            <h3 className="font-heading font-semibold mt-3">{o.name}</h3>
            <p className="text-xs text-muted-foreground mt-1">{o.address || "—"}</p>
            <p className="text-xs text-muted-foreground">{o.phone || ""}</p>
            <span className={`inline-block mt-3 px-2 py-0.5 rounded-md text-[11px] font-bold ${o.active ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
              {o.active ? "ACTIVE" : "INACTIVE"}
            </span>
          </div>
        ))}
      </div>

      {show && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShow(false)}>
          <form onSubmit={create} className="bg-card border border-border w-full max-w-md rounded-2xl p-6 space-y-4" onClick={(e) => e.stopPropagation()} data-testid="outlet-create-modal">
            <h3 className="font-heading text-lg font-bold">New Outlet</h3>
            {[["name", "Outlet name"], ["address", "Address"], ["phone", "Phone"], ["email", "Email"]].map(([k, label]) => (
              <input
                key={k}
                data-testid={`outlet-form-${k}`}
                value={form[k]}
                onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                placeholder={label}
                required={k === "name"}
                type={k === "email" ? "email" : "text"}
                className="w-full h-11 px-3 rounded-lg bg-secondary border border-border text-sm focus:border-primary focus:outline-none"
              />
            ))}
            <button type="submit" data-testid="outlet-form-submit" className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-bold text-sm">Create Outlet</button>
          </form>
        </div>
      )}
    </div>
  );
}
