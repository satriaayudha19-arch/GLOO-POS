import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import api, { apiError } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import PageHeader from "../../components/PageHeader";

export default function AccountPage() {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const user = session?.user;

  const changePassword = async () => {
    if (!currentPassword || !newPassword) return;
    try {
      await api.post("/auth/change-password", { current_password: currentPassword, new_password: newPassword });
      toast.success("Password updated");
      setCurrentPassword("");
      setNewPassword("");
    } catch (e) { toast.error(apiError(e)); }
  };

  return (
    <div data-testid="account-page" className="max-w-xl space-y-4">
      <PageHeader title="Account" subtitle="Your profile and session" testid="account-header" />
      <div className="bg-card border border-border rounded-2xl p-6 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-primary/20 text-primary flex items-center justify-center text-lg font-bold">{user?.name?.[0]?.toUpperCase()}</div>
          <div>
            <p className="font-heading font-bold" data-testid="account-name">{user?.name}</p>
            <p className="text-xs text-muted-foreground" data-testid="account-email">{user?.email}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm border-t border-border pt-3">
          <div><p className="text-[11px] text-muted-foreground">Role</p><p className="font-semibold" data-testid="account-role">{user?.role}</p></div>
          <div><p className="text-[11px] text-muted-foreground">User Code</p><p className="font-mono font-semibold" data-testid="account-code">{user?.code}</p></div>
        </div>
      </div>
      <div className="bg-card border border-border rounded-2xl p-6 space-y-3">
        <h3 className="font-heading font-semibold">Change Password</h3>
        <input data-testid="account-current-password-input" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Current password" className="w-full h-11 px-3 rounded-lg bg-secondary border border-border text-sm focus:border-primary focus:outline-none" />
        <input data-testid="account-new-password-input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password" className="w-full h-11 px-3 rounded-lg bg-secondary border border-border text-sm focus:border-primary focus:outline-none" />
        <button onClick={changePassword} data-testid="account-password-save" className="w-full h-11 rounded-xl bg-secondary border border-border font-bold text-sm hover:bg-accent">Update Password</button>
      </div>
      <button
        data-testid="account-logout-button"
        onClick={async () => { await logout(); navigate("/login"); }}
        className="w-full h-11 rounded-xl bg-red-500/15 border border-red-500/40 text-red-400 font-bold text-sm flex items-center justify-center gap-2 hover:bg-red-500/25"
      >
        <LogOut size={15} /> Sign Out
      </button>
    </div>
  );
}
