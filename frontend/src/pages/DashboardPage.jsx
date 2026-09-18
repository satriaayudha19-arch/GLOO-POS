import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DollarSign, ReceiptText, TrendingUp, Clock, ShoppingBag, AlertTriangle, MailCheck, X } from "lucide-react";
import { toast } from "sonner";
import api, { apiError } from "../lib/api";
import { money, fmtTime } from "../lib/format";
import { usePos } from "../context/PosContext";
import { useAuth } from "../context/AuthContext";
import PageHeader from "../components/PageHeader";

function StatCard({ icon: Icon, label, value, sub, testid }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5" data-testid={testid}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <div className="w-8 h-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
          <Icon size={16} />
        </div>
      </div>
      <p className="mt-2 font-mono text-2xl font-bold tracking-tight">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const { outletId, outlet, shift } = usePos();
  const { hasFeature, hasPerm, session } = useAuth();
  const [data, setData] = useState(null);
  const [lowStock, setLowStock] = useState([]);
  const [emailBannerDismissed, setEmailBannerDismissed] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);

  useEffect(() => {
    const params = outletId ? { outlet_id: outletId } : {};
    api.get("/dashboard", { params }).then((r) => setData(r.data)).catch(() => setData(null));
  }, [outletId]);

  useEffect(() => {
    if (hasFeature("INVENTORY") && hasPerm("catalog.manage")) {
      api.get("/inventory/low-stock").then((r) => setLowStock(r.data)).catch(() => setLowStock([]));
    }
  }, [hasFeature, hasPerm]);

  const showEmailBanner = session && session.user && session.email_verified === false && !emailBannerDismissed;

  const resendVerification = async () => {
    setResendBusy(true);
    try {
      await api.post("/auth/resend-verification");
      toast.success("Link verifikasi baru sudah dikirim ke inbox kamu.");
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setResendBusy(false);
    }
  };

  return (
    <div data-testid="dashboard-page">
      <PageHeader
        title="Dashboard"
        subtitle={outlet ? `${outlet.name} · ${new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })}` : ""}
        testid="dashboard-header"
      />
      {showEmailBanner && (
        <div
          data-testid="verify-email-banner"
          className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-5 py-4"
        >
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
            <MailCheck size={18} className="text-amber-400" />
          </div>
          <div className="flex-1 space-y-1">
            <p className="font-heading font-bold text-sm text-amber-100">
              Verifikasi email kamu
            </p>
            <p className="text-xs text-amber-200/80 leading-relaxed">
              Kami sudah mengirim link verifikasi ke{" "}
              <span className="font-semibold text-amber-100">{session.user.email}</span>.
              Kamu tetap bisa pakai aplikasi seperti biasa, tapi verifikasi diperlukan sebelum
              nanti bisa mengubah email pemulihan dan menerima notifikasi tagihan.
            </p>
            <button
              onClick={resendVerification}
              disabled={resendBusy}
              data-testid="verify-email-resend"
              className="mt-2 h-8 px-3 rounded-lg bg-amber-500 text-amber-950 text-xs font-bold hover:bg-amber-400 disabled:opacity-60"
            >
              {resendBusy ? "Mengirim…" : "Kirim ulang link verifikasi"}
            </button>
          </div>
          <button
            onClick={() => setEmailBannerDismissed(true)}
            data-testid="verify-email-dismiss"
            className="w-8 h-8 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 flex items-center justify-center shrink-0"
            aria-label="Tutup"
          >
            <X size={16} className="text-amber-300" />
          </button>
        </div>
      )}
      {lowStock.length > 0 && (
        <div data-testid="low-stock-alert" className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 mb-4">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-2 text-amber-400 font-heading font-semibold">
              <AlertTriangle size={18} /> Stok Menipis ({lowStock.length})
            </div>
            <Link to="/management/ingredients" className="text-xs text-primary font-semibold hover:underline" data-testid="low-stock-manage">Kelola stok</Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {lowStock.map((i) => (
              <span key={i.id} data-testid={`low-stock-item-${i.id}`} className="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-300 text-xs font-semibold">
                {i.name}: <span className="font-mono">{i.stock_qty}</span> {i.unit}
              </span>
            ))}
          </div>
        </div>
      )}
      {!data ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={DollarSign} label="Today's Sales" value={money(data.today.sales)} testid="stat-today-sales" />
            <StatCard icon={ReceiptText} label="Today's Orders" value={data.today.orders} testid="stat-today-orders" />
            <StatCard icon={TrendingUp} label="Avg Transaction" value={money(data.today.avg_transaction)} testid="stat-avg-transaction" />
            <StatCard
              icon={Clock}
              label="Current Shift"
              value={shift ? "OPEN" : "—"}
              sub={shift ? `${shift.cashier_name} · opened ${fmtTime(shift.opened_at)}` : "No active shift at this outlet"}
              testid="stat-current-shift"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
            <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-heading font-semibold">Recent Orders</h3>
                <Link to="/orders" className="text-xs text-primary font-semibold hover:underline" data-testid="view-all-orders">View all</Link>
              </div>
              {data.recent_orders.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No orders yet today. Open POS to start selling.</p>
              ) : (
                <div className="divide-y divide-border/60">
                  {data.recent_orders.map((o) => (
                    <div key={o.id} className="py-2.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-mono text-xs text-primary truncate">{o.transaction_number}</p>
                        <p className="text-xs text-muted-foreground">{o.cashier?.name} · {fmtTime(o.created_at)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-mono text-sm font-bold">{money(o.grand_total)}</p>
                        <p className="text-[11px] text-muted-foreground">{o.payment?.method_name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="bg-card border border-border rounded-2xl p-5">
                <h3 className="font-heading font-semibold mb-3">Payments Today</h3>
                {data.payment_summary.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No payments yet.</p>
                ) : (
                  <div className="space-y-2">
                    {data.payment_summary.map((p) => (
                      <div key={p.method} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{p.method} <span className="text-xs">({p.count})</span></span>
                        <span className="font-mono font-semibold">{money(p.total)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="bg-card border border-border rounded-2xl p-5">
                <h3 className="font-heading font-semibold mb-3">Top Products</h3>
                {data.top_products.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No sales yet.</p>
                ) : (
                  <div className="space-y-2">
                    {data.top_products.map((p, i) => (
                      <div key={p.name} className="flex items-center gap-2.5 text-sm">
                        <span className="w-6 h-6 rounded-md bg-secondary flex items-center justify-center text-[11px] font-bold text-primary">{i + 1}</span>
                        <span className="flex-1 truncate">{p.name}</span>
                        <span className="text-xs text-muted-foreground">{p.qty} sold</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <Link
                to="/pos"
                data-testid="go-to-pos"
                className="flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-primary text-primary-foreground font-bold hover:opacity-90 active:scale-[0.98] transition"
              >
                <ShoppingBag size={18} /> Open POS
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
