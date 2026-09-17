import { useEffect, useMemo, useState } from "react";
import { BarChart3, Download, FileText, Package, Percent, RefreshCw, Wallet } from "lucide-react";
import api, { apiError } from "../lib/api";
import { money } from "../lib/format";
import { useAuth } from "../context/AuthContext";
import { usePos } from "../context/PosContext";
import PageHeader from "../components/PageHeader";

const TABS = [
  { key: "sales", label: "Sales", icon: BarChart3 },
  { key: "products", label: "Top Products", icon: Package },
  { key: "payments", label: "Payments", icon: Wallet },
  { key: "discounts", label: "Discounts", icon: Percent, feature: "DISCOUNTS" },
  { key: "shifts", label: "Shifts", icon: FileText },
  { key: "advanced-summary", label: "Advanced Summary", icon: RefreshCw, feature: "ADVANCED_REPORTS" },
];

function wibDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function StatCard({ label, value, detail }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
      <p className="mt-2 font-mono text-xl font-bold">{value}</p>
      {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
    </div>
  );
}

function UpgradeNotice({ feature }) {
  return (
    <div className="bg-card border border-dashed border-primary/50 rounded-2xl p-8 text-center" data-testid={`reports-upgrade-${feature.toLowerCase()}`}>
      <div className="mx-auto w-11 h-11 rounded-xl bg-primary/15 text-primary flex items-center justify-center"><BarChart3 size={20} /></div>
      <h3 className="mt-3 font-heading font-bold">Upgrade to unlock this report</h3>
      <p className="mt-1 text-sm text-muted-foreground">Your current subscription does not include {feature}. Ask an owner to upgrade the plan.</p>
    </div>
  );
}

function EmptyState({ label = "No data for this period." }) {
  return <p className="py-10 text-center text-sm text-muted-foreground">{label}</p>;
}

function Table({ children, testid }) {
  return <div className="bg-card border border-border rounded-2xl overflow-x-auto" data-testid={testid}><table className="w-full text-sm">{children}</table></div>;
}

function csvValue(value) {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function exportCsv(filename, rows, columns) {
  const csv = [columns.map((column) => csvValue(column.label)).join(",")]
    .concat(rows.map((row) => columns.map((column) => csvValue(row[column.key])).join(",")))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function SalesReport({ rows, onExport }) {
  const totalSales = rows.reduce((sum, row) => sum + (row.net_sales || 0), 0);
  const totalOrders = rows.reduce((sum, row) => sum + (row.orders_count || 0), 0);
  return (
    <div className="space-y-4" data-testid="reports-sales-panel">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard label="Net Sales" value={money(totalSales)} />
        <StatCard label="Orders" value={totalOrders} />
        <StatCard label="Average Transaction" value={money(totalOrders ? totalSales / totalOrders : 0)} />
      </div>
      <div className="flex justify-end"><button onClick={onExport} disabled={!rows.length} data-testid="reports-export-sales" className="h-9 px-3 rounded-lg bg-secondary border border-border text-xs font-semibold flex items-center gap-2 disabled:opacity-40"><Download size={14} /> Export CSV</button></div>
      <Table testid="reports-sales-table">
        <thead><tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
          <th className="px-4 py-3">Period</th><th className="px-4 py-3 text-right">Gross</th><th className="px-4 py-3 text-right">Discount</th><th className="px-4 py-3 text-right">Tax</th><th className="px-4 py-3 text-right">Service</th><th className="px-4 py-3 text-right">Net Sales</th><th className="px-4 py-3 text-right">Orders</th>
        </tr></thead>
        <tbody>{rows.map((row) => <tr key={row.period} className="border-b border-border/50"><td className="px-4 py-3 font-mono text-xs">{row.period}</td><td className="px-4 py-3 text-right font-mono">{money(row.gross_sales)}</td><td className="px-4 py-3 text-right font-mono">{money(row.discount_total)}</td><td className="px-4 py-3 text-right font-mono">{money(row.tax_total)}</td><td className="px-4 py-3 text-right font-mono">{money(row.service_total)}</td><td className="px-4 py-3 text-right font-mono font-bold">{money(row.net_sales)}</td><td className="px-4 py-3 text-right">{row.orders_count}</td></tr>)}{!rows.length && <tr><td colSpan={7}><EmptyState /></td></tr>}</tbody>
      </Table>
    </div>
  );
}

function ProductsReport({ rows, onExport }) {
  return (
    <div className="space-y-4" data-testid="reports-products-panel">
      <div className="flex justify-end"><button onClick={onExport} disabled={!rows.length} data-testid="reports-export-products" className="h-9 px-3 rounded-lg bg-secondary border border-border text-xs font-semibold flex items-center gap-2 disabled:opacity-40"><Download size={14} /> Export CSV</button></div>
      <Table testid="reports-products-table"><thead><tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground"><th className="px-4 py-3">Product</th><th className="px-4 py-3 text-right">Qty Sold</th><th className="px-4 py-3 text-right">Revenue</th></tr></thead><tbody>{rows.map((row) => <tr key={`${row.product_id}-${row.name}`} className="border-b border-border/50"><td className="px-4 py-3"><p className="font-semibold">{row.name}</p><p className="text-[11px] text-muted-foreground font-mono">{row.product_id}</p></td><td className="px-4 py-3 text-right">{row.qty_sold}</td><td className="px-4 py-3 text-right font-mono font-bold">{money(row.revenue)}</td></tr>)}{!rows.length && <tr><td colSpan={3}><EmptyState /></td></tr>}</tbody></Table>
    </div>
  );
}

function PaymentsReport({ rows }) {
  return <Table testid="reports-payments-table"><thead><tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground"><th className="px-4 py-3">Method</th><th className="px-4 py-3">Type</th><th className="px-4 py-3 text-right">Transactions</th><th className="px-4 py-3 text-right">Total</th></tr></thead><tbody>{rows.map((row) => <tr key={`${row.method_type}-${row.method_name}`} className="border-b border-border/50"><td className="px-4 py-3 font-semibold">{row.method_name}</td><td className="px-4 py-3 text-xs text-muted-foreground">{row.method_type}</td><td className="px-4 py-3 text-right">{row.count}</td><td className="px-4 py-3 text-right font-mono font-bold">{money(row.total)}</td></tr>)}{!rows.length && <tr><td colSpan={4}><EmptyState /></td></tr>}</tbody></Table>;
}

function DiscountsReport({ rows }) {
  return <Table testid="reports-discounts-table"><thead><tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground"><th className="px-4 py-3">Discount</th><th className="px-4 py-3 text-right">Uses</th><th className="px-4 py-3 text-right">Total Discount</th></tr></thead><tbody>{rows.map((row) => <tr key={`${row.discount_id || "manual"}-${row.name}`} className="border-b border-border/50"><td className="px-4 py-3"><p className="font-semibold">{row.name || "Manual Discount"}</p>{row.discount_id && <p className="text-[11px] font-mono text-muted-foreground">{row.discount_id}</p>}</td><td className="px-4 py-3 text-right">{row.uses}</td><td className="px-4 py-3 text-right font-mono font-bold">{money(row.total_discount)}</td></tr>)}{!rows.length && <tr><td colSpan={3}><EmptyState /></td></tr>}</tbody></Table>;
}

function ShiftsReport({ rows }) {
  return <Table testid="reports-shifts-table"><thead><tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground"><th className="px-4 py-3">Shift / Outlet</th><th className="px-4 py-3">Opened / Closed By</th><th className="px-4 py-3 text-right">Cash Sales</th><th className="px-4 py-3 text-right">Expected</th><th className="px-4 py-3 text-right">Actual</th><th className="px-4 py-3 text-right">Variance</th><th className="px-4 py-3">Payments</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-b border-border/50 align-top"><td className="px-4 py-3"><p className="font-mono text-xs">{row.id}</p><p className="text-xs text-muted-foreground">{row.status}</p></td><td className="px-4 py-3 text-xs"><p>{row.opened_by?.name || "-"}</p><p className="text-muted-foreground">closed: {row.closed_by?.name || "-"}</p></td><td className="px-4 py-3 text-right font-mono">{money(row.cash_sales)}</td><td className="px-4 py-3 text-right font-mono">{money(row.expected_cash)}</td><td className="px-4 py-3 text-right font-mono">{money(row.actual_cash)}</td><td className={`px-4 py-3 text-right font-mono font-bold ${(row.variance || 0) === 0 ? "text-emerald-400" : "text-amber-400"}`}>{money(row.variance)}</td><td className="px-4 py-3 min-w-[180px]">{row.payment_breakdown?.length ? row.payment_breakdown.map((payment) => <div key={`${row.id}-${payment.method_type}`} className="flex justify-between gap-3 text-xs"><span>{payment.method_name} <span className="text-muted-foreground">({payment.count})</span></span><span className="font-mono">{money(payment.total)}</span></div>) : <span className="text-xs text-muted-foreground">No paid orders</span>}</td></tr>)}{!rows.length && <tr><td colSpan={7}><EmptyState /></td></tr>}</tbody></Table>;
}

function AdvancedReport({ data }) {
  if (!data) return <EmptyState />;
  return <div className="space-y-4" data-testid="reports-advanced-panel"><div className="grid grid-cols-1 md:grid-cols-3 gap-3"><StatCard label="Current Sales" value={money(data.current?.sales)} detail={`${data.current?.orders || 0} orders`} /><StatCard label="Previous Sales" value={money(data.previous?.sales)} detail={`${data.previous?.orders || 0} orders`} /><StatCard label="Growth" value={`${data.growth_pct || 0}%`} detail="Compared with previous period" /></div><div className="grid grid-cols-1 lg:grid-cols-2 gap-4"><div className="bg-card border border-border rounded-2xl p-4"><h3 className="font-heading font-semibold mb-3">Sales by Outlet</h3>{data.outlets?.length ? data.outlets.map((row) => <div key={row.outlet_id} className="flex justify-between py-2 border-b border-border/50 text-sm"><span>{row.outlet_name || row.outlet_id}</span><span className="font-mono font-semibold">{money(row.sales)}</span></div>) : <EmptyState />}</div><div className="bg-card border border-border rounded-2xl p-4"><h3 className="font-heading font-semibold mb-3">Peak Hours (WIB)</h3>{data.peak_hours?.length ? data.peak_hours.map((row) => <div key={row.hour} className="flex justify-between py-2 border-b border-border/50 text-sm"><span>{String(row.hour).padStart(2, "0")}:{"00"}</span><span>{row.orders} orders · {money(row.sales)}</span></div>) : <EmptyState />}</div></div></div>;
}

export default function ReportsPage() {
  const { hasFeature } = useAuth();
  const { outlets } = usePos();
  const [activeTab, setActiveTab] = useState("sales");
  const [outletId, setOutletId] = useState("");
  const [dateFrom, setDateFrom] = useState(wibDate());
  const [dateTo, setDateTo] = useState(wibDate());
  const [groupBy, setGroupBy] = useState("DAY");
  const [applied, setApplied] = useState({ date_from: wibDate(), date_to: wibDate(), group_by: "DAY" });
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const visibleTabs = TABS;
  const activeTabFeature = TABS.find((tab) => tab.key === activeTab)?.feature;
  const activeFeatureUnavailable = activeTabFeature && !hasFeature(activeTabFeature);
  const params = useMemo(() => ({ ...applied, ...(outletId ? { outlet_id: outletId } : {}) }), [applied, outletId]);

  useEffect(() => {
    if (!hasFeature("REPORTS") || activeFeatureUnavailable) return;
    setLoading(true);
    setError(null);
    const endpoint = `/reports/${activeTab}`;
    api.get(endpoint, { params }).then((response) => setData(response.data)).catch((err) => { setData([]); setError(apiError(err)); }).finally(() => setLoading(false));
  }, [activeTab, hasFeature, params]);

  const applyFilters = () => setApplied({ date_from: dateFrom, date_to: dateTo, group_by: groupBy });
  const activeTabIsAdvanced = activeTab === "advanced-summary";
  const exportSales = () => exportCsv("gloo-sales.csv", data, [{ key: "period", label: "Period" }, { key: "gross_sales", label: "Gross Sales" }, { key: "discount_total", label: "Discount" }, { key: "tax_total", label: "Tax" }, { key: "service_total", label: "Service" }, { key: "net_sales", label: "Net Sales" }, { key: "orders_count", label: "Orders" }]);
  const exportProducts = () => exportCsv("gloo-top-products.csv", data, [{ key: "product_id", label: "Product ID" }, { key: "name", label: "Name" }, { key: "qty_sold", label: "Qty Sold" }, { key: "revenue", label: "Revenue" }]);

  if (!hasFeature("REPORTS")) {
    return <div data-testid="reports-page"><PageHeader title="Reports" subtitle="Performance and operational reporting" testid="reports-header" /><UpgradeNotice feature="REPORTS" /></div>;
  }

  return (
    <div data-testid="reports-page">
      <PageHeader title="Reports" subtitle="Sales, products, payments, discounts, and shifts in WIB" testid="reports-header" />
      <div className="bg-card border border-border rounded-2xl p-4 mb-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-end">
          <label className="text-xs font-semibold text-muted-foreground">From<input data-testid="reports-date-from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="block mt-1 h-10 px-3 rounded-lg bg-secondary border border-border text-sm" /></label>
          <label className="text-xs font-semibold text-muted-foreground">To<input data-testid="reports-date-to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="block mt-1 h-10 px-3 rounded-lg bg-secondary border border-border text-sm" /></label>
          {activeTab === "sales" && <label className="text-xs font-semibold text-muted-foreground">Group by<select data-testid="reports-group-by" value={groupBy} onChange={(e) => setGroupBy(e.target.value)} className="block mt-1 h-10 px-3 rounded-lg bg-secondary border border-border text-sm"><option value="DAY">Day</option><option value="WEEK">Week</option><option value="MONTH">Month</option></select></label>}
          <label className="text-xs font-semibold text-muted-foreground">Outlet<select data-testid="reports-outlet-filter" value={outletId} onChange={(e) => setOutletId(e.target.value)} className="block mt-1 h-10 px-3 rounded-lg bg-secondary border border-border text-sm"><option value="">All accessible outlets</option>{outlets.map((outlet) => <option key={outlet.id} value={outlet.id}>{outlet.name}</option>)}</select></label>
          <button onClick={applyFilters} data-testid="reports-apply-filters" className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-bold">Apply</button>
        </div>
      </div>
      <div className="flex gap-1 overflow-x-auto border-b border-border mb-4" role="tablist">{visibleTabs.map((tab) => { const Icon = tab.icon; return <button key={tab.key} onClick={() => setActiveTab(tab.key)} data-testid={`reports-tab-${tab.key}`} className={`shrink-0 px-3 py-2.5 text-sm font-semibold border-b-2 flex items-center gap-2 ${activeTab === tab.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}><Icon size={15} />{tab.label}</button>; })}</div>
      {activeFeatureUnavailable ? <UpgradeNotice feature={activeTabFeature} /> : loading ? <p className="text-sm text-muted-foreground">Loading report…</p> : error ? <div className="bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl p-4 text-sm">{error}</div> : activeTab === "sales" ? <SalesReport rows={data} onExport={exportSales} /> : activeTab === "products" ? <ProductsReport rows={data} onExport={exportProducts} /> : activeTab === "payments" ? <PaymentsReport rows={data} /> : activeTab === "discounts" ? <DiscountsReport rows={data} /> : activeTab === "shifts" ? <ShiftsReport rows={data} /> : activeTabIsAdvanced ? <AdvancedReport data={data} /> : null}
    </div>
  );
}
