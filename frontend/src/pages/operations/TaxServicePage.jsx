import { useEffect, useState } from "react";
import { toast } from "sonner";
import api, { apiError } from "../../lib/api";
import PageHeader from "../../components/PageHeader";

export default function TaxServicePage() {
  const [tax, setTax] = useState({ name: "Tax", percent: 0, inclusive: false, active: false });
  const [svc, setSvc] = useState({ name: "Service", percent: 0, active: false });

  useEffect(() => {
    api.get("/tax").then((r) => r.data?.id && setTax(r.data)).catch(() => {});
    api.get("/service-charge").then((r) => r.data?.id && setSvc(r.data)).catch(() => {});
  }, []);

  const saveTax = async () => {
    try {
      await api.put("/tax", { ...tax, percent: parseFloat(tax.percent) || 0 });
      toast.success("Tax saved");
    } catch (e) { toast.error(apiError(e)); }
  };
  const saveSvc = async () => {
    try {
      await api.put("/service-charge", { ...svc, percent: parseFloat(svc.percent) || 0 });
      toast.success("Service charge saved");
    } catch (e) { toast.error(apiError(e)); }
  };

  return (
    <div data-testid="tax-service-page">
      <PageHeader title="Tax & Service" subtitle="Applied server-side on every transaction" testid="tax-service-header" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <h3 className="font-heading font-semibold">Tax</h3>
          <input data-testid="tax-name" value={tax.name} onChange={(e) => setTax({ ...tax, name: e.target.value })} placeholder="Tax name (e.g. PB1)" className="w-full h-11 px-3 rounded-lg bg-secondary border border-border text-sm focus:border-primary focus:outline-none" />
          <div className="flex items-center gap-2">
            <input data-testid="tax-percent" type="number" min="0" step="0.1" value={tax.percent} onChange={(e) => setTax({ ...tax, percent: e.target.value })} className="flex-1 h-11 px-3 rounded-lg bg-secondary border border-border text-sm font-mono focus:border-primary focus:outline-none" />
            <span className="text-sm text-muted-foreground font-bold">%</span>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={tax.inclusive} onChange={(e) => setTax({ ...tax, inclusive: e.target.checked })} data-testid="tax-inclusive" /> Inclusive (included in price)</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={tax.active} onChange={(e) => setTax({ ...tax, active: e.target.checked })} data-testid="tax-active" /> Active</label>
          <button onClick={saveTax} data-testid="tax-save-button" className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-bold text-sm">Save Tax</button>
        </div>
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <h3 className="font-heading font-semibold">Service Charge</h3>
          <input data-testid="service-name" value={svc.name} onChange={(e) => setSvc({ ...svc, name: e.target.value })} placeholder="Service name" className="w-full h-11 px-3 rounded-lg bg-secondary border border-border text-sm focus:border-primary focus:outline-none" />
          <div className="flex items-center gap-2">
            <input data-testid="service-percent" type="number" min="0" step="0.1" value={svc.percent} onChange={(e) => setSvc({ ...svc, percent: e.target.value })} className="flex-1 h-11 px-3 rounded-lg bg-secondary border border-border text-sm font-mono focus:border-primary focus:outline-none" />
            <span className="text-sm text-muted-foreground font-bold">%</span>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={svc.active} onChange={(e) => setSvc({ ...svc, active: e.target.checked })} data-testid="service-active" /> Active</label>
          <button onClick={saveSvc} data-testid="service-save-button" className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-bold text-sm">Save Service Charge</button>
        </div>
      </div>
    </div>
  );
}
