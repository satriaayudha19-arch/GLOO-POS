import { useEffect, useState } from "react";
import { Plus, Search, SlidersHorizontal, Lock, History, X } from "lucide-react";
import { toast } from "sonner";
import api, { apiError } from "../../lib/api";
import PageHeader from "../../components/PageHeader";
import { useAuth } from "../../context/AuthContext";

const EMPTY = { name: "", unit: "gram", stock_qty: 0, low_stock_threshold: 0, active: true };

const ADJ_TYPES = [
  { value: "PURCHASE_IN", label: "Pembelian (stok masuk)" },
  { value: "WASTE", label: "Terbuang / rusak" },
  { value: "ADJUSTMENT", label: "Koreksi stok" },
];

const MOVEMENT_TYPE_LABELS = {
  PURCHASE_IN: { label: "Pembelian", cls: "bg-emerald-500/15 text-emerald-400" },
  SALE_OUT: { label: "Penjualan", cls: "bg-sky-500/15 text-sky-400" },
  ADJUSTMENT: { label: "Koreksi", cls: "bg-amber-500/15 text-amber-400" },
  WASTE: { label: "Terbuang", cls: "bg-rose-500/15 text-rose-400" },
};

function formatMovementDate(iso) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function UpgradeNotice() {
  return (
    <div data-testid="ingredients-upgrade" className="bg-card border border-border rounded-2xl p-8 text-center max-w-lg">
      <div className="w-12 h-12 rounded-xl bg-primary/15 text-primary flex items-center justify-center mx-auto mb-3">
        <Lock size={22} />
      </div>
      <h3 className="font-heading text-lg font-bold">Fitur Inventory belum aktif</h3>
      <p className="text-sm text-muted-foreground mt-1">Kelola bahan baku dan stok tersedia mulai paket BASIC. Upgrade paket langganan untuk mengaktifkannya.</p>
    </div>
  );
}

export default function IngredientsPage() {
  const { hasFeature } = useAuth();
  const enabled = hasFeature("INVENTORY");
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState(null); // form object | null
  const [isNew, setIsNew] = useState(false);
  const [adjust, setAdjust] = useState(null); // { ingredient, type, qty_change, note }
  const [history, setHistory] = useState(null); // { ingredient, loading, rows, error }

  const load = () => {
    api.get("/ingredients").then((r) => setItems(r.data)).catch((e) => toast.error(apiError(e)));
  };

  const openHistory = async (ingredient) => {
    setHistory({ ingredient, loading: true, rows: [], error: null });
    try {
      const r = await api.get(`/ingredients/${ingredient.id}/movements`, { params: { limit: 200 } });
      setHistory({ ingredient, loading: false, rows: r.data || [], error: null });
    } catch (err) {
      const msg = apiError(err);
      setHistory({ ingredient, loading: false, rows: [], error: msg });
      toast.error(msg);
    }
  };
  useEffect(() => {
    if (enabled) load();
  }, [enabled]);

  if (!enabled) {
    return (
      <div data-testid="ingredients-page">
        <PageHeader title="Ingredients" subtitle="Bahan baku & stok" testid="ingredients-header" />
        <UpgradeNotice />
      </div>
    );
  }

  const filtered = items.filter((i) => i.name.toLowerCase().includes(q.toLowerCase()));

  const save = async (e) => {
    e.preventDefault();
    try {
      if (isNew) {
        await api.post("/ingredients", {
          name: editing.name,
          unit: editing.unit,
          stock_qty: Number(editing.stock_qty) || 0,
          low_stock_threshold: Number(editing.low_stock_threshold) || 0,
          active: editing.active,
        });
      } else {
        await api.patch(`/ingredients/${editing.id}`, {
          name: editing.name,
          unit: editing.unit,
          low_stock_threshold: Number(editing.low_stock_threshold) || 0,
          active: editing.active,
        });
      }
      toast.success(isNew ? "Bahan dibuat" : "Bahan diperbarui");
      setEditing(null);
      load();
    } catch (err) { toast.error(apiError(err)); }
  };

  const submitAdjust = async (e) => {
    e.preventDefault();
    const qty = Number(adjust.qty_change);
    if (!qty || Number.isNaN(qty)) { toast.error("Isi perubahan jumlah (boleh minus)"); return; }
    try {
      await api.post(`/ingredients/${adjust.ingredient.id}/adjust`, {
        type: adjust.type,
        qty_change: qty,
        note: adjust.note || "",
      });
      toast.success("Stok disesuaikan");
      setAdjust(null);
      load();
    } catch (err) { toast.error(apiError(err)); }
  };

  return (
    <div data-testid="ingredients-page">
      <PageHeader title="Ingredients" subtitle="Bahan baku & stok" testid="ingredients-header">
        <button onClick={() => { setEditing({ ...EMPTY }); setIsNew(true); }} data-testid="ingredient-create-button" className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-bold flex items-center gap-2">
          <Plus size={16} /> Bahan Baru
        </button>
      </PageHeader>

      <div className="relative max-w-md mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input data-testid="ingredients-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama bahan…" className="w-full h-11 pl-9 pr-3 rounded-xl bg-card border border-border text-sm focus:border-primary focus:outline-none" />
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3">Bahan</th>
              <th className="px-4 py-3">Satuan</th>
              <th className="px-4 py-3 text-right">Stok</th>
              <th className="px-4 py-3 text-right hidden md:table-cell">Batas Menipis</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((i) => {
              const low = i.active && i.stock_qty <= i.low_stock_threshold;
              return (
                <tr key={i.id} data-testid={`ingredient-row-${i.id}`} className="border-b border-border/50 hover:bg-secondary/40">
                  <td className="px-4 py-3 cursor-pointer" onClick={() => { setEditing({ ...i }); setIsNew(false); }}>
                    <p className="font-semibold">{i.name}</p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{i.unit}</td>
                  <td className={`px-4 py-3 text-right font-mono font-bold ${low ? "text-amber-400" : ""}`} data-testid={`ingredient-stock-${i.id}`}>{i.stock_qty}</td>
                  <td className="px-4 py-3 text-right font-mono text-muted-foreground hidden md:table-cell">{i.low_stock_threshold}</td>
                  <td className="px-4 py-3">
                    {low ? (
                      <span className="px-2 py-1 rounded-md text-[11px] font-bold bg-amber-500/15 text-amber-400">MENIPIS</span>
                    ) : (
                      <span className={`px-2 py-1 rounded-md text-[11px] font-bold ${i.active ? "bg-emerald-500/15 text-emerald-400" : "bg-secondary text-muted-foreground"}`}>{i.active ? "AKTIF" : "NONAKTIF"}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button data-testid={`ingredient-history-${i.id}`} onClick={() => openHistory(i)} className="h-8 px-3 rounded-lg bg-secondary text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-accent">
                        <History size={13} /> Riwayat
                      </button>
                      <button data-testid={`ingredient-adjust-${i.id}`} onClick={() => setAdjust({ ingredient: i, type: "PURCHASE_IN", qty_change: "", note: "" })} className="h-8 px-3 rounded-lg bg-secondary text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-accent">
                        <SlidersHorizontal size={13} /> Sesuaikan Stok
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">Belum ada bahan.</td></tr>}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <form onSubmit={save} className="bg-card border border-border w-full max-w-md rounded-2xl p-6 space-y-3" onClick={(e) => e.stopPropagation()} data-testid="ingredient-form-modal">
            <h3 className="font-heading text-lg font-bold">{isNew ? "Bahan Baru" : `Edit ${editing.name}`}</h3>
            <input data-testid="ingredient-form-name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Nama bahan (mis. Biji Kopi)" required className="w-full h-11 px-3 rounded-lg bg-secondary border border-border text-sm focus:border-primary focus:outline-none" />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Satuan</label>
                <input data-testid="ingredient-form-unit" value={editing.unit} onChange={(e) => setEditing({ ...editing, unit: e.target.value })} placeholder="gram / ml / pcs" required className="w-full h-11 px-3 rounded-lg bg-secondary border border-border text-sm focus:border-primary focus:outline-none" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Batas menipis</label>
                <input data-testid="ingredient-form-threshold" type="number" value={editing.low_stock_threshold} onChange={(e) => setEditing({ ...editing, low_stock_threshold: e.target.value })} className="w-full h-11 px-3 rounded-lg bg-secondary border border-border text-sm focus:border-primary focus:outline-none font-mono" />
              </div>
            </div>
            {isNew ? (
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Stok awal</label>
                <input data-testid="ingredient-form-stock" type="number" value={editing.stock_qty} onChange={(e) => setEditing({ ...editing, stock_qty: e.target.value })} className="w-full h-11 px-3 rounded-lg bg-secondary border border-border text-sm focus:border-primary focus:outline-none font-mono" />
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Stok saat ini: <span className="font-mono font-bold text-foreground">{editing.stock_qty} {editing.unit}</span>. Untuk mengubah stok gunakan tombol <b>Sesuaikan Stok</b> agar tercatat riwayatnya.</p>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} data-testid="ingredient-form-active" /> Aktif
            </label>
            <button type="submit" data-testid="ingredient-form-submit" className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-bold text-sm">{isNew ? "Buat Bahan" : "Simpan"}</button>
          </form>
        </div>
      )}

      {adjust && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setAdjust(null)}>
          <form onSubmit={submitAdjust} className="bg-card border border-border w-full max-w-md rounded-2xl p-6 space-y-3" onClick={(e) => e.stopPropagation()} data-testid="ingredient-adjust-modal">
            <h3 className="font-heading text-lg font-bold">Sesuaikan Stok · {adjust.ingredient.name}</h3>
            <p className="text-xs text-muted-foreground">Stok sekarang: <span className="font-mono font-bold text-foreground">{adjust.ingredient.stock_qty} {adjust.ingredient.unit}</span></p>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Jenis</label>
              <select data-testid="adjust-type" value={adjust.type} onChange={(e) => setAdjust({ ...adjust, type: e.target.value })} className="w-full h-11 px-3 rounded-lg bg-secondary border border-border text-sm focus:border-primary focus:outline-none">
                {ADJ_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Perubahan jumlah (+ menambah, - mengurangi)</label>
              <input data-testid="adjust-qty" type="number" step="any" value={adjust.qty_change} onChange={(e) => setAdjust({ ...adjust, qty_change: e.target.value })} placeholder="mis. 500 atau -50" className="w-full h-11 px-3 rounded-lg bg-secondary border border-border text-sm focus:border-primary focus:outline-none font-mono" />
            </div>
            <input data-testid="adjust-note" value={adjust.note} onChange={(e) => setAdjust({ ...adjust, note: e.target.value })} placeholder="Catatan (opsional)" className="w-full h-11 px-3 rounded-lg bg-secondary border border-border text-sm focus:border-primary focus:outline-none" />
            <button type="submit" data-testid="adjust-submit" className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-bold text-sm">Simpan Penyesuaian</button>
          </form>
        </div>
      )}

      {history && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setHistory(null)}>
          <div className="bg-card border border-border w-full max-w-3xl rounded-2xl p-6 space-y-4 max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()} data-testid="ingredient-history-modal">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-heading text-lg font-bold">Riwayat Stok · {history.ingredient.name}</h3>
                <p className="text-xs text-muted-foreground">
                  Stok sekarang: <span className="font-mono font-bold text-foreground">{history.ingredient.stock_qty} {history.ingredient.unit}</span>
                  {history.rows.length > 0 && (<> · <span className="font-mono">{history.rows.length}</span> pergerakan</>)}
                </p>
              </div>
              <button data-testid="history-close" onClick={() => setHistory(null)} className="h-8 w-8 rounded-lg bg-secondary hover:bg-accent flex items-center justify-center">
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2">Tanggal (WIB)</th>
                    <th className="px-3 py-2">Jenis</th>
                    <th className="px-3 py-2 text-right">Perubahan</th>
                    <th className="px-3 py-2">Catatan</th>
                    <th className="px-3 py-2">Oleh</th>
                  </tr>
                </thead>
                <tbody>
                  {history.loading && (
                    <tr><td colSpan={5} className="px-3 py-10 text-center text-muted-foreground" data-testid="history-loading">Memuat riwayat…</td></tr>
                  )}
                  {!history.loading && history.error && (
                    <tr><td colSpan={5} className="px-3 py-10 text-center text-rose-400" data-testid="history-error">{history.error}</td></tr>
                  )}
                  {!history.loading && !history.error && history.rows.length === 0 && (
                    <tr><td colSpan={5} className="px-3 py-10 text-center text-muted-foreground" data-testid="history-empty">Belum ada pergerakan stok.</td></tr>
                  )}
                  {!history.loading && !history.error && history.rows.map((m) => {
                    const meta = MOVEMENT_TYPE_LABELS[m.type] || { label: m.type, cls: "bg-secondary text-muted-foreground" };
                    const positive = Number(m.qty_change) > 0;
                    return (
                      <tr key={m.id} data-testid={`history-row-${m.id}`} className="border-b border-border/50 hover:bg-secondary/40">
                        <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{formatMovementDate(m.created_at)}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-1 rounded-md text-[11px] font-bold ${meta.cls}`}>{meta.label}</span>
                        </td>
                        <td className={`px-3 py-2 text-right font-mono font-bold ${positive ? "text-emerald-400" : "text-rose-400"}`}>
                          {positive ? "+" : ""}{m.qty_change} {history.ingredient.unit}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground max-w-[240px] truncate" title={m.note || ""}>{m.note || "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{m.actor_name || (m.reference_type === "order" ? "Sistem (order)" : "—")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
