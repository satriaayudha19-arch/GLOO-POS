import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { money } from "../../lib/format";

export default function ItemConfigModal({ product, variantGroups, modifierGroups, onClose, onAdd }) {
  const vgs = useMemo(
    () => (product.variant_group_ids || []).map((id) => variantGroups.find((g) => g.id === id)).filter(Boolean),
    [product, variantGroups]
  );
  const mgs = useMemo(
    () => (product.modifier_group_ids || []).map((id) => modifierGroups.find((g) => g.id === id)).filter(Boolean),
    [product, modifierGroups]
  );
  const [selectedVariants, setSelectedVariants] = useState(() => {
    const init = {};
    vgs.forEach((g) => {
      if (g.required && g.options?.length) init[g.id] = g.options[0].id;
    });
    return init;
  });
  const [selectedModifiers, setSelectedModifiers] = useState([]);

  const unitPrice = useMemo(() => {
    let p = product.base_price;
    vgs.forEach((g) => {
      const opt = g.options?.find((o) => o.id === selectedVariants[g.id]);
      if (opt) p += opt.price_delta || 0;
    });
    mgs.forEach((g) => {
      g.options?.forEach((o) => {
        if (selectedModifiers.includes(o.id)) p += o.price || 0;
      });
    });
    return p;
  }, [product, vgs, mgs, selectedVariants, selectedModifiers]);

  const missingRequired = vgs.some((g) => g.required && !selectedVariants[g.id]);

  const toggleModifier = (g, oid) => {
    setSelectedModifiers((prev) => {
      if (prev.includes(oid)) return prev.filter((x) => x !== oid);
      if (!g.multi) {
        const groupOptionIds = (g.options || []).map((o) => o.id);
        return [...prev.filter((x) => !groupOptionIds.includes(x)), oid];
      }
      return [...prev, oid];
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-card border border-border w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-5 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        data-testid="item-config-modal"
      >
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-heading text-lg font-bold">{product.name}</h3>
            <p className="text-sm text-muted-foreground">Base {money(product.base_price)}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" data-testid="item-config-close">
            <X size={20} />
          </button>
        </div>

        {vgs.map((g) => (
          <div key={g.id}>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              {g.name} {g.required && <span className="text-primary">*</span>}
            </p>
            <div className="flex flex-wrap gap-2">
              {(g.options || []).map((o) => (
                <button
                  key={o.id}
                  data-testid={`variant-option-${o.name.toLowerCase().replace(/\s+/g, "-")}`}
                  onClick={() => setSelectedVariants((s) => ({ ...s, [g.id]: o.id }))}
                  className={`px-4 py-2.5 rounded-lg text-sm font-semibold min-h-[44px] border transition active:scale-95 ${
                    selectedVariants[g.id] === o.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary border-border hover:bg-accent"
                  }`}
                >
                  {o.name}
                  {o.price_delta ? ` +${money(o.price_delta)}` : ""}
                </button>
              ))}
            </div>
          </div>
        ))}

        {mgs.map((g) => (
          <div key={g.id}>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              {g.name} {g.multi ? "" : "(pick one)"}
            </p>
            <div className="flex flex-wrap gap-2">
              {(g.options || []).map((o) => (
                <button
                  key={o.id}
                  data-testid={`modifier-option-${o.name.toLowerCase().replace(/\s+/g, "-")}`}
                  onClick={() => toggleModifier(g, o.id)}
                  className={`px-4 py-2.5 rounded-lg text-sm font-semibold min-h-[44px] border transition active:scale-95 ${
                    selectedModifiers.includes(o.id)
                      ? "bg-blue-500 text-white border-blue-500"
                      : "bg-secondary border-border hover:bg-accent"
                  }`}
                >
                  {o.name}
                  {o.price ? ` +${money(o.price)}` : ""}
                </button>
              ))}
            </div>
          </div>
        ))}

        <button
          disabled={missingRequired}
          onClick={() =>
            onAdd({
              variant_option_ids: Object.values(selectedVariants),
              modifier_option_ids: selectedModifiers,
              unit_price: unitPrice,
              variant_labels: vgs.map((g) => g.options?.find((o) => o.id === selectedVariants[g.id])?.name).filter(Boolean),
              modifier_labels: mgs.flatMap((g) => (g.options || []).filter((o) => selectedModifiers.includes(o.id)).map((o) => ({ name: o.name, price: o.price }))),
            })
          }
          data-testid="item-config-add"
          className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-bold hover:opacity-90 active:scale-[0.98] transition disabled:opacity-40"
        >
          Add to Order · {money(unitPrice)}
        </button>
      </div>
    </div>
  );
}
