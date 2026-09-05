import { useEffect, useState } from "react";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import api, { apiError } from "../../lib/api";
import { money } from "../../lib/format";
import PageHeader from "../../components/PageHeader";

const EMPTY = { name: "", code: "", sku: "", barcode: "", description: "", category_id: "", base_price: 0, image_url: "", variant_group_ids: [], modifier_group_ids: [], active: true };

export default function ProductsPage() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [vgroups, setVgroups] = useState([]);
  const [mgroups, setMgroups] = useState([]);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState(null); // null | {} product form
  const [isNew, setIsNew] = useState(false);

  const load = () => {
    api.get("/products", { params: q ? { q } : {} }).then((r) => setItems(r.data)).catch((e) => toast.error(apiError(e)));
  };
  useEffect(() => {
    load();
    api.get("/categories").then((r) => setCategories(r.data)).catch(() => {});
    api.get("/variant-groups").then((r) => setVgroups(r.data)).catch(() => {});
    api.get("/modifier-groups").then((r) => setMgroups(r.data)).catch(() => {});
  }, []);
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [q]);

  const save = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...editing, base_price: parseInt(editing.base_price, 10) || 0 };
      if (isNew) await api.post("/products", payload);
      else await api.patch(`/products/${editing.id}`, payload);
      toast.success(isNew ? "Product created" : "Product updated");
      setEditing(null);
      load();
    } catch (err) { toast.error(apiError(err)); }
  };

  const toggleList = (key, id) => {
    setEditing((s) => ({
      ...s,
      [key]: s[key].includes(id) ? s[key].filter((x) => x !== id) : [...s[key], id],
    }));
  };

  const catName = (id) => categories.find((c) => c.id === id)?.name || "—";

  return (
    <div data-testid="products-page">
      <PageHeader title="Products" subtitle="Your sellable catalog" testid="products-header">
        <button onClick={() => { setEditing({ ...EMPTY, category_id: categories[0]?.id || "" }); setIsNew(true); }} data-testid="product-create-button" className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-bold flex items-center gap-2">
          <Plus size={16} /> New Product
        </button>
      </PageHeader>

      <div className="relative max-w-md mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input data-testid="products-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, code, SKU, barcode…" className="w-full h-11 pl-9 pr-3 rounded-xl bg-card border border-border text-sm focus:border-primary focus:outline-none" />
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3 hidden md:table-cell">Category</th>
              <th className="px-4 py-3 hidden lg:table-cell">SKU / Barcode</th>
              <th className="px-4 py-3 text-right">Base Price</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id} data-testid={`product-row-${p.code || p.id}`} onClick={() => { setEditing({ ...EMPTY, ...p }); setIsNew(false); }} className="border-b border-border/50 hover:bg-secondary/40 cursor-pointer">
                <td className="px-4 py-3">
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-[11px] text-muted-foreground">{p.code}</p>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">{catName(p.category_id)}</td>
                <td className="px-4 py-3 hidden lg:table-cell font-mono text-xs text-muted-foreground">{p.sku} {p.barcode && `· ${p.barcode}`}</td>
                <td className="px-4 py-3 text-right font-mono font-bold">{money(p.base_price)}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-md text-[11px] font-bold ${p.active ? "bg-emerald-500/15 text-emerald-400" : "bg-secondary text-muted-foreground"}`}>{p.active ? "ACTIVE" : "INACTIVE"}</span>
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">No products.</td></tr>}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <form onSubmit={save} className="bg-card border border-border w-full max-w-lg rounded-2xl p-6 space-y-3 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} data-testid="product-form-modal">
            <h3 className="font-heading text-lg font-bold">{isNew ? "New Product" : `Edit ${editing.name}`}</h3>
            <input data-testid="product-form-name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Product name" required className="w-full h-11 px-3 rounded-lg bg-secondary border border-border text-sm focus:border-primary focus:outline-none" />
            <div className="grid grid-cols-3 gap-2">
              <input data-testid="product-form-code" value={editing.code} onChange={(e) => setEditing({ ...editing, code: e.target.value })} placeholder="Code" className="h-11 px-3 rounded-lg bg-secondary border border-border text-sm focus:border-primary focus:outline-none" />
              <input data-testid="product-form-sku" value={editing.sku} onChange={(e) => setEditing({ ...editing, sku: e.target.value })} placeholder="SKU" className="h-11 px-3 rounded-lg bg-secondary border border-border text-sm focus:border-primary focus:outline-none" />
              <input data-testid="product-form-barcode" value={editing.barcode} onChange={(e) => setEditing({ ...editing, barcode: e.target.value })} placeholder="Barcode" className="h-11 px-3 rounded-lg bg-secondary border border-border text-sm focus:border-primary focus:outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select data-testid="product-form-category" value={editing.category_id} onChange={(e) => setEditing({ ...editing, category_id: e.target.value })} className="h-11 px-3 rounded-lg bg-secondary border border-border text-sm focus:border-primary focus:outline-none">
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input data-testid="product-form-price" type="number" min="0" value={editing.base_price} onChange={(e) => setEditing({ ...editing, base_price: e.target.value })} placeholder="Base price" required className="h-11 px-3 rounded-lg bg-secondary border border-border text-sm focus:border-primary focus:outline-none font-mono" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1.5">Variant groups</p>
              <div className="flex flex-wrap gap-2">
                {vgroups.map((g) => (
                  <button type="button" key={g.id} onClick={() => toggleList("variant_group_ids", g.id)} data-testid={`product-form-vg-${g.name.toLowerCase()}`} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${editing.variant_group_ids.includes(g.id) ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border"}`}>
                    {g.name}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1.5">Modifier groups</p>
              <div className="flex flex-wrap gap-2">
                {mgroups.map((g) => (
                  <button type="button" key={g.id} onClick={() => toggleList("modifier_group_ids", g.id)} data-testid={`product-form-mg-${g.name.toLowerCase().replace(/\s+/g, "-")}`} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${editing.modifier_group_ids.includes(g.id) ? "bg-blue-500 text-white border-blue-500" : "bg-secondary border-border"}`}>
                    {g.name}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} data-testid="product-form-active" /> Active
            </label>
            <button type="submit" data-testid="product-form-submit" className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-bold text-sm">{isNew ? "Create Product" : "Save Changes"}</button>
          </form>
        </div>
      )}
    </div>
  );
}
