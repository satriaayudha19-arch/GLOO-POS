import { useCallback, useEffect, useState } from "react";
import { Search, Ban, Printer } from "lucide-react";
import { toast } from "sonner";
import api, { apiError } from "../lib/api";
import { money, fmtDateTime } from "../lib/format";
import { usePos } from "../context/PosContext";
import { useAuth } from "../context/AuthContext";
import PageHeader from "../components/PageHeader";
import { ReceiptBody } from "../components/pos/ReceiptModal";

export default function OrdersPage() {
  const { outletId } = usePos();
  const { session, hasPerm } = useAuth();
  const [data, setData] = useState({ items: [], total: 0 });
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState(null);
  const [voidReason, setVoidReason] = useState("");
  const [showVoid, setShowVoid] = useState(false);

  const load = useCallback(() => {
    const params = { limit: 50 };
    if (outletId) params.outlet_id = outletId;
    if (q) params.q = q;
    if (status) params.status = status;
    api.get("/orders", { params }).then((r) => setData(r.data)).catch((e) => toast.error(apiError(e)));
  }, [outletId, q, status]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const doVoid = async () => {
    try {
      const { data: updated } = await api.post(`/orders/${selected.id}/void`, { reason: voidReason });
      setSelected(updated);
      setShowVoid(false);
      toast.success("Order voided");
      load();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  return (
    <div data-testid="orders-page">
      <PageHeader title="Orders" subtitle="All transactions for the selected outlet" testid="orders-header" />
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            data-testid="orders-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search transaction number…"
            className="w-full h-11 pl-9 pr-3 rounded-xl bg-card border border-border focus:border-primary focus:outline-none text-sm"
          />
        </div>
        <select
          data-testid="orders-status-filter"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-11 px-3 rounded-xl bg-card border border-border text-sm focus:border-primary focus:outline-none"
        >
          <option value="">All statuses</option>
          <option value="PAID">PAID</option>
          <option value="VOID">VOID</option>
        </select>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3">Transaction</th>
              <th className="px-4 py-3 hidden md:table-cell">Cashier</th>
              <th className="px-4 py-3 hidden sm:table-cell">Payment</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((o) => (
              <tr
                key={o.id}
                data-testid={`order-row-${o.transaction_number}`}
                onClick={() => setSelected(o)}
                className="border-b border-border/50 hover:bg-secondary/40 cursor-pointer transition-colors"
              >
                <td className="px-4 py-3">
                  <p className="font-mono text-xs text-primary">{o.transaction_number}</p>
                  <p className="text-[11px] text-muted-foreground">{fmtDateTime(o.created_at)}</p>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">{o.cashier?.name}</td>
                <td className="px-4 py-3 hidden sm:table-cell">{o.payment?.method_name}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-md text-[11px] font-bold ${o.status === "PAID" ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                    {o.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-mono font-bold">{money(o.grand_total)}</td>
              </tr>
            ))}
            {data.items.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">No orders found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => { setSelected(null); setShowVoid(false); }}>
          <div className="w-full max-w-md space-y-3 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} data-testid="order-detail-modal">
            <ReceiptBody order={selected} brand={session?.tenant?.brand_name || "GLOO POS"} />
            <div className="flex gap-2">
              <button onClick={() => window.print()} data-testid="order-reprint-button" className="flex-1 h-11 rounded-xl bg-secondary border border-border font-bold text-sm flex items-center justify-center gap-2 hover:bg-accent">
                <Printer size={15} /> Reprint
              </button>
              {hasPerm("orders.void") && selected.status === "PAID" && (
                <button onClick={() => setShowVoid(true)} data-testid="order-void-button" className="flex-1 h-11 rounded-xl bg-red-500/15 border border-red-500/40 text-red-400 font-bold text-sm flex items-center justify-center gap-2 hover:bg-red-500/25">
                  <Ban size={15} /> Void
                </button>
              )}
            </div>
            {showVoid && (
              <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                <p className="text-sm font-semibold">Void this order? The record stays auditable.</p>
                <input
                  data-testid="void-reason-input"
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder="Reason"
                  className="w-full h-10 px-3 rounded-lg bg-secondary border border-border text-sm focus:border-primary focus:outline-none"
                />
                <button onClick={doVoid} data-testid="void-confirm-button" className="w-full h-10 rounded-lg bg-red-500 text-white font-bold text-sm">Confirm Void</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
