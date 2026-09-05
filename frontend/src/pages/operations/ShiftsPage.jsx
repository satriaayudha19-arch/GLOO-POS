import { useEffect, useState } from "react";
import { toast } from "sonner";
import api, { apiError } from "../../lib/api";
import { money, fmtDateTime } from "../../lib/format";
import { usePos } from "../../context/PosContext";
import { useAuth } from "../../context/AuthContext";
import PageHeader from "../../components/PageHeader";

export default function ShiftsPage() {
  const { outletId, shift, refreshShift } = usePos();
  const { hasPerm } = useAuth();
  const [shifts, setShifts] = useState([]);
  const [journal, setJournal] = useState([]);
  const [cashForm, setCashForm] = useState(null); // {direction}
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [closeForm, setCloseForm] = useState(false);
  const [actualCash, setActualCash] = useState("");

  const load = () => {
    const params = outletId ? { outlet_id: outletId } : {};
    api.get("/shifts", { params }).then((r) => setShifts(r.data)).catch((e) => toast.error(apiError(e)));
    if (outletId && (hasPerm("shifts.manage") || hasPerm("*"))) {
      api.get("/journal", { params: { outlet_id: outletId } }).then((r) => setJournal(r.data)).catch(() => setJournal([]));
    }
  };
  useEffect(() => { load(); }, [outletId]);

  const addCash = async () => {
    try {
      await api.post(`/shifts/${shift.id}/cash`, { direction: cashForm.direction, amount: parseInt(amount, 10) || 0, note });
      toast.success(`Cash ${cashForm.direction.toLowerCase()} recorded`);
      setCashForm(null);
      setAmount("");
      setNote("");
      refreshShift();
    } catch (e) { toast.error(apiError(e)); }
  };

  const closeShift = async () => {
    try {
      const { data } = await api.post(`/shifts/${shift.id}/close`, { actual_cash: parseInt(actualCash, 10) || 0 });
      toast.success(`Shift closed · variance ${money(data.variance)}`);
      setCloseForm(false);
      setActualCash("");
      refreshShift();
      load();
    } catch (e) { toast.error(apiError(e)); }
  };

  return (
    <div data-testid="shifts-page">
      <PageHeader title="Cashier Shift" subtitle="Open/close shifts and cash movements" testid="shifts-header" />

      {shift && (
        <div className="bg-card border border-border rounded-2xl p-5 mb-5" data-testid="current-shift-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Current Shift</p>
              <p className="font-heading font-bold text-lg">{shift.cashier_name}</p>
              <p className="text-xs text-muted-foreground">Opened {fmtDateTime(shift.opened_at)} · opening cash {money(shift.opening_cash)}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setCashForm({ direction: "IN" })} data-testid="cash-in-button" className="h-10 px-4 rounded-xl bg-secondary border border-border text-sm font-bold">Cash In</button>
              <button onClick={() => setCashForm({ direction: "OUT" })} data-testid="cash-out-button" className="h-10 px-4 rounded-xl bg-secondary border border-border text-sm font-bold">Cash Out</button>
              <button onClick={() => setCloseForm(true)} data-testid="close-shift-button" className="h-10 px-4 rounded-xl bg-red-500/15 border border-red-500/40 text-red-400 text-sm font-bold">Close Shift</button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-center">
            {[["Opening", shift.opening_cash], ["Cash In", shift.cash_in], ["Cash Out", shift.cash_out], ["Drawer (est.)", shift.opening_cash + (shift.cash_in || 0) - (shift.cash_out || 0) + (shift.cash_sales || 0)]].map(([l, v]) => (
              <div key={l} className="bg-secondary/50 rounded-xl p-3">
                <p className="text-[11px] text-muted-foreground">{l}</p>
                <p className="font-mono font-bold text-sm mt-0.5">{money(v)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <p className="px-4 py-3 border-b border-border font-heading font-semibold text-sm">Shift History</p>
          <div className="max-h-96 overflow-y-auto">
            {shifts.map((s) => (
              <div key={s.id} data-testid={`shift-row-${s.id.slice(0, 8)}`} className="px-4 py-3 border-b border-border/50 last:border-0 flex justify-between items-center">
                <div>
                  <p className="text-sm font-semibold">{s.cashier_name}</p>
                  <p className="text-[11px] text-muted-foreground">{fmtDateTime(s.opened_at)}</p>
                </div>
                <div className="text-right">
                  <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${s.status === "OPEN" ? "bg-blue-500/15 text-blue-400" : "bg-secondary text-muted-foreground"}`}>{s.status}</span>
                  {s.status === "CLOSED" && (
                    <p className={`text-[11px] font-mono mt-1 ${s.variance === 0 ? "text-emerald-400" : "text-amber-400"}`}>variance {money(s.variance)}</p>
                  )}
                </div>
              </div>
            ))}
            {shifts.length === 0 && <p className="px-4 py-8 text-center text-sm text-muted-foreground">No shifts yet.</p>}
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <p className="px-4 py-3 border-b border-border font-heading font-semibold text-sm">Daily Journal</p>
          <div className="max-h-96 overflow-y-auto">
            {journal.map((j) => (
              <div key={j.id} className="px-4 py-2.5 border-b border-border/50 last:border-0 flex justify-between items-center gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-primary">{j.type.replace("_", " ")}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{j.actor_name} · {fmtDateTime(j.created_at)}</p>
                </div>
                <p className="font-mono text-xs shrink-0">
                  {j.data?.grand_total ? money(j.data.grand_total) : j.data?.amount ? money(j.data.amount) : j.data?.opening_cash != null ? money(j.data.opening_cash) : ""}
                </p>
              </div>
            ))}
            {journal.length === 0 && <p className="px-4 py-8 text-center text-sm text-muted-foreground">Journal entries will appear here.</p>}
          </div>
        </div>
      </div>

      {cashForm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setCashForm(null)}>
          <div className="bg-card border border-border w-full max-w-sm rounded-2xl p-6 space-y-3" onClick={(e) => e.stopPropagation()} data-testid="cash-movement-modal">
            <h3 className="font-heading text-lg font-bold">Cash {cashForm.direction === "IN" ? "In" : "Out"}</h3>
            <input data-testid="cash-amount-input" type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" className="w-full h-12 px-3 rounded-lg bg-secondary border border-border font-mono text-lg font-bold text-center focus:border-primary focus:outline-none" autoFocus />
            <input data-testid="cash-note-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="w-full h-11 px-3 rounded-lg bg-secondary border border-border text-sm focus:border-primary focus:outline-none" />
            <button onClick={addCash} data-testid="cash-movement-submit" className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-bold text-sm">Record</button>
          </div>
        </div>
      )}

      {closeForm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setCloseForm(null)}>
          <div className="bg-card border border-border w-full max-w-sm rounded-2xl p-6 space-y-3" onClick={(e) => e.stopPropagation()} data-testid="close-shift-modal">
            <h3 className="font-heading text-lg font-bold">Close Shift</h3>
            <p className="text-sm text-muted-foreground">Count the actual cash in the drawer. The system computes expected cash and variance.</p>
            <input data-testid="actual-cash-input" type="number" min="0" value={actualCash} onChange={(e) => setActualCash(e.target.value)} placeholder="Actual cash counted" className="w-full h-12 px-3 rounded-lg bg-secondary border border-border font-mono text-lg font-bold text-center focus:border-primary focus:outline-none" autoFocus />
            <button onClick={closeShift} data-testid="close-shift-confirm" className="w-full h-11 rounded-xl bg-red-500 text-white font-bold text-sm">Close Shift</button>
          </div>
        </div>
      )}
    </div>
  );
}
