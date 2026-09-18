import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Coffee, ArrowRight } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { apiError } from "../lib/api";

const VALID_PLANS = ["FREE", "BASIC", "PRO", "ENTERPRISE"];

const PLAN_LABELS = {
  FREE: "Free (Trial 14 hari)",
  BASIC: "Basic",
  PRO: "Pro",
  ENTERPRISE: "Enterprise",
};

export default function Signup() {
  const { signup, session } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const requestedPlan = useMemo(() => {
    const raw = (params.get("plan") || "FREE").toUpperCase();
    return VALID_PLANS.includes(raw) ? raw : "FREE";
  }, [params]);

  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session && session.user) {
      navigate(session.user.role === "PLATFORM_ADMIN" ? "/platform" : "/", { replace: true });
    }
  }, [session, navigate]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Kata sandi minimal 8 karakter.");
      return;
    }
    if (password !== confirm) {
      setError("Konfirmasi kata sandi tidak cocok.");
      return;
    }
    setBusy(true);
    try {
      const data = await signup({
        business_name: businessName.trim(),
        owner_name: ownerName.trim(),
        owner_email: email.trim().toLowerCase(),
        owner_password: password,
        plan_code: requestedPlan,
      });
      const requested = (data.requested_plan_code || requestedPlan).toUpperCase();
      if (requested !== "FREE") {
        navigate(
          `/settings/subscription?requested=${encodeURIComponent(requested)}&pending_activation=1`,
          { replace: true }
        );
      } else {
        navigate("/", { replace: true });
      }
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      <div className="hidden lg:flex flex-1 relative overflow-hidden items-end">
        <img
          src="https://images.unsplash.com/photo-1738894715313-9f952be758b0?crop=entropy&cs=srgb&fm=jpg&q=85"
          alt="Cafe counter"
          className="absolute inset-0 w-full h-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="relative p-12">
          <h1 className="font-heading text-4xl xl:text-5xl font-extrabold tracking-tight">
            Mulai jualan<br />
            <span className="text-primary">hari ini juga.</span>
          </h1>
          <p className="mt-4 text-muted-foreground max-w-md">
            Aktivasi instan, 14 hari coba fitur Free tanpa kartu kredit. Upgrade paket kapan saja.
          </p>
        </div>
      </div>

      <div className="w-full lg:w-[500px] flex items-center justify-center p-8 border-l border-border bg-card overflow-y-auto">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5" data-testid="signup-form">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center">
              <Coffee size={24} className="text-primary-foreground" />
            </div>
            <div>
              <h2 className="font-heading text-2xl font-bold">Buat akun GLOO POS</h2>
              <p className="text-xs text-muted-foreground">Gratis untuk memulai — tanpa kartu kredit</p>
            </div>
          </div>

          <div
            data-testid="signup-plan-info"
            className="rounded-xl bg-primary/10 border border-primary/30 px-4 py-3"
          >
            <div className="text-[11px] uppercase tracking-wider text-primary/80 font-bold">
              Paket dipilih
            </div>
            <div className="text-sm font-bold text-foreground mt-0.5" data-testid="signup-plan-label">
              {PLAN_LABELS[requestedPlan] || requestedPlan}
            </div>
            {requestedPlan !== "FREE" && (
              <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
                Akun akan aktif dulu di paket <span className="font-semibold">Free (Trial 14 hari)</span>.
                Setelah signup selesai kami arahkan ke halaman aktivasi paket {requestedPlan}.
              </p>
            )}
          </div>

          {error && (
            <div
              data-testid="signup-error"
              className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2"
            >
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground" htmlFor="business_name">
              Nama bisnis / warung
            </label>
            <input
              id="business_name"
              data-testid="signup-business-name"
              type="text"
              required
              minLength={2}
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="w-full h-11 px-3 rounded-lg bg-secondary border border-border focus:border-primary focus:outline-none text-sm"
              placeholder="Kopi Senja Kami"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground" htmlFor="owner_name">
              Nama pemilik
            </label>
            <input
              id="owner_name"
              data-testid="signup-owner-name"
              type="text"
              required
              minLength={2}
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              className="w-full h-11 px-3 rounded-lg bg-secondary border border-border focus:border-primary focus:outline-none text-sm"
              placeholder="Nama lengkap kamu"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              data-testid="signup-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-11 px-3 rounded-lg bg-secondary border border-border focus:border-primary focus:outline-none text-sm"
              placeholder="kamu@bisnis.com"
              autoComplete="email"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground" htmlFor="password">
              Kata sandi (min. 8 karakter)
            </label>
            <input
              id="password"
              data-testid="signup-password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-11 px-3 rounded-lg bg-secondary border border-border focus:border-primary focus:outline-none text-sm"
              placeholder="Minimal 8 karakter"
              autoComplete="new-password"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground" htmlFor="confirm">
              Konfirmasi kata sandi
            </label>
            <input
              id="confirm"
              data-testid="signup-confirm"
              type="password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full h-11 px-3 rounded-lg bg-secondary border border-border focus:border-primary focus:outline-none text-sm"
              placeholder="Ulang kata sandi"
              autoComplete="new-password"
            />
          </div>

          <button
            type="submit"
            data-testid="signup-submit"
            disabled={busy}
            className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 active:scale-[0.98] transition disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {busy ? "Mendaftarkan…" : (<>Buat Akun <ArrowRight size={16} /></>)}
          </button>

          <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
            Dengan mendaftar kamu menyetujui{" "}
            <a href="/terms" className="underline hover:text-foreground">Syarat &amp; Ketentuan</a>{" "}
            dan{" "}
            <a href="/privacy" className="underline hover:text-foreground">Kebijakan Privasi</a>.
          </p>

          <div className="text-center text-sm text-muted-foreground">
            Sudah punya akun?{" "}
            <Link to="/login" data-testid="signup-to-login" className="text-primary font-semibold hover:underline">
              Masuk di sini
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
