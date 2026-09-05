import { useState } from "react";
import { Coffee } from "lucide-react";
import api from "../../lib/api";
import { money } from "../../lib/format";

export default function OpenShiftModal({ outletId, onOpened }) {
  const [cash, setCash] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post("/shifts/open", { outlet_id: outletId, opening_cash: parseInt(cash || "0", 10) || 0 });
      onOpened(data);
    } catch (e) {
      setError(e?.response?.data?.detail?.message || "Failed to open shift");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border w-full max-w-sm rounded-2xl p-6 shadow-2xl space-y-5" data-testid="open-shift-modal">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/15 text-primary flex items-center justify-center mx-auto">
            <Coffee size={26} />
          </div>
          <h3 className="font-heading text-lg font-bold mt-3">Open Cashier Shift</h3>
          <p className="text-sm text-muted-foreground">Enter the opening cash in drawer to start selling.</p>
        </div>
        {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</p>}
        <input
          data-testid="opening-cash-input"
          type="number"
          inputMode="numeric"
          value={cash}
          onChange={(e) => setCash(e.target.value)}
          placeholder="Opening cash (e.g. 500000)"
          className="w-full h-14 px-4 rounded-xl bg-secondary border border-border focus:border-primary focus:outline-none font-mono text-xl font-bold text-center"
          autoFocus
        />
        <button
          onClick={submit}
          disabled={busy}
          data-testid="open-shift-button"
          className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-bold hover:opacity-90 active:scale-[0.98] transition disabled:opacity-40"
        >
          {busy ? "Opening…" : `Open Shift ${cash ? `· ${money(parseInt(cash, 10) || 0)}` : ""}`}
        </button>
      </div>
    </div>
  );
}
