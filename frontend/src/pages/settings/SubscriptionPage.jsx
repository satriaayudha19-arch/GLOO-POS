import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Check, X, Infinity as InfinityIcon, Sparkles } from "lucide-react";
import api, { apiError } from "../../lib/api";
import { money, fmtDate } from "../../lib/format";
import PageHeader from "../../components/PageHeader";

const FEATURE_LABELS = {
  POS: "POS", ORDERS: "Orders", REPORTS: "Reports", INVENTORY: "Inventory", KITCHEN: "Kitchen",
  MULTI_OUTLET: "Multi Outlet", DISCOUNTS: "Discounts", ADVANCED_REPORTS: "Advanced Reports",
  AUDIT_LOG: "Audit Log", OFFLINE_POS: "Offline POS", RECEIPT_PRINTING: "Receipt Printing", BARCODE: "Barcode",
};

const STATUS_STYLE = {
  ACTIVE: "bg-emerald-500/15 text-emerald-400",
  TRIALING: "bg-blue-500/15 text-blue-400",
  GRACE_PERIOD: "bg-amber-500/15 text-amber-400",
  PAST_DUE: "bg-amber-500/15 text-amber-400",
  SUSPENDED: "bg-red-500/15 text-red-400",
  CANCELLED: "bg-red-500/15 text-red-400",
  EXPIRED: "bg-red-500/15 text-red-400",
};

function UsageBar({ label, used, limit, testid }) {
  const pct = limit == null ? 0 : Math.min(100, Math.round((used / Math.max(limit, 1)) * 100));
  return (
    <div data-testid={testid}>
      <div className="flex justify-between text-sm mb-1.5">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono font-bold flex items-center gap-1">
          {used} / {limit == null ? <InfinityIcon size={14} className="text-primary" /> : limit}
        </span>
      </div>
      <div className="h-2 rounded-full bg-secondary overflow-hidden">
        <div className={`h-full rounded-full transition-all ${pct >= 90 ? "bg-red-400" : pct >= 70 ? "bg-amber-400" : "bg-primary"}`} style={{ width: limit == null ? "8%" : `${pct}%` }} />
      </div>
    </div>
  );
}

export default function SubscriptionPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [params, setParams] = useSearchParams();
  const pendingActivation = params.get("pending_activation") === "1";
  const requestedPlan = (params.get("requested") || "").toUpperCase();

  useEffect(() => {
    api.get("/subscription").then((r) => setData(r.data)).catch((e) => setError(apiError(e)));
  }, []);

  const dismissBanner = () => {
    const next = new URLSearchParams(params);
    next.delete("pending_activation");
    next.delete("requested");
    setParams(next, { replace: true });
  };

  if (error) return <p className="text-sm text-red-400" data-testid="subscription-error">{error}</p>;
  if (!data) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const { plan, subscription: sub, features, usage } = data;
  const featureEntries = Object.entries(FEATURE_LABELS);

  return (
    <div data-testid="subscription-page">
      <PageHeader title="Subscription" subtitle="Your plan, entitlements and usage — managed by the GLOO platform" testid="subscription-header" />

      {pendingActivation && requestedPlan && requestedPlan !== "FREE" && (
        <div
          data-testid="pending-activation-banner"
          className="mb-4 rounded-2xl border border-primary/40 bg-primary/10 px-5 py-4 flex items-start gap-3"
        >
          <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
            <Sparkles size={18} className="text-primary" />
          </div>
          <div className="flex-1 space-y-1">
            <p className="font-heading font-bold text-sm">
              Kamu memilih paket <span className="text-primary">{requestedPlan}</span>
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Fitur pembayaran online sedang disiapkan. Sementara ini akunmu aktif di paket
              <span className="font-semibold text-foreground"> Free (Trial 14 hari)</span>.
              Silakan hubungi kami di{" "}
              <a href="mailto:hello@gloopos.id" className="underline hover:text-foreground">
                hello@gloopos.id
              </a>{" "}
              atau WhatsApp{" "}
              <a href="https://wa.me/6281234567890" className="underline hover:text-foreground" target="_blank" rel="noreferrer">
                +62 812-3456-7890
              </a>{" "}
              untuk aktivasi manual paket {requestedPlan}.
            </p>
          </div>
          <button
            onClick={dismissBanner}
            data-testid="pending-activation-dismiss"
            className="w-8 h-8 rounded-lg bg-secondary hover:bg-accent flex items-center justify-center shrink-0"
            aria-label="Tutup"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-heading text-2xl font-extrabold text-primary" data-testid="subscription-plan-name">{plan.name}</h3>
            <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${STATUS_STYLE[sub.status] || "bg-secondary text-muted-foreground"}`} data-testid="subscription-status">
              {sub.status}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{plan.description}</p>
          <p className="font-mono text-xl font-bold">{money(plan.price)}<span className="text-xs text-muted-foreground font-sans"> / {plan.billing_interval === "YEARLY" ? "year" : "month"}</span></p>
          <div className="text-sm space-y-1.5 border-t border-border pt-3">
            <div className="flex justify-between"><span className="text-muted-foreground">Period start</span><span data-testid="subscription-period-start">{fmtDate(sub.current_period_start)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Next renewal</span><span data-testid="subscription-period-end">{fmtDate(sub.current_period_end)}</span></div>
            {sub.trial_ends_at && <div className="flex justify-between"><span className="text-muted-foreground">Trial ends</span><span>{fmtDate(sub.trial_ends_at)}</span></div>}
          </div>
          {!data.accessible && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
              Subscription is not currently active. Contact GLOO support. Your data is preserved.
            </p>
          )}
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <h3 className="font-heading font-semibold">Usage & Limits</h3>
          <UsageBar label="Outlets" used={usage.outlets.used} limit={usage.outlets.limit} testid="usage-outlets" />
          <UsageBar label="Users" used={usage.users.used} limit={usage.users.limit} testid="usage-users" />
          <p className="text-[11px] text-muted-foreground">Limits are enforced server-side and concurrency-safe.</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6">
          <h3 className="font-heading font-semibold mb-4">Feature Access</h3>
          <div className="grid grid-cols-2 gap-2">
            {featureEntries.map(([code, label]) => {
              const on = features[code]?.enabled;
              return (
                <div key={code} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold ${on ? "bg-emerald-500/10 text-emerald-400" : "bg-secondary/60 text-muted-foreground"}`} data-testid={`feature-${code.toLowerCase()}`}>
                  {on ? <Check size={13} /> : <X size={13} />} {label}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
