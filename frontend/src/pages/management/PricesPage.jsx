import { useEffect, useState } from "react";
import { toast } from "sonner";
import api, { apiError } from "../../lib/api";
import { money } from "../../lib/format";
import PageHeader from "../../components/PageHeader";

export default function PricesPage() {
  const [items, setItems] = useState([]);
  const [drafts, setDrafts] = useState({});

  const load = () => api.get("/products").then((r) => setItems(r.data)).catch((e) => toast.error(apiError(e)));
  useEffect(() => { load(); }, []);

  const save = async (p) => {
    const price = parseInt(drafts[p.id], 10);
    if (isNaN(price) || price < 0 || price === p.base_price) return;
    try {
      await api.patch(`/products/${p.id}`, { base_price: price });
      toast.success(`${p.name}: ${money(price)}`);
      setDrafts((d) => ({ ...d, [p.id]: undefined }));
      load();
    } catch (e) { toast.error(apiError(e)); }
  };

  return (
    <div data-testid="prices-page">
      <PageHeader title="Prices" subtitle="Server-authoritative base prices per product" testid="prices-header" />
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3 text-right">Current Price</th>
              <th className="px-4 py-3 text-right w-56">New Price</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id} className="border-b border-border/50" data-testid={`price-row-${p.code || p.id}`}>
                <td className="px-4 py-3 font-semibold">{p.name}</td>
                <td className="px-4 py-3 text-right font-mono">{money(p.base_price)}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <input
                      type="number" min="0"
                      data-testid={`price-input-${p.code || p.id}`}
                      value={drafts[p.id] ?? ""}
                      onChange={(e) => setDrafts((d) => ({ ...d, [p.id]: e.target.value }))}
                      placeholder={String(p.base_price)}
                      className="w-32 h-9 px-3 rounded-lg bg-secondary border border-border text-sm font-mono text-right focus:border-primary focus:outline-none"
                    />
                    <button onClick={() => save(p)} data-testid={`price-save-${p.code || p.id}`} className="h-9 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-bold">Save</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
