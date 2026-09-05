import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import api, { apiError } from "../../lib/api";
import PageHeader from "../../components/PageHeader";

const TYPES = ["CASH", "QRIS", "BANK_TRANSFER", "DEBIT", "CREDIT_CARD", "EWALLET", "OTHER"];

export default function PaymentMethodsPage() {
  const [items, setItems] = useState([]);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ name: "", type: "CASH" });

  const load = () => api.get("/payment-methods").then((r) => setItems(r.data)).catch((e) => toast.error(apiError(e)));
  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    try {
      await api.post("/payment-methods", { ...form, sort_order: items.length + 1 });
      toast.success("Payment method added");
      setShow(false);
      setForm({ name: "", type: "CASH" });
      load();
    } catch (err) { toast.error(apiError(err)); }
  };

  const toggle = async (m) => {
    await api.patch(`/payment-methods/${m.id}`, { active: !m.active }).then(load).catch((e) => toast.error(apiError(e)));
  };

  return (
    <div data-testid="payment-methods-page">
      <PageHeader title="Payment Methods" subtitle="Accepted tenders at the counter" testid="payment-methods-header">
        <button onClick={() => setShow(true)} data-testid="payment-method-create-button" className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-bold flex items-center gap-2"><Plus size={16} /> New Method</button>
      </PageHeader>
      <div className="bg-card border border-border rounded-2xl overflow-hidden max-w-2xl">
        {items.map((m) => (
          <div key={m.id} data-testid={`payment-method-row-${m.name.toLowerCase().replace(/\s+/g, "-")}`} className="flex items-center justify-between px-4 py-3 border-b border-border/50 last:border-0">
            <div>
              <p className="text-sm font-semibold">{m.name}</p>
              <p className="text-[11px] text-muted-foreground font-mono">{m.type}</p>
            </div>
            <button onClick={() => toggle(m)} data-testid={`payment-method-toggle-${m.name.toLowerCase().replace(/\s+/g, "-")}`} className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${m.active ? "bg-emerald-500/15 text-emerald-400" : "bg-secondary text-muted-foreground"}`}>
              {m.active ? "ACTIVE" : "INACTIVE"}
            </button>
          </div>
        ))}
      </div>

      {show && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShow(false)}>
          <form onSubmit={create} className="bg-card border border-border w-full max-w-sm rounded-2xl p-6 space-y-3" onClick={(e) => e.stopPropagation()} data-testid="payment-method-form-modal">
            <h3 className="font-heading text-lg font-bold">New Payment Method</h3>
            <input data-testid="payment-method-form-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name (e.g. GoPay)" required className="w-full h-11 px-3 rounded-lg bg-secondary border border-border text-sm focus:border-primary focus:outline-none" />
            <select data-testid="payment-method-form-type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full h-11 px-3 rounded-lg bg-secondary border border-border text-sm focus:border-primary focus:outline-none">
              {TYPES.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
            </select>
            <button type="submit" data-testid="payment-method-form-submit" className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-bold text-sm">Add Method</button>
          </form>
        </div>
      )}
    </div>
  );
}
