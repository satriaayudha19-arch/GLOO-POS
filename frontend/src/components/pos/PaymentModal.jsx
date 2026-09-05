import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { money } from "../../lib/format";

const QUICK_CASH = [10000, 20000, 50000, 100000];

export default function PaymentModal({ total, paymentMethods, onClose, onPay, busy }) {
  const cashMethods = paymentMethods.filter((m) => m.type === "CASH");
  const otherMethods = paymentMethods.filter((m) => m.type !== "CASH");
  const [methodId, setMethodId] = useState(cashMethods[0]?.id || paymentMethods[0]?.id || "");
  const [paid, setPaid] = useState("");

  const method = paymentMethods.find((m) => m.id === methodId);
  const isCash = method?.type === "CASH";
  const paidNum = parseInt(paid || "0", 10) || 0;
  const change = useMemo(() => (isCash ? paidNum - total : 0), [isCash, paidNum, total]);
  const canPay = methodId && (!isCash || paidNum >= total);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Enter" && canPay && !busy) onPay({ method_id: methodId, amount_paid: isCash ? paidNum : total });
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canPay, busy, methodId, isCash, paidNum, total, onPay, onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-card border border-border w-full max-w-2xl rounded-2xl p-6 shadow-2xl space-y-6"
        onClick={(e) => e.stopPropagation()}
        data-testid="payment-modal"
      >
        <div className="flex justify-between items-center">
          <h3 className="font-heading text-xl font-bold">Payment</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" data-testid="payment-close"><X size={20} /></button>
        </div>

        <div className="text-center py-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Amount Due</p>
          <p className="font-mono text-4xl font-extrabold text-primary" data-testid="payment-amount-due">{money(total)}</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {paymentMethods.map((m) => (
            <button
              key={m.id}
              data-testid={`payment-method-${m.name.toLowerCase().replace(/\s+/g, "-")}`}
              onClick={() => setMethodId(m.id)}
              className={`h-14 rounded-xl border font-semibold text-sm transition active:scale-95 ${
                methodId === m.id ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border hover:bg-accent"
              }`}
            >
              {m.name}
            </button>
          ))}
        </div>

        {isCash && (
          <div className="space-y-3">
            <div className="flex gap-2 flex-wrap">
              {QUICK_CASH.map((v) => (
                <button
                  key={v}
                  data-testid={`quick-cash-${v / 1000}k`}
                  onClick={() => setPaid(String(v))}
                  className="px-4 py-2 rounded-lg bg-secondary border border-border text-sm font-mono font-bold hover:bg-accent active:scale-95"
                >
                  {money(v)}
                </button>
              ))}
              <button
                data-testid="quick-cash-exact"
                onClick={() => setPaid(String(total))}
                className="px-4 py-2 rounded-lg bg-primary/15 border border-primary/40 text-primary text-sm font-bold hover:bg-primary/25 active:scale-95"
              >
                Exact
              </button>
            </div>
            <input
              data-testid="payment-cash-input"
              type="number"
              inputMode="numeric"
              value={paid}
              onChange={(e) => setPaid(e.target.value)}
              placeholder="Cash received"
              className="w-full h-14 px-4 rounded-xl bg-secondary border border-border focus:border-primary focus:outline-none font-mono text-2xl font-bold text-center"
              autoFocus
            />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Change</span>
              <span className={`font-mono text-lg font-bold ${change >= 0 ? "text-emerald-400" : "text-red-400"}`} data-testid="payment-change">
                {paid === "" ? money(0) : money(Math.max(change, 0))}
              </span>
            </div>
          </div>
        )}

        <button
          disabled={!canPay || busy}
          onClick={() => onPay({ method_id: methodId, amount_paid: isCash ? paidNum : total })}
          data-testid="payment-confirm-button"
          className="w-full h-14 rounded-xl bg-primary text-primary-foreground font-extrabold text-lg hover:opacity-90 active:scale-[0.98] transition disabled:opacity-40"
        >
          {busy ? "Processing…" : `Complete · ${money(total)}`}
        </button>
      </div>
    </div>
  );
}
