import { useEffect, useState } from "react";
import { Plus, Building2 } from "lucide-react";
import { toast } from "sonner";
import api, { apiError } from "../../lib/api";
import { fmtDate } from "../../lib/format";
import PageHeader from "../../components/PageHeader";

const STATUSES = ["TRIALING", "ACTIVE", "PAST_DUE", "GRACE_PERIOD", "SUSPENDED", "CANCELLED", "EXPIRED"];
const STATUS_STYLE = {
  ACTIVE: "bg-emerald-500/15 text-emerald-400", TRIALING: "bg-blue-500/15 text-blue-400",
  GRACE_PERIOD: "bg-amber-500/15 text-amber-400", PAST_DUE: "bg-amber-500/15 text-amber-400",
  SUSPENDED: "bg-red-500/15 text-red-400", CANCELLED: "bg-red-500/15 text-red-400", EXPIRED: "bg-red-500/15 text-red-400",
};

export default function PlatformTenantsPage() {
  const [items, setItems] = useState([]);
  const [plans, setPlans] = useState([]);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ name: "", brand_name: "", owner_name: "", owner_email: "", owner_password: "", plan_code: "FREE", trial_days: 14 });
  const [subEdit, setSubEdit] = useState(null); // {tenant}
  const [subForm, setSubForm] = useState({ plan_code: "", status: "", reason: "" });
  const [history, setHistory] = useState(null);

  const load = () => {
    api.get("/platform/tenants").then((r) => setItems(r.data)).catch((e) => toast.error(apiError(e)));
    api.get("/platform/plans").then((r) => setPlans(r.data)).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    try {
      await api.post("/platform/tenants", { ...form, trial_days: parseInt(form.trial_days, 10) || 0 });
      toast.success("Tenant created");
      setShow(false);
      load();
    } catch (err) { toast.error(apiError(err)); }
  };

  const changeSub = async () => {
    try {
      await api.patch(`/platform/tenants/${subEdit.id}/subscription`, {
        plan_code: subForm.plan_code || undefined,
        status: subForm.status || undefined,
        reason: subForm.reason,
      });
      toast.success("Subscription updated");
      setSubEdit(null);
      load();
    } catch (e) { toast.error(apiError(e)); }
  };

  const openHistory = async (t) => {
    const { data } = await api.get("/platform/subscription-history", { params: { tenant_id: t.id } });
    setHistory({ tenant: t, items: data });
  };

  return (
    <div data-testid="platform-tenants-page">
      <PageHeader title="Tenants" subtitle="Businesses on the GLOO platform" testid="platform-tenants-header">
        <button onClick={() => setShow(true)} data-testid="tenant-create-button" className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-bold flex items-center gap-2"><Plus size={16} /> New Tenant</button>
      </PageHeader>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3">Tenant</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 hidden md:table-cell">Usage</th>
              <th className="px-4 py-3 hidden md:table-cell">Renews</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((t) => (
              <tr key={t.id} data-testid={`tenant-row-${t.code}`} className="border-b border-border/50 hover:bg-secondary/30">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center"><Building2 size={15} /></div>
                    <div>
                      <p className="font-semibold">{t.name}</p>
                      <p className="text-[11px] text-muted-foreground font-mono">{t.code}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3"><span className="px-2 py-1 rounded-md bg-primary/15 text-primary text-[11px] font-bold">{t.subscription?.plan_code}</span></td>
                <td className="px-4 py-3"><span className={`px-2 py-1 rounded-md text-[11px] font-bold ${STATUS_STYLE[t.subscription?.status] || "bg-secondary"}`}>{t.subscription?.status}</span></td>
                <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground">{t.outlets_count} outlets · {t.users_count} users</td>
                <td className="px-4 py-3 hidden md:table-cell text-xs">{fmtDate(t.subscription?.current_period_end)}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => { setSubEdit(t); setSubForm({ plan_code: t.subscription?.plan_code, status: t.subscription?.status, reason: "" }); }} data-testid={`tenant-sub-edit-${t.code}`} className="text-xs text-primary font-bold hover:underline mr-3">Subscription</button>
                  <button onClick={() => openHistory(t)} data-testid={`tenant-history-${t.code}`} className="text-xs text-muted-foreground font-bold hover:underline">History</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {show && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShow(false)}>
          <form onSubmit={create} className="bg-card border border-border w-full max-w-md rounded-2xl p-6 space-y-3 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} data-testid="tenant-create-modal">
            <h3 className="font-heading text-lg font-bold">New Tenant</h3>
            <input data-testid="tenant-form-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Business name" required className="w-full h-11 px-3 rounded-lg bg-secondary border border-border text-sm focus:border-primary focus:outline-none" />
            <input data-testid="tenant-form-brand" value={form.brand_name} onChange={(e) => setForm({ ...form, brand_name: e.target.value })} placeholder="Brand name (shown in POS)" className="w-full h-11 px-3 rounded-lg bg-secondary border border-border text-sm focus:border-primary focus:outline-none" />
            <input data-testid="tenant-form-owner-name" value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} placeholder="Owner name" required className="w-full h-11 px-3 rounded-lg bg-secondary border border-border text-sm focus:border-primary focus:outline-none" />
            <input data-testid="tenant-form-owner-email" type="email" value={form.owner_email} onChange={(e) => setForm({ ...form, owner_email: e.target.value })} placeholder="Owner email" required className="w-full h-11 px-3 rounded-lg bg-secondary border border-border text-sm focus:border-primary focus:outline-none" />
            <input data-testid="tenant-form-owner-password" value={form.owner_password} onChange={(e) => setForm({ ...form, owner_password: e.target.value })} placeholder="Owner password" required className="w-full h-11 px-3 rounded-lg bg-secondary border border-border text-sm focus:border-primary focus:outline-none" />
            <div className="grid grid-cols-2 gap-2">
              <select data-testid="tenant-form-plan" value={form.plan_code} onChange={(e) => setForm({ ...form, plan_code: e.target.value })} className="h-11 px-3 rounded-lg bg-secondary border border-border text-sm focus:border-primary focus:outline-none">
                {plans.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
              </select>
              <input data-testid="tenant-form-trial" type="number" min="0" value={form.trial_days} onChange={(e) => setForm({ ...form, trial_days: e.target.value })} placeholder="Trial days" className="h-11 px-3 rounded-lg bg-secondary border border-border text-sm focus:border-primary focus:outline-none" />
            </div>
            <button type="submit" data-testid="tenant-form-submit" className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-bold text-sm">Create Tenant</button>
          </form>
        </div>
      )}

      {subEdit && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSubEdit(null)}>
          <div role="dialog" aria-modal="true" aria-label={`Subscription for ${subEdit.name}`} className="bg-card border border-border w-full max-w-md rounded-2xl p-6 space-y-3" onClick={(e) => e.stopPropagation()} data-testid="subscription-edit-modal">
            <h3 className="font-heading text-lg font-bold">Subscription · {subEdit.name}</h3>
            <select data-testid="sub-edit-plan" value={subForm.plan_code} onChange={(e) => setSubForm({ ...subForm, plan_code: e.target.value })} className="w-full h-11 px-3 rounded-lg bg-secondary border border-border text-sm focus:border-primary focus:outline-none">
              {plans.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
            </select>
            <select data-testid="sub-edit-status" value={subForm.status} onChange={(e) => setSubForm({ ...subForm, status: e.target.value })} className="w-full h-11 px-3 rounded-lg bg-secondary border border-border text-sm focus:border-primary focus:outline-none">
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <input data-testid="sub-edit-reason" value={subForm.reason} onChange={(e) => setSubForm({ ...subForm, reason: e.target.value })} placeholder="Reason (recorded in history)" className="w-full h-11 px-3 rounded-lg bg-secondary border border-border text-sm focus:border-primary focus:outline-none" />
            <button onClick={changeSub} data-testid="sub-edit-submit" className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-bold text-sm">Apply Change</button>
          </div>
        </div>
      )}

      {history && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setHistory(null)}>
          <div className="bg-card border border-border w-full max-w-lg rounded-2xl p-6 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} data-testid="subscription-history-modal">
            <h3 className="font-heading text-lg font-bold mb-3">History · {history.tenant.name}</h3>
            <div className="space-y-2">
              {history.items.map((h) => (
                <div key={h.id} className="bg-secondary/40 rounded-xl p-3 text-xs">
                  <p className="font-semibold">{h.old_plan_code || "—"} → {h.new_plan_code} · {h.old_status || "—"} → {h.new_status}</p>
                  <p className="text-muted-foreground mt-0.5">{h.reason || "No reason"} · by {h.changed_by} · {h.source}</p>
                  <p className="text-muted-foreground/70 mt-0.5">{fmtDate(h.created_at)}</p>
                </div>
              ))}
              {history.items.length === 0 && <p className="text-sm text-muted-foreground">No history.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
