import { useEffect, useState } from "react";
import { toast } from "sonner";
import api, { apiError } from "../../lib/api";
import { usePos } from "../../context/PosContext";
import { useAuth } from "../../context/AuthContext";
import PageHeader from "../../components/PageHeader";

export default function OutletProfilePage() {
  const { outlet } = usePos();
  const { session } = useAuth();
  const [form, setForm] = useState(null);
  const isOwner = session?.user?.role === "OWNER";

  useEffect(() => {
    if (outlet) setForm({ name: outlet.name, address: outlet.address || "", phone: outlet.phone || "", email: outlet.email || "" });
  }, [outlet]);

  if (!outlet || !form) return <p className="text-sm text-muted-foreground">Select an outlet first.</p>;

  const save = async () => {
    try {
      await api.patch(`/outlets/${outlet.id}`, form);
      toast.success("Outlet profile saved");
    } catch (e) { toast.error(apiError(e)); }
  };

  return (
    <div data-testid="outlet-profile-page" className="max-w-xl">
      <PageHeader title="Outlet Profile" subtitle={`${outlet.code} · ${outlet.name}`} testid="outlet-profile-header" />
      <div className="bg-card border border-border rounded-2xl p-6 space-y-3">
        {[["name", "Outlet name"], ["address", "Address"], ["phone", "Phone"], ["email", "Email"]].map(([k, label]) => (
          <div key={k} className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">{label}</label>
            <input
              data-testid={`outlet-profile-${k}`}
              value={form[k]}
              onChange={(e) => setForm({ ...form, [k]: e.target.value })}
              disabled={!isOwner}
              className="w-full h-11 px-3 rounded-lg bg-secondary border border-border text-sm focus:border-primary focus:outline-none disabled:opacity-60"
            />
          </div>
        ))}
        {isOwner && (
          <button onClick={save} data-testid="outlet-profile-save" className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-bold text-sm">Save Profile</button>
        )}
      </div>
    </div>
  );
}
