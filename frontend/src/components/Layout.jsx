import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, ShoppingBag, ReceiptText, Store, Tags, Coffee, Layers,
  BadgePercent, CreditCard, Percent, Clock, Users, Settings, LogOut,
  Wallet, Wifi, WifiOff, ChevronDown, Download, BarChart3, Package, ChefHat,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { usePos } from "../context/PosContext";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "./ui/dropdown-menu";

const NAV = [
  { type: "item", to: "/", label: "Dashboard", icon: LayoutDashboard, perm: "dashboard.view" },
  { type: "item", to: "/pos", label: "POS", icon: ShoppingBag, perm: "pos.use", feature: "POS" },
  { type: "item", to: "/orders", label: "Orders", icon: ReceiptText, perm: "orders.view", feature: "ORDERS" },
  { type: "item", to: "/reports", label: "Reports", icon: BarChart3, perm: "reports.view", feature: "REPORTS" },
  {
    type: "group", label: "Management", items: [
      { to: "/management/outlets", label: "Outlets", icon: Store, perm: "outlets.view" },
      { to: "/management/categories", label: "Categories", icon: Tags, perm: "catalog.manage" },
      { to: "/management/products", label: "Products", icon: Coffee, perm: "catalog.manage" },
      { to: "/management/variants", label: "Variants & Modifiers", icon: Layers, perm: "catalog.manage" },
      { to: "/management/prices", label: "Prices", icon: Wallet, perm: "catalog.manage" },
      { to: "/management/discounts", label: "Discounts", icon: BadgePercent, perm: "discounts.manage", feature: "DISCOUNTS" },
      { to: "/management/ingredients", label: "Ingredients", icon: Package, perm: "catalog.manage", feature: "INVENTORY" },
      { to: "/management/recipes", label: "Recipes", icon: ChefHat, perm: "catalog.manage", feature: "INVENTORY" },
    ],
  },
  {
    type: "group", label: "Operations", items: [
      { to: "/operations/payment-methods", label: "Payment Methods", icon: CreditCard, perm: "payments.manage" },
      { to: "/operations/tax-service", label: "Tax & Service", icon: Percent, perm: "tax.manage" },
      { to: "/operations/shifts", label: "Cashier Shift", icon: Clock, perm: "shifts.use" },
    ],
  },
  {
    type: "group", label: "Team", items: [
      { to: "/team/users", label: "Users & Roles", icon: Users, perm: "users.view" },
    ],
  },
  {
    type: "group", label: "Settings", items: [
      { to: "/settings/outlet-profile", label: "Outlet Profile", icon: Store },
      { to: "/settings/hardware", label: "Hardware", icon: Download },
      { to: "/settings/receipt", label: "Receipt", icon: ReceiptText },
      { to: "/settings/subscription", label: "Subscription", icon: CreditCard, perm: "subscription.view" },
      { to: "/settings/account", label: "Account", icon: Users },
    ],
  },
];

function NavItem({ to, label, icon: Icon, onNavigate }) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      onClick={onNavigate}
      data-testid={`nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
          isActive ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
        }`
      }
    >
      <Icon size={18} /> {label}
    </NavLink>
  );
}

function NavEntry({ entry, onNavigate }) {
  const { hasPerm, hasFeature } = useAuth();
  if (entry.type === "item") {
    if ((entry.perm && !hasPerm(entry.perm)) || (entry.feature && !hasFeature(entry.feature))) return null;
    return <NavItem to={entry.to} label={entry.label} icon={entry.icon} onNavigate={onNavigate} />;
  }
  const visible = entry.items.filter((i) => (!i.perm || hasPerm(i.perm)) && (!i.feature || hasFeature(i.feature)));
  if (!visible.length) return null;
  return (
    <div className="pt-3">
      <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">{entry.label}</p>
      <div className="space-y-0.5">
        {visible.map((i) => (
          <NavItem key={i.to} to={i.to} label={i.label} icon={i.icon} onNavigate={onNavigate} />
        ))}
      </div>
    </div>
  );
}

export default function Layout({ children }) {
  const { session, logout } = useAuth();
  const { outlets, outlet, outletId, setOutletId, shift, online } = usePos();
  const navigate = useNavigate();
  const [mobileNav, setMobileNav] = useState(false);
  const [installEvt, setInstallEvt] = useState(null);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setInstallEvt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const doLogout = async () => {
    await logout();
    navigate("/login");
  };

  const sidebar = (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2.5 px-4 h-16 border-b border-border shrink-0">
        <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center font-heading font-extrabold text-lg text-primary-foreground">G</div>
        <div className="min-w-0">
          <p className="font-heading font-bold leading-tight truncate">{session?.tenant?.brand_name || "GLOO POS"}</p>
          <p className="text-[11px] text-muted-foreground truncate">{session?.tenant?.name}</p>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {NAV.map((e) => (
          <NavEntry key={e.label || e.to} entry={e} onNavigate={() => setMobileNav(false)} />
        ))}
      </nav>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-60 bg-card border-r border-border z-30 flex-col">{sidebar}</aside>
      {/* Mobile sidebar */}
      {mobileNav && (
        <div className="lg:hidden fixed inset-0 z-50" onClick={() => setMobileNav(false)}>
          <div className="absolute inset-0 bg-black/70" />
          <aside className="absolute inset-y-0 left-0 w-64 bg-card border-r border-border" onClick={(e) => e.stopPropagation()}>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="lg:pl-60">
        <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-md border-b border-border px-4 py-2.5 flex items-center gap-3">
          <button
            className="lg:hidden w-10 h-10 rounded-lg bg-secondary flex items-center justify-center"
            onClick={() => setMobileNav(true)}
            data-testid="mobile-nav-toggle"
            aria-label="Open navigation"
          >
            <ChevronDown size={18} className="-rotate-90" />
          </button>

          {outlets.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  data-testid="outlet-switcher"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary text-sm font-medium hover:bg-accent transition-colors"
                >
                  <Store size={14} className="text-primary" />
                  <span className="max-w-[140px] truncate">{outlet?.name || "Select outlet"}</span>
                  <ChevronDown size={14} className="text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-card border-border">
                <DropdownMenuLabel>Outlets</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {outlets.map((o) => (
                  <DropdownMenuItem key={o.id} onClick={() => setOutletId(o.id)} data-testid={`outlet-option-${o.code}`}>
                    <span className={o.id === outletId ? "text-primary font-semibold" : ""}>{o.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{o.code}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <div
            data-testid="online-status-badge"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold ${
              online ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
            }`}
          >
            {online ? <Wifi size={13} /> : <WifiOff size={13} />}
            {online ? "ONLINE" : "OFFLINE"}
          </div>

          <div
            data-testid="shift-status-badge"
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold ${
              shift ? "bg-blue-500/15 text-blue-400" : "bg-secondary text-muted-foreground"
            }`}
          >
            <Clock size={13} />
            {shift ? `Shift open · ${shift.cashier_name}` : "No open shift"}
          </div>

          <div className="flex-1" />

          {installEvt && (
            <button
              data-testid="pwa-install-button"
              onClick={async () => {
                installEvt.prompt();
                setInstallEvt(null);
              }}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-bold hover:opacity-90"
            >
              <Download size={13} /> Install App
            </button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button data-testid="user-menu" className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full hover:bg-secondary transition-colors">
                <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm font-bold">
                  {session?.user?.name?.[0]?.toUpperCase()}
                </div>
                <div className="hidden md:block text-left">
                  <p className="text-xs font-semibold leading-tight">{session?.user?.name}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">{session?.user?.role}</p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-card border-border w-48" align="end">
              <DropdownMenuLabel>{session?.user?.email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/settings/account")} data-testid="menu-account">
                <Settings size={14} className="mr-2" /> Account
              </DropdownMenuItem>
              <DropdownMenuItem onClick={doLogout} data-testid="menu-logout" className="text-red-400">
                <LogOut size={14} className="mr-2" /> Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="p-4 md:p-6">{children || <Outlet />}</main>
      </div>
    </div>
  );
}
