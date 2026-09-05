import { Printer, X } from "lucide-react";
import { money, fmtDateTime } from "../../lib/format";
import { useAuth } from "../../context/AuthContext";

export function ReceiptBody({ order, brand }) {
  return (
    <div className="receipt-print bg-[#FAF8F5] text-[#111] font-mono text-xs p-6 rounded-lg max-w-sm mx-auto border border-amber-200 space-y-3" data-testid="receipt-view">
      <div className="text-center space-y-0.5">
        <p className="font-bold text-sm">{brand}</p>
        <p className="font-semibold">{order.outlet?.name}</p>
        <p>{order.outlet?.address}</p>
      </div>
      <div className="border-t border-dashed border-gray-300 pt-2 space-y-0.5">
        <p className="break-all">{order.transaction_number}</p>
        <p>{fmtDateTime(order.created_at)}</p>
        <p>Cashier: {order.cashier?.name} ({order.cashier?.code})</p>
      </div>
      <div className="border-t border-dashed border-gray-300 pt-2 space-y-2">
        {order.items.map((it, i) => (
          <div key={i}>
            <div className="flex justify-between gap-2">
              <span>{it.qty}× {it.name}</span>
              <span>{money(it.line_total)}</span>
            </div>
            {(it.variants?.length > 0 || it.modifiers?.length > 0) && (
              <p className="text-[10px] text-gray-500 pl-3">
                {[...(it.variants || []), ...(it.modifiers || []).map((m) => m.name)].join(", ")}
              </p>
            )}
          </div>
        ))}
      </div>
      <div className="border-t border-dashed border-gray-300 pt-2 space-y-0.5">
        <div className="flex justify-between"><span>Subtotal</span><span>{money(order.subtotal)}</span></div>
        {order.discount && (
          <div className="flex justify-between"><span>Discount ({order.discount.label})</span><span>-{money(order.discount.amount)}</span></div>
        )}
        {order.tax && (
          <div className="flex justify-between">
            <span>{order.tax.name} {order.tax.percent}%{order.tax.inclusive ? " (incl)" : ""}</span>
            <span>{money(order.tax.amount)}</span>
          </div>
        )}
        {order.service_charge && (
          <div className="flex justify-between"><span>{order.service_charge.name} {order.service_charge.percent}%</span><span>{money(order.service_charge.amount)}</span></div>
        )}
        <div className="flex justify-between font-bold text-sm border-t border-dashed border-gray-300 pt-1">
          <span>TOTAL</span><span>{money(order.grand_total)}</span>
        </div>
        <div className="flex justify-between"><span>{order.payment?.method_name}</span><span>{money(order.payment?.amount_paid)}</span></div>
        {order.payment?.change > 0 && (
          <div className="flex justify-between"><span>Change</span><span>{money(order.payment.change)}</span></div>
        )}
      </div>
      {order.receipt_footer && (
        <p className="text-center border-t border-dashed border-gray-300 pt-2 text-gray-600">{order.receipt_footer}</p>
      )}
    </div>
  );
}

export default function ReceiptModal({ order, onClose }) {
  const { session } = useAuth();
  if (!order) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} data-testid="receipt-modal">
        <div className="bg-emerald-500/15 border border-emerald-500/30 rounded-xl p-3 text-center">
          <p className="text-emerald-400 font-bold" data-testid="receipt-success-label">Transaction Complete</p>
          <p className="font-mono text-xs text-emerald-300/80 break-all">{order.transaction_number}</p>
        </div>
        <ReceiptBody order={order} brand={session?.tenant?.brand_name || "GLOO POS"} />
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            data-testid="receipt-print-button"
            className="flex-1 h-11 rounded-xl bg-secondary border border-border font-bold text-sm flex items-center justify-center gap-2 hover:bg-accent active:scale-[0.98]"
          >
            <Printer size={16} /> Print Receipt
          </button>
          <button
            onClick={onClose}
            data-testid="receipt-done-button"
            className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98]"
          >
            <X size={16} /> New Sale
          </button>
        </div>
      </div>
    </div>
  );
}
