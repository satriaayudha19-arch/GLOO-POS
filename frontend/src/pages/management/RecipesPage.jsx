import { useEffect, useState } from "react";
import { Plus, Trash2, Lock } from "lucide-react";
import { toast } from "sonner";
import api, { apiError } from "../../lib/api";
import PageHeader from "../../components/PageHeader";
import { useAuth } from "../../context/AuthContext";

function UpgradeNotice() {
  return (
    <div data-testid="recipes-upgrade" className="bg-card border border-border rounded-2xl p-8 text-center max-w-lg">
      <div className="w-12 h-12 rounded-xl bg-primary/15 text-primary flex items-center justify-center mx-auto mb-3">
        <Lock size={22} />
      </div>
      <h3 className="font-heading text-lg font-bold">Fitur Inventory belum aktif</h3>
      <p className="text-sm text-muted-foreground mt-1">Resep (BOM) untuk memotong stok otomatis tersedia mulai paket BASIC. Upgrade paket langganan untuk mengaktifkannya.</p>
    </div>
  );
}

export default function RecipesPage() {
  const { hasFeature } = useAuth();
  const enabled = hasFeature("INVENTORY");
  const [products, setProducts] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [editing, setEditing] = useState(null); // { product, recipeId, rows:[{ingredient_id, qty_per_unit}] }

  const loadRecipes = () => api.get("/recipes").then((r) => setRecipes(r.data)).catch((e) => toast.error(apiError(e)));
  useEffect(() => {
    if (!enabled) return;
    api.get("/products").then((r) => setProducts(r.data)).catch(() => {});
    api.get("/ingredients").then((r) => setIngredients(r.data)).catch(() => {});
    loadRecipes();
  }, [enabled]);

  if (!enabled) {
    return (
      <div data-testid="recipes-page">
        <PageHeader title="Recipes" subtitle="Resep bahan per produk" testid="recipes-header" />
        <UpgradeNotice />
      </div>
    );
  }

  const baseRecipe = (pid) => recipes.find((r) => r.product_id === pid && !r.variant_option_id);
  const ingName = (id) => ingredients.find((i) => i.id === id)?.name || "—";
  const ingUnit = (id) => ingredients.find((i) => i.id === id)?.unit || "";

  const open = (product) => {
    const r = baseRecipe(product.id);
    setEditing({
      product,
      recipeId: r?.id || null,
      rows: r ? r.ingredients.map((x) => ({ ingredient_id: x.ingredient_id, qty_per_unit: x.qty_per_unit })) : [],
    });
  };

  const addRow = () => setEditing((s) => ({ ...s, rows: [...s.rows, { ingredient_id: ingredients[0]?.id || "", qty_per_unit: 1 }] }));
  const setRow = (idx, key, val) => setEditing((s) => ({ ...s, rows: s.rows.map((r, i) => (i === idx ? { ...r, [key]: val } : r)) }));
  const delRow = (idx) => setEditing((s) => ({ ...s, rows: s.rows.filter((_, i) => i !== idx) }));

  const save = async (e) => {
    e.preventDefault();
    const rows = editing.rows
      .filter((r) => r.ingredient_id && Number(r.qty_per_unit) > 0)
      .map((r) => ({ ingredient_id: r.ingredient_id, qty_per_unit: Number(r.qty_per_unit) }));
    if (rows.length === 0) { toast.error("Tambahkan minimal satu bahan dengan jumlah > 0"); return; }
    const payload = { product_id: editing.product.id, ingredients: rows };
    try {
      if (editing.recipeId) await api.patch(`/recipes/${editing.recipeId}`, payload);
      else await api.post("/recipes", payload);
      toast.success("Resep disimpan");
      setEditing(null);
      loadRecipes();
    } catch (err) { toast.error(apiError(err)); }
  };

  const removeRecipe = async () => {
    if (!editing.recipeId) { setEditing(null); return; }
    try {
      await api.delete(`/recipes/${editing.recipeId}`);
      toast.success("Resep dihapus");
      setEditing(null);
      loadRecipes();
    } catch (err) { toast.error(apiError(err)); }
  };

  return (
    <div data-testid="recipes-page">
      <PageHeader title="Recipes" subtitle="Resep bahan per produk (stok otomatis terpotong saat terjual)" testid="recipes-header" />

      {ingredients.length === 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-xl p-4 text-sm mb-4">
          Belum ada bahan baku. Buat dulu di menu <b>Ingredients</b> sebelum menyusun resep.
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3">Produk</th>
              <th className="px-4 py-3">Resep</th>
              <th className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const r = baseRecipe(p.id);
              return (
                <tr key={p.id} data-testid={`recipe-row-${p.id}`} className="border-b border-border/50 hover:bg-secondary/40">
                  <td className="px-4 py-3">
                    <p className="font-semibold">{p.name}</p>
                    <p className="text-[11px] text-muted-foreground">{p.code}</p>
                  </td>
                  <td className="px-4 py-3">
                    {r ? (
                      <span className="px-2 py-1 rounded-md text-[11px] font-bold bg-emerald-500/15 text-emerald-400">{r.ingredients.length} bahan</span>
                    ) : (
                      <span className="px-2 py-1 rounded-md text-[11px] font-bold bg-secondary text-muted-foreground">Belum ada resep</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button data-testid={`recipe-edit-${p.id}`} onClick={() => open(p)} className="h-8 px-3 rounded-lg bg-secondary text-xs font-semibold hover:bg-accent">{r ? "Edit Resep" : "Buat Resep"}</button>
                  </td>
                </tr>
              );
            })}
            {products.length === 0 && <tr><td colSpan={3} className="px-4 py-10 text-center text-muted-foreground">Belum ada produk.</td></tr>}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <form onSubmit={save} className="bg-card border border-border w-full max-w-lg rounded-2xl p-6 space-y-3 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} data-testid="recipe-form-modal">
            <h3 className="font-heading text-lg font-bold">Resep · {editing.product.name}</h3>
            <p className="text-xs text-muted-foreground">Jumlah bahan yang dipakai untuk <b>1 porsi</b> produk ini.</p>

            <div className="space-y-2">
              {editing.rows.map((row, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <select data-testid={`recipe-ingredient-${idx}`} value={row.ingredient_id} onChange={(e) => setRow(idx, "ingredient_id", e.target.value)} className="flex-1 h-11 px-3 rounded-lg bg-secondary border border-border text-sm focus:border-primary focus:outline-none">
                    <option value="">Pilih bahan…</option>
                    {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
                  </select>
                  <input data-testid={`recipe-qty-${idx}`} type="number" step="any" min="0" value={row.qty_per_unit} onChange={(e) => setRow(idx, "qty_per_unit", e.target.value)} className="w-24 h-11 px-3 rounded-lg bg-secondary border border-border text-sm focus:border-primary focus:outline-none font-mono" />
                  <span className="text-xs text-muted-foreground w-10">{ingUnit(row.ingredient_id)}</span>
                  <button type="button" data-testid={`recipe-delrow-${idx}`} onClick={() => delRow(idx)} className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center text-red-400 hover:bg-accent"><Trash2 size={15} /></button>
                </div>
              ))}
              {editing.rows.length === 0 && <p className="text-sm text-muted-foreground py-2">Belum ada bahan pada resep ini.</p>}
            </div>

            <button type="button" data-testid="recipe-addrow" onClick={addRow} className="h-10 px-4 rounded-xl bg-secondary text-sm font-semibold flex items-center gap-2 hover:bg-accent"><Plus size={15} /> Tambah bahan</button>

            <div className="flex items-center gap-2 pt-1">
              <button type="submit" data-testid="recipe-form-submit" className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground font-bold text-sm">Simpan Resep</button>
              {editing.recipeId && (
                <button type="button" data-testid="recipe-delete" onClick={removeRecipe} className="h-11 px-4 rounded-xl bg-red-500/15 text-red-400 font-bold text-sm">Hapus</button>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
