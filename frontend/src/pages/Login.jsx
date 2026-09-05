import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Coffee } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { apiError } from "../lib/api";

export default function Login() {
  const { login, session } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session) {
      navigate(session.user.role === "PLATFORM_ADMIN" ? "/platform" : "/", { replace: true });
    }
  }, [session, navigate]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await login(email, password);
      navigate(data.user.role === "PLATFORM_ADMIN" ? "/platform" : "/", { replace: true });
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
            The POS that keeps up<br />with your <span className="text-primary">rush hour</span>.
          </h1>
          <p className="mt-4 text-muted-foreground max-w-md">
            Multi-tenant F&B point of sale. Subscription-powered, offline-ready, transaction-safe.
          </p>
        </div>
      </div>

      <div className="w-full lg:w-[460px] flex items-center justify-center p-8 border-l border-border bg-card">
        <form onSubmit={submit} className="w-full max-w-sm space-y-6" data-testid="login-form">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center">
              <Coffee size={24} className="text-primary-foreground" />
            </div>
            <div>
              <h2 className="font-heading text-2xl font-bold">GLOO POS</h2>
              <p className="text-xs text-muted-foreground">Sign in to your workspace</p>
            </div>
          </div>

          {error && (
            <div data-testid="login-error" className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground" htmlFor="email">Email</label>
            <input
              id="email"
              data-testid="login-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-11 px-3 rounded-lg bg-secondary border border-border focus:border-primary focus:outline-none text-sm"
              placeholder="you@business.com"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground" htmlFor="password">Password</label>
            <input
              id="password"
              data-testid="login-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-11 px-3 rounded-lg bg-secondary border border-border focus:border-primary focus:outline-none text-sm"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            data-testid="login-submit-button"
            disabled={busy}
            className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 active:scale-[0.98] transition disabled:opacity-50"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
          <p className="text-[11px] text-muted-foreground text-center">
            Demo: cashier@gloo.demo · owner: satriaayudha19@gmail.com
          </p>
        </form>
      </div>
    </div>
  );
}
