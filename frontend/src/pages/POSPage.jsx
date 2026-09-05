import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, Coffee, BadgePercent } from "lucide-react";
import { toast } from "sonner";
import api, { apiError } from "../lib/api";
import { money } from "../lib/format";
import { usePos } from "../context/PosContext";
import { useAuth } from "../context/AuthContext";
import CartPane from "../components/pos/CartPane";
import ItemConfigModal from "../components/pos/ItemConfigModal";
import PaymentModal from "../components/pos/PaymentModal";
import ReceiptModal from "../components/pos/ReceiptModal";
import OpenShiftModal from "../components/pos/OpenShiftModal";

function estimateTotals(cart, discount, tax, svc) {
  const subtotal = cart.reduce((s, l) => s + l.unit_price * l.qty, 0);
  let discountAmt = 0;
  if (discount) {
    if (subtotal >= (discount.min_purchase || 0)) {
      discountAmt = discount.type === "PERCENTAGE" ? Math.round((subtotal * discount.value) / 100) : Math.min(discount.value, subtotal);
      if (discount.max_discount != null) discountAmt = Math.min(discountAmt, discount.max_discount);
    }
  }
  const taxable = Math.max(subtotal - discountAmt, 0);
  const taxAmt = tax ? (tax.inclusive ? Math.round(taxable - (taxable * 100) / (100 + tax.percent)) : Math.round((taxable * tax.percent) / 100)) : 0;
  const svcAmt = svc ? Math.round((taxable * svc.percent) / 100) : 0;
  const total = taxable + (tax?.inclusive ? 0 : taxAmt) + svcAmt;
  return {
    subtotal, discount: discountAmt, tax: taxAmt, service: svcAmt, total,
    taxLabel: tax ? `(${tax.percent}%${tax.inclusive ? " incl" : ""})` : "",
    svcLabel: svc ? `(${svc.percent}%)` : "",
  };
}

export default function POSPage() {
  const { outletId, outlet, shift, refreshShift } = usePos();
  const { hasPerm, hasFeature } = useAuth();
  const [catalog, setCatalog] = useState(null);
  const [catalogError, setCatalogError] = useState("");
  const [activeCat, setActiveCat] = useState("all");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState([]);
  const [configProduct, setConfigProduct] = useState(null);
  const [showPayment, setShowPayment] = useState(false);
  const [receiptOrder, setReceiptOrder] = useState(null);
  const [discount, setDiscount] = useState(null);
  const [busy, setBusy] = useState(false);
  const barcodeBuf = useRef("");
  const barcodeTimer = useRef(null);

  const loadCatalog = useCallback(() => {
    if (!outletId) return;
    setCatalogError("");
    api.get("/pos/catalog", { params: { outlet_id: outletId } })
      .then((r) => setCatalog(r.data))
      .catch((e) => setCatalogError(apiError(e)));
  }, [outletId]);

  useEffect(() => {
    setCatalog(null);
    loadCatalog();
  }, [loadCatalog]);

  // Keyboard-style barcode scanner: rapid digits ending with Enter
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.key === "Enter" && barcodeBuf.current.length >= 4) {
        const code = barcodeBuf.current;
        barcodeBuf.current = "";
        const p = catalog?.products.find((x) => x.barcode === code);
        if (p) {
          addProduct(p);
          toast.success(`Scanned: ${p.name}`);
        } else if (catalog) {
          toast.error(`No product for barcode ${code}`);
        }
        return;
      }
      if (/^[0-9a-zA-Z-]$/.test(e.key)) {
        barcodeBuf.current += e.key;
        clearTimeout(barcodeTimer.current);
        barcodeTimer.current = setTimeout(() => (barcodeBuf.current = ""), 120);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const addProduct = (p) => {
    if ((p.variant_group_ids?.length || 0) + (p.modifier_group_ids?.length || 0) > 0) {
      setConfigProduct(p);
    } else {
      addLine(p, { variant_option_ids: [], modifier_option_ids: [], unit_price: p.base_price, variant_labels: [], modifier_labels: [] });
    }
  };

  const addLine = (p, cfg) => {
    const key = [p.id, ...[...cfg.variant_option_ids].sort(), ...[...cfg.modifier_option_ids].sort()].join("|");
    setCart((prev) => {
      const ex = prev.find((l) => l.key === key);
      if (ex) return prev.map((l) => (l.key === key ? { ...l, qty: l.qty + 1 } : l));
      return [...prev, { key, product_id: p.id, name: p.name, unit_price: cfg.unit_price, qty: 1, variants: cfg.variant_labels, modifiers: cfg.modifier_labels, variant_option_ids: cfg.variant_option_ids, modifier_option_ids: cfg.modifier_option_ids }];
    });
    setConfigProduct(null);
  };

  const changeQty = (key, d) =>
    setCart((prev) => prev.map((l) => (l.key === key ? { ...l, qty: Math.max(1, l.qty + d) } : l)));
  const removeLine = (key) => setCart((prev) => prev.filter((l) => l.key !== key));

  const totals = useMemo(
    () => estimateTotals(cart, discount, catalog?.tax, catalog?.service_charge),
    [cart, discount, catalog]
  );

  const products = useMemo(() => {
    if (!catalog) return [];
    let list = catalog.products;
    if (activeCat !== "all") list = list.filter((p) => p.category_id === activeCat);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.code?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q) || p.barcode === search);
    }
    return list;
  }, [catalog, activeCat, search]);

  const pay = async (payment) => {
    setBusy(true);
    try {
      const payload = {
        outlet_id: outletId,
        shift_id: shift.id,
        client_transaction_id: crypto.randomUUID(),
        items: cart.map((l) => ({ product_id: l.product_id, variant_option_ids: l.variant_option_ids, modifier_option_ids: l.modifier_option_ids, qty: l.qty, notes: "" })),
        discount_id: discount?.id || null,
        payment,
      };
      const { data } = await api.post("/orders", payload);
      setReceiptOrder(data);
      setShowPayment(false);
      setCart([]);
      setDiscount(null);
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  if (!shift) {
    return (
      <div data-testid="pos-page">
        <OpenShiftModal outletId={outletId} onOpened={() => refreshShift()} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-12 gap-4" data-testid="pos-page">
      <div className="col-span-12 lg:col-span-7 xl:col-span-8 space-y-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              data-testid="pos-search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, code, SKU or scan barcode…"
              className="w-full h-11 pl-9 pr-3 rounded-xl bg-card border border-border focus:border-primary focus:outline-none text-sm"
            />
          </div>
          {hasFeature("DISCOUNTS") && hasPerm("discounts.manual") && catalog?.discounts?.length > 0 && (
            <select
              data-testid="pos-discount-select"
              value={discount?.id || ""}
              onChange={(e) => setDiscount(catalog.discounts.find((d) => d.id === e.target.value) || null)}
              className="h-11 px-3 rounded-xl bg-card border border-border text-sm focus:border-primary focus:outline-none"
            >
              <option value="">No discount</option>
              {catalog.discounts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} {d.type === "PERCENTAGE" ? `${d.value}%` : money(d.value)}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            data-testid="category-all"
            onClick={() => setActiveCat("all")}
            className={`px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap min-h-[44px] flex items-center gap-2 transition active:scale-95 ${activeCat === "all" ? "bg-primary text-primary-foreground" : "bg-card border border-border hover:bg-secondary"}`}
          >
            All
          </button>
          {catalog?.categories.map((c) => (
            <button
              key={c.id}
              data-testid={`category-${c.name.toLowerCase().replace(/\s+/g, "-")}`}
              onClick={() => setActiveCat(c.id)}
              className={`px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap min-h-[44px] flex items-center gap-2 transition active:scale-95 ${activeCat === c.id ? "bg-primary text-primary-foreground" : "bg-card border border-border hover:bg-secondary"}`}
            >
              {c.name}
            </button>
          ))}
        </div>

        {catalogError ? (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 text-center" data-testid="pos-catalog-error">
            <p className="text-red-400 font-semibold">{catalogError}</p>
            <button onClick={loadCatalog} className="mt-3 px-4 py-2 rounded-lg bg-secondary text-sm font-semibold" data-testid="pos-catalog-retry">Retry</button>
          </div>
        ) : !catalog ? (
          <p className="text-muted-foreground text-sm">Loading catalog…</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3" data-testid="pos-product-grid">
            {products.map((p) => (
              <button
                key={p.id}
                data-testid={`pos-product-card-${p.code || p.id}`}
                onClick={() => addProduct(p)}
                className="min-h-[110px] p-3.5 rounded-xl flex flex-col justify-between text-left cursor-pointer border border-border bg-card hover:bg-secondary active:scale-[0.98] transition-all duration-150 select-none"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold leading-snug">{p.name}</p>
                  <Coffee size={16} className="text-primary shrink-0 mt-0.5" />
                </div>
                <div>
                  <p className="font-mono font-bold text-primary">{money(p.base_price)}</p>
                  <p className="text-[10px] text-muted-foreground">{p.code}</p>
                </div>
              </button>
            ))}
            {products.length === 0 && <p className="col-span-full text-center text-sm text-muted-foreground py-10">No products found.</p>}
          </div>
        )}
      </div>

      <div className="col-span-12 lg:col-span-5 xl:col-span-4">
        <CartPane
          cart={cart}
          onQty={changeQty}
          onRemove={removeLine}
          discount={discount ? { ...discount, label: discount.name } : null}
          onClearDiscount={() => setDiscount(null)}
          totals={totals}
          busy={busy}
          onClear={() => { setCart([]); setDiscount(null); }}
          onCheckout={() => setShowPayment(true)}
        />
      </div>

      {configProduct && (
        <ItemConfigModal
          product={configProduct}
          variantGroups={catalog?.variant_groups || []}
          modifierGroups={catalog?.modifier_groups || []}
          onClose={() => setConfigProduct(null)}
          onAdd={(cfg) => addLine(configProduct, cfg)}
        />
      )}
      {showPayment && (
        <PaymentModal
          total={totals.total}
          paymentMethods={catalog?.payment_methods || []}
          onClose={() => setShowPayment(false)}
          onPay={pay}
          busy={busy}
        />
      )}
      {receiptOrder && <ReceiptModal order={receiptOrder} onClose={() => setReceiptOrder(null)} />}
    </div>
  );
}
