import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, AlertTriangle, Loader2, Coffee } from "lucide-react";
import api, { apiError } from "../lib/api";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [state, setState] = useState("loading"); // loading | success | already | expired | invalid | error
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setState("invalid");
      setError("Link verifikasi tidak lengkap. Silakan klik ulang link dari email kamu.");
      return;
    }
    let cancelled = false;
    api
      .post("/auth/verify-email", { token })
      .then((r) => {
        if (cancelled) return;
        setEmail(r.data.email || "");
        setState(r.data.already_verified ? "already" : "success");
      })
      .catch((e) => {
        if (cancelled) return;
        const code = e?.response?.data?.detail?.code;
        if (code === "TOKEN_EXPIRED") setState("expired");
        else if (code === "INVALID_TOKEN") setState("invalid");
        else setState("error");
        setError(apiError(e));
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl p-8 space-y-5" data-testid="verify-email-page">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-primary flex items-center justify-center">
            <Coffee size={22} className="text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-heading text-xl font-bold">GLOO POS</h1>
            <p className="text-xs text-muted-foreground">Verifikasi Email</p>
          </div>
        </div>

        {state === "loading" && (
          <div data-testid="verify-loading" className="flex items-center gap-3 text-muted-foreground text-sm">
            <Loader2 size={18} className="animate-spin" />
            Sedang memverifikasi link…
          </div>
        )}

        {(state === "success" || state === "already") && (
          <div className="space-y-3" data-testid={state === "already" ? "verify-already" : "verify-success"}>
            <div className="flex items-center gap-3 text-emerald-400">
              <CheckCircle2 size={22} />
              <p className="font-heading font-bold">
                {state === "already" ? "Email sudah terverifikasi" : "Email berhasil diverifikasi"}
              </p>
            </div>
            {email && (
              <p className="text-sm text-muted-foreground">
                Alamat <span className="text-foreground font-semibold">{email}</span> sudah aktif untuk akun GLOO POS kamu.
              </p>
            )}
            <Link
              to="/"
              data-testid="verify-go-dashboard"
              className="inline-flex h-10 px-4 items-center rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90"
            >
              Ke Dashboard
            </Link>
          </div>
        )}

        {(state === "expired" || state === "invalid" || state === "error") && (
          <div className="space-y-3" data-testid={`verify-${state}`}>
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle size={22} />
              <p className="font-heading font-bold">
                {state === "expired"
                  ? "Link verifikasi kadaluarsa"
                  : state === "invalid"
                  ? "Link verifikasi tidak valid"
                  : "Gagal memverifikasi"}
              </p>
            </div>
            <p className="text-sm text-muted-foreground">{error || "Coba minta link baru dari dashboard."}</p>
            <div className="flex gap-2">
              <Link
                to="/"
                data-testid="verify-go-dashboard"
                className="inline-flex h-10 px-4 items-center rounded-lg bg-secondary text-sm font-bold hover:bg-accent"
              >
                Ke Dashboard
              </Link>
              <Link
                to="/login"
                className="inline-flex h-10 px-4 items-center rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90"
              >
                Masuk lagi
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
