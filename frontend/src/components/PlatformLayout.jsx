import { NavLink, useNavigate } from "react-router-dom";
import { Building2, CreditCard, LogOut, ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function PlatformLayout({ children }) {
  const { session, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-md border-b border-border px-4 md:px-6 py-3 flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center font-heading font-extrabold text-lg text-primary-foreground">G</div>
          <div>
            <p className="font-heading font-bold leading-tight">GLOO Platform</p>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <ShieldCheck size={11} /> Platform Administration
            </p>
          </div>
        </div>
        <nav className="flex items-center gap-1 ml-6">
          <NavLink
            to="/platform"
            end
            data-testid="platform-nav-tenants"
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${isActive ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`
            }
          >
            <Building2 size={16} /> Tenants
          </NavLink>
          <NavLink
            to="/platform/plans"
            data-testid="platform-nav-plans"
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${isActive ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`
            }
          >
            <CreditCard size={16} /> Plans
          </NavLink>
        </nav>
        <div className="flex-1" />
        <span className="hidden sm:block text-xs text-muted-foreground">{session?.user?.email}</span>
        <button
          data-testid="platform-logout"
          onClick={async () => {
            await logout();
            navigate("/login");
          }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary text-sm text-red-400 hover:bg-accent"
        >
          <LogOut size={14} /> Logout
        </button>
      </header>
      <main className="p-4 md:p-6 max-w-7xl mx-auto">{children}</main>
    </div>
  );
}
