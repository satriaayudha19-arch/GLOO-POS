import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DollarSign, ReceiptText, TrendingUp, Clock, ShoppingBag } from "lucide-react";
import api from "../lib/api";
import { money, fmtTime } from "../lib/format";
import { usePos } from "../context/PosContext";
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
  const [data, setData] = useState(null);

  useEffect(() => {
    const params = outletId ? { outlet_id: outletId } : {};
    api.get("/dashboard", { params }).then((r) => setData(r.data)).catch(() => setData(null));
  }, [outletId]);

  return (
    <div data-testid="dashboard-page">
      <PageHeader
        title="Dashboard"
        subtitle={outlet ? `${outlet.name} · ${new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })}` : ""}
        testid="dashboard-header"
      />
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
