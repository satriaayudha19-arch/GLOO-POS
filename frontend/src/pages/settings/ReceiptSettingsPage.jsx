import { useEffect, useState } from "react";
import { toast } from "sonner";
import api, { apiError } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import PageHeader from "../../components/PageHeader";

export default function ReceiptSettingsPage() {
  const { session } = useAuth();
  const [footer, setFooter] = useState("");
  const [loaded, setLoaded] = useState(false);
  const isOwner = session?.user?.role === "OWNER";

  useEffect(() => {
    api.get("/subscription").then(() => {}).catch(() => {});
    api.get("/tax").then(() => {}).catch(() => {});
    // receipt footer lives in tenant settings; fetch via a light endpoint
    api.get("/settings/receipt").then((r) => { setFooter(r.data.receipt_footer || ""); setLoaded(true); }).catch(() => setLoaded(true));
  }, []);

  const save = async () => {
    try {
      await api.put("/settings/receipt", { receipt_footer: footer });
      toast.success("Receipt settings saved");
    } catch (e) { toast.error(apiError(e)); }
  };

  return (
    <div data-testid="receipt-settings-page" className="max-w-xl space-y-4">
      <PageHeader title="Receipt" subtitle="Transaction numbering & footer" testid="receipt-settings-header" />
      <div className="bg-card border border-border rounded-2xl p-6 space-y-3">
        <h3 className="font-heading font-semibold">Transaction Number Format</h3>
        <p className="font-mono text-xs bg-secondary rounded-lg p-3 break-all" data-testid="txn-format-preview">
          {session?.tenant?.code || "T001"}-O01-{session?.user?.code || "U001"}-YYYYMMDD-HHMMSS-000001
        </p>
        <p className="text-[11px] text-muted-foreground">
          Tenant-Outlet-User-Date-Time-Sequence. Generated server-side, unique, concurrency-safe, and collision-resistant.
          Sequences are scoped per outlet per day and enforced by the database.
        </p>
      </div>
      <div className="bg-card border border-border rounded-2xl p-6 space-y-3">
        <h3 className="font-heading font-semibold">Receipt Footer</h3>
        <textarea
          data-testid="receipt-footer-input"
          value={footer}
          onChange={(e) => setFooter(e.target.value)}
          disabled={!isOwner || !loaded}
          rows={3}
          placeholder="e.g. Terima kasih! Follow us @gloocoffee"
          className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm focus:border-primary focus:outline-none disabled:opacity-60"
        />
        {isOwner && (
          <button onClick={save} data-testid="receipt-settings-save" className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-bold text-sm">Save Receipt Settings</button>
        )}
      </div>
    </div>
  );
}
