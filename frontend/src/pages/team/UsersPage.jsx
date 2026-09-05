import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import api, { apiError } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import PageHeader from "../../components/PageHeader";

const EMPTY = { name: "", email: "", password: "", role: "CASHIER", outlet_ids: [] };

export default function UsersPage() {
  const { session } = useAuth();
  const [items, setItems] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [editing, setEditing] = useState(null);
  const [isNew, setIsNew] = useState(false);
  const isOwner = session?.user?.role === "OWNER";

  const load = () => {
    api.get("/users").then((r) => setItems(r.data)).catch((e) => toast.error(apiError(e)));
    api.get("/outlets").then((r) => setOutlets(r.data)).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault();
    try {
      if (isNew) await api.post("/users", editing);
      else {
        const payload = { name: editing.name, role: editing.role, outlet_ids: editing.outlet_ids, active: editing.active };
        if (editing.password) payload.password = editing.password;
        await api.patch(`/users/${editing.id}`, payload);
      }
      toast.success("User saved");
      setEditing(null);
      load();
    } catch (err) { toast.error(apiError(err)); }
  };

  return (
    <div data-testid="users-page">
      <PageHeader title="Users & Roles" subtitle="Team access, roles and outlet assignment" testid="users-header">
        {isOwner && (
          <button onClick={() => { setEditing({ ...EMPTY }); setIsNew(true); }} data-testid="user-create-button" className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-bold flex items-center gap-2"><Plus size={16} /> New User</button>
        )}
      </PageHeader>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3 hidden md:table-cell">Outlets</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((u) => (
              <tr key={u.id} data-testid={`user-row-${u.email}`} onClick={() => isOwner && (setEditing({ ...EMPTY, ...u, password: "" }), setIsNew(false))} className={`border-b border-border/50 ${isOwner ? "hover:bg-secondary/40 cursor-pointer" : ""}`}>
                <td className="px-4 py-3">
                  <p className="font-semibold">{u.name} <span className="font-mono text-[10px] text-muted-foreground">{u.code}</span></p>
                  <p className="text-[11px] text-muted-foreground">{u.email}</p>
                </td>
                <td className="px-4 py-3"><span className="px-2 py-1 rounded-md bg-primary/15 text-primary text-[11px] font-bold">{u.role}</span></td>
                <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground">
                  {u.role === "OWNER" || u.role === "MANAGER" ? "All outlets" : (u.outlet_ids || []).map((id) => outlets.find((o) => o.id === id)?.name).filter(Boolean).join(", ") || "—"}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-md text-[11px] font-bold ${u.active ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>{u.active ? "ACTIVE" : "INACTIVE"}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <form onSubmit={save} className="bg-card border border-border w-full max-w-md rounded-2xl p-6 space-y-3 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} data-testid="user-form-modal">
            <h3 className="font-heading text-lg font-bold">{isNew ? "New User" : `Edit ${editing.name}`}</h3>
            <input data-testid="user-form-name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Full name" required className="w-full h-11 px-3 rounded-lg bg-secondary border border-border text-sm focus:border-primary focus:outline-none" />
            {isNew && (
              <input data-testid="user-form-email" type="email" value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} placeholder="Email" required className="w-full h-11 px-3 rounded-lg bg-secondary border border-border text-sm focus:border-primary focus:outline-none" />
            )}
            <input data-testid="user-form-password" type="password" value={editing.password} onChange={(e) => setEditing({ ...editing, password: e.target.value })} placeholder={isNew ? "Password" : "New password (leave blank to keep)"} required={isNew} className="w-full h-11 px-3 rounded-lg bg-secondary border border-border text-sm focus:border-primary focus:outline-none" />
            <select data-testid="user-form-role" value={editing.role} onChange={(e) => setEditing({ ...editing, role: e.target.value })} className="w-full h-11 px-3 rounded-lg bg-secondary border border-border text-sm focus:border-primary focus:outline-none">
              {["OWNER", "MANAGER", "CASHIER", "STAFF", "KITCHEN"].map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            {editing.role !== "OWNER" && editing.role !== "MANAGER" && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1.5">Assigned outlets</p>
                <div className="flex flex-wrap gap-2">
                  {outlets.map((o) => (
                    <button
                      type="button" key={o.id}
                      data-testid={`user-form-outlet-${o.code}`}
                      onClick={() => setEditing((s) => ({ ...s, outlet_ids: s.outlet_ids.includes(o.id) ? s.outlet_ids.filter((x) => x !== o.id) : [...s.outlet_ids, o.id] }))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${editing.outlet_ids.includes(o.id) ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border"}`}
                    >
                      {o.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {!isNew && (
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} data-testid="user-form-active" /> Active</label>
            )}
            <button type="submit" data-testid="user-form-submit" className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-bold text-sm">{isNew ? "Create User" : "Save Changes"}</button>
          </form>
        </div>
      )}
    </div>
  );
}
