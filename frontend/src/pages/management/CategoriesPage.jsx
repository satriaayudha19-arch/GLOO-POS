import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import api, { apiError } from "../../lib/api";
import PageHeader from "../../components/PageHeader";

export default function CategoriesPage() {
  const [items, setItems] = useState([]);
  const [name, setName] = useState("");

  const load = () => api.get("/categories").then((r) => setItems(r.data)).catch((e) => toast.error(apiError(e)));
  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    try {
      await api.post("/categories", { name, sort_order: items.length + 1 });
      setName("");
      toast.success("Category created");
      load();
    } catch (err) { toast.error(apiError(err)); }
  };

  const toggle = async (c) => {
    await api.patch(`/categories/${c.id}`, { active: !c.active }).then(load).catch((e) => toast.error(apiError(e)));
  };

  const remove = async (c) => {
    try {
      await api.delete(`/categories/${c.id}`);
      toast.success("Category deleted");
      load();
    } catch (e) { toast.error(apiError(e)); }
  };

  return (
    <div data-testid="categories-page">
      <PageHeader title="Categories" subtitle="Organize your product catalog" testid="categories-header" />
      <form onSubmit={create} className="flex gap-2 mb-5 max-w-md">
        <input
          data-testid="category-name-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New category name"
          required
          className="flex-1 h-11 px-3 rounded-xl bg-card border border-border text-sm focus:border-primary focus:outline-none"
        />
        <button type="submit" data-testid="category-create-button" className="h-11 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-bold flex items-center gap-2">
          <Plus size={16} /> Add
        </button>
      </form>
      <div className="bg-card border border-border rounded-2xl overflow-hidden max-w-2xl">
        {items.map((c) => (
          <div key={c.id} data-testid={`category-row-${c.name.toLowerCase()}`} className="flex items-center justify-between px-4 py-3 border-b border-border/50 last:border-0">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-muted-foreground w-6">{c.sort_order}</span>
              <span className="text-sm font-semibold">{c.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => toggle(c)} data-testid={`category-toggle-${c.name.toLowerCase()}`} className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${c.active ? "bg-emerald-500/15 text-emerald-400" : "bg-secondary text-muted-foreground"}`}>
                {c.active ? "ACTIVE" : "INACTIVE"}
              </button>
              <button onClick={() => remove(c)} data-testid={`category-delete-${c.name.toLowerCase()}`} className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground hover:text-red-400">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="px-4 py-8 text-center text-sm text-muted-foreground">No categories yet.</p>}
      </div>
    </div>
  );
}
