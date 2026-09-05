import { Minus, Plus, Trash2 } from "lucide-react";
import { money } from "../../lib/format";

export default function CartPane({ cart, onQty, onRemove, discount, onClearDiscount, totals, onCheckout, onClear, busy }) {
  return (
    <div className="bg-card border border-border rounded-2xl flex flex-col h-[calc(100vh-140px)] sticky top-20 overflow-hidden" data-testid="pos-cart">
      <div className="p-4 border-b border-border bg-secondary/50 flex justify-between items-center">
        <h3 className="font-heading font-semibold">Current Order</h3>
        <button onClick={onClear} data-testid="cart-clear-button" className="text-xs text-red-400 hover:underline font-semibold">
          Clear
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {cart.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-10">Tap products to add them here.</p>
        )}
        {cart.map((line) => (
          <div key={line.key} data-testid={`cart-item-${line.product_id}`} className="bg-secondary/40 rounded-xl p-3 space-y-2">
            <div className="flex justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{line.name}</p>
                {(line.variants.length > 0 || line.modifiers.length > 0) && (
                  <p className="text-[11px] text-muted-foreground truncate">
                    {[...line.variants, ...line.modifiers.map((m) => m.name)].join(" · ")}
                  </p>
                )}
              </div>
              <button onClick={() => onRemove(line.key)} data-testid={`cart-remove-${line.product_id}`} className="text-muted-foreground hover:text-red-400">
                <Trash2 size={15} />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <button onClick={() => onQty(line.key, -1)} data-testid={`cart-qty-minus-${line.product_id}`} className="w-8 h-8 rounded-lg bg-secondary border border-border flex items-center justify-center active:scale-95">
                  <Minus size={14} />
                </button>
                <span className="w-8 text-center font-mono font-bold text-sm">{line.qty}</span>
                <button onClick={() => onQty(line.key, 1)} data-testid={`cart-qty-plus-${line.product_id}`} className="w-8 h-8 rounded-lg bg-secondary border border-border flex items-center justify-center active:scale-95">
                  <Plus size={14} />
                </button>
              </div>
              <p className="font-mono text-sm font-bold">{money(line.unit_price * line.qty)}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-border bg-[#121419] space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-mono" data-testid="cart-subtotal">{money(totals.subtotal)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            Discount {discount ? `(${discount.label})` : ""}
          </span>
          <span className="font-mono text-emerald-400" data-testid="cart-discount">
            {totals.discount > 0 ? `-${money(totals.discount)}` : money(0)}
            {discount && (
              <button onClick={onClearDiscount} className="ml-2 text-[10px] text-red-400 hover:underline" data-testid="cart-discount-remove">remove</button>
            )}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Tax {totals.taxLabel}</span>
          <span className="font-mono" data-testid="cart-tax">{money(totals.tax)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Service {totals.svcLabel}</span>
          <span className="font-mono" data-testid="cart-service">{money(totals.service)}</span>
        </div>
        <div className="flex justify-between pt-2 border-t border-border">
          <span className="font-heading font-bold">Total</span>
          <span className="font-mono text-xl font-extrabold text-primary" data-testid="cart-total">{money(totals.total)}</span>
        </div>
        <button
          onClick={onCheckout}
          disabled={cart.length === 0 || busy}
          data-testid="cart-checkout-button"
          className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-bold hover:opacity-90 active:scale-[0.98] transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {busy ? "Processing…" : "PAYMENT"}
        </button>
      </div>
    </div>
  );
}
