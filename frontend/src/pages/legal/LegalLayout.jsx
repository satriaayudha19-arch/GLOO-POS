import { Link } from "react-router-dom";
import { Coffee } from "lucide-react";

export default function LegalLayout({ title, updatedAt, children, testid }) {
  return (
    <div className="min-h-screen bg-background text-foreground" data-testid={testid}>
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <Coffee size={18} className="text-primary-foreground" />
            </div>
            <span className="font-heading font-bold">GLOO POS</span>
          </Link>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <Link to="/terms" className="hover:text-foreground">Syarat &amp; Ketentuan</Link>
            <Link to="/privacy" className="hover:text-foreground">Kebijakan Privasi</Link>
            <Link to="/signup" className="hover:text-foreground">Daftar</Link>
          </div>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-10 space-y-6">
        <div>
          <h1 className="font-heading text-3xl font-extrabold">{title}</h1>
          {updatedAt && (
            <p className="text-xs text-muted-foreground mt-1">
              Terakhir diperbarui: <span className="font-mono">{updatedAt}</span>
            </p>
          )}
        </div>
        <article className="prose prose-invert prose-headings:font-heading prose-headings:font-bold prose-h2:text-xl prose-h2:mt-6 prose-h2:mb-2 prose-p:text-sm prose-p:leading-relaxed prose-li:text-sm prose-a:text-primary max-w-none">
          {children}
        </article>
        <footer className="pt-8 mt-8 border-t border-border text-xs text-muted-foreground">
          <p>
            Dokumen ini adalah versi awal (boilerplate) dan akan direview ulang secara berkala.
            Untuk pertanyaan hukum atau perlindungan data, hubungi{" "}
            <a href="mailto:hello@gloopos.id" className="underline hover:text-foreground">hello@gloopos.id</a>.
          </p>
        </footer>
      </main>
    </div>
  );
}
