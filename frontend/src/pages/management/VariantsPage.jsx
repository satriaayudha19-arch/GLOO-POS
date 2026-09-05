import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import api, { apiError } from "../../lib/api";
import { money } from "../../lib/format";
import PageHeader from "../../components/PageHeader";

function GroupEditor({ title, groups, endpoint, optionPriceKey, optionPriceLabel, testPrefix }) {
  const [editing, setEditing] = useState(null);
  const [isNew, setIsNew] = useState(false);
  const [reload, setReload] = useState(0);

  const startNew = () => {
    setEditing({ name: "", options: [], ...(title === "Variant" ? { required: false } : { multi: true }) });
    setIsNew(true);
  };

  const save = async (e) => {
    e.preventDefault();
    try {
      if (isNew) await api.post(endpoint, editing);
      else await api.patch(`${endpoint}/${editing.id}`, editing);
      toast.success("Saved");
      setEditing(null);
      setReload((r) => r + 1);
    } catch (err) { toast.error(apiError(err)); }
  };

  useEffect(() => {}, [reload]);

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-heading font-semibold">{title} Groups</h3>
        <button onClick={startNew} data-testid={`${testPrefix}-create-button`} className="h-9 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-bold flex items-center gap-1.5">
          <Plus size={14} /> New Group
        </button>
      </div>
      <div className="space-y-3">
        {groups.map((g) => (
          <button key={g.id} onClick={() => { setEditing({ ...g }); setIsNew(false); }} data-testid={`${testPrefix}-group-${g.name.toLowerCase().replace(/\s+/g, "-")}`} className="w-full text-left bg-secondary/40 border border-border rounded-xl p-3 hover:bg-secondary transition">
            <div className="flex justify-between items-center">
              <p className="text-sm font-semibold">{g.name}</p>
              <span className="text-[10px] text-muted-foreground uppercase">{g.required ? "required" : g.multi ? "multi" : "single"}</span>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {(g.options || []).map((o) => (
                <span key={o.id} className="px-2 py-1 rounded-md bg-card border border-border text-[11px]">
                  {o.name}{o[optionPriceKey] ? ` +${money(o[optionPriceKey])}` : ""}
                </span>
              ))}
            </div>
          </button>
        ))}
        {groups.length === 0 && <p className="text-sm text-muted-foreground">No {title.toLowerCase()} groups yet.</p>}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <form onSubmit={save} className="bg-card border border-border w-full max-w-md rounded-2xl p-6 space-y-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} data-testid={`${testPrefix}-form-modal`}>
            <div className="flex justify-between items-center">
              <h3 className="font-heading text-lg font-bold">{isNew ? `New ${title} Group` : `Edit ${editing.name}`}</h3>
              <button type="button" onClick={() => setEditing(null)}><X size={18} className="text-muted-foreground" /></button>
            </div>
            <input data-testid={`${testPrefix}-form-name`} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Group name (e.g. Size)" required className="w-full h-11 px-3 rounded-lg bg-secondary border border-border text-sm focus:border-primary focus:outline-none" />
            {title === "Variant" ? (
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.required} onChange={(e) => setEditing({ ...editing, required: e.target.checked })} data-testid={`${testPrefix}-form-required`} /> Required selection</label>
            ) : (
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.multi} onChange={(e) => setEditing({ ...editing, multi: e.target.checked })} data-testid={`${testPrefix}-form-multi`} /> Allow multiple selections</label>
            )}
            <div>
              <div className="flex justify-between items-center mb-2">
                <p className="text-xs font-semibold text-muted-foreground">Options</p>
                <button type="button" onClick={() => setEditing({ ...editing, options: [...editing.options, { name: "", [optionPriceKey]: 0 }] })} data-testid={`${testPrefix}-add-option`} className="text-xs text-primary font-bold">+ Add option</button>
              </div>
              <div className="space-y-2">
                {editing.options.map((o, i) => (
                  <div key={i} className="flex gap-2">
                    <input value={o.name} onChange={(e) => { const opts = [...editing.options]; opts[i] = { ...o, name: e.target.value }; setEditing({ ...editing, options: opts }); }} placeholder="Option name" required className="flex-1 h-10 px-3 rounded-lg bg-secondary border border-border text-sm focus:border-primary focus:outline-none" data-testid={`${testPrefix}-option-name-${i}`} />
                    <input type="number" min="0" value={o[optionPriceKey]} onChange={(e) => { const opts = [...editing.options]; opts[i] = { ...o, [optionPriceKey]: parseInt(e.target.value, 10) || 0 }; setEditing({ ...editing, options: opts }); }} placeholder={optionPriceLabel} className="w-28 h-10 px-3 rounded-lg bg-secondary border border-border text-sm font-mono focus:border-primary focus:outline-none" data-testid={`${testPrefix}-option-price-${i}`} />
                  </div>
                ))}
              </div>
            </div>
            <button type="submit" data-testid={`${testPrefix}-form-submit`} className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-bold text-sm">Save Group</button>
          </form>
        </div>
      )}
    </div>
  );
}

export default function VariantsPage() {
  const [vgroups, setVgroups] = useState([]);
  const [mgroups, setMgroups] = useState([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    api.get("/variant-groups").then((r) => setVgroups(r.data)).catch((e) => toast.error(apiError(e)));
    api.get("/modifier-groups").then((r) => setMgroups(r.data)).catch((e) => toast.error(apiError(e)));
  }, [tick]);

  return (
    <div data-testid="variants-page">
      <PageHeader title="Variants & Modifiers" subtitle="Size, temperature, sugar level, extras" testid="variants-header" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" onClick={() => setTick((t) => t + 0)}>
        <GroupEditor title="Variant" groups={vgroups} endpoint="/variant-groups" optionPriceKey="price_delta" optionPriceLabel="Price ±" testPrefix="variant" key={`v-${tick}`} />
        <GroupEditor title="Modifier" groups={mgroups} endpoint="/modifier-groups" optionPriceKey="price" optionPriceLabel="Price" testPrefix="modifier" key={`m-${tick}`} />
      </div>
    </div>
  );
}
