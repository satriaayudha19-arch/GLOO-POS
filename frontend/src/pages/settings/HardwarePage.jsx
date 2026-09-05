import { useState } from "react";
import { Printer, ScanBarcode } from "lucide-react";
import { toast } from "sonner";
import PageHeader from "../../components/PageHeader";

function useLocal(key, def) {
  const [v, setV] = useState(() => {
    try { return JSON.parse(localStorage.getItem(key)) ?? def; } catch { return def; }
  });
  const save = (nv) => { setV(nv); localStorage.setItem(key, JSON.stringify(nv)); };
  return [v, save];
}

export default function HardwarePage() {
  const [printer, setPrinter] = useLocal("gloo.printer", { name: "", paper_width: "80", auto_print: false });
  const [scanner, setScanner] = useLocal("gloo.scanner", { enabled: true, suffix: "Enter" });

  return (
    <div data-testid="hardware-page" className="max-w-4xl">
      <PageHeader title="Hardware" subtitle="Device configuration is stored on this terminal only" testid="hardware-header" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <h3 className="font-heading font-semibold flex items-center gap-2"><Printer size={18} className="text-primary" /> Receipt Printer</h3>
          <input data-testid="printer-name" value={printer.name} onChange={(e) => setPrinter({ ...printer, name: e.target.value })} placeholder="Printer name (e.g. Epson TM-T82)" className="w-full h-11 px-3 rounded-lg bg-secondary border border-border text-sm focus:border-primary focus:outline-none" />
          <select data-testid="printer-paper-width" value={printer.paper_width} onChange={(e) => setPrinter({ ...printer, paper_width: e.target.value })} className="w-full h-11 px-3 rounded-lg bg-secondary border border-border text-sm focus:border-primary focus:outline-none">
            <option value="58">58mm thermal</option>
            <option value="80">80mm thermal</option>
          </select>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={printer.auto_print} onChange={(e) => setPrinter({ ...printer, auto_print: e.target.checked })} data-testid="printer-auto-print" /> Auto-print after payment</label>
          <button onClick={() => { window.print(); toast.success("Test print sent to browser/OS print dialog"); }} data-testid="printer-test-button" className="w-full h-11 rounded-xl bg-secondary border border-border font-bold text-sm hover:bg-accent">Test Print (Browser)</button>
          <p className="text-[11px] text-muted-foreground">Browser/OS printing is the universal fallback. Native ESC/POS integration plugs in here later.</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <h3 className="font-heading font-semibold flex items-center gap-2"><ScanBarcode size={18} className="text-primary" /> Barcode Scanner</h3>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={scanner.enabled} onChange={(e) => setScanner({ ...scanner, enabled: e.target.checked })} data-testid="scanner-enabled" /> Keyboard-wedge scanner enabled</label>
          <select data-testid="scanner-suffix" value={scanner.suffix} onChange={(e) => setScanner({ ...scanner, suffix: e.target.value })} className="w-full h-11 px-3 rounded-lg bg-secondary border border-border text-sm focus:border-primary focus:outline-none">
            <option value="Enter">Enter suffix</option>
            <option value="Tab">Tab suffix</option>
          </select>
          <p className="text-[11px] text-muted-foreground">On the POS screen, rapid key input ending with Enter is treated as a barcode scan and adds the matching product to the cart instantly — no modal required.</p>
        </div>
      </div>
    </div>
  );
}
