import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({
    meta: [
      { title: "Sign in · Con Cariño PR" },
      { name: "description", content: "Sign in to your Con Cariño PR caregiving workspace." },
      { property: "og:title", content: "Sign in · Con Cariño PR" },
      { property: "og:description", content: "Access schedules, care plans and family updates." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 30;

function LoginPage() {
  const navigate = useNavigate();
  const emailRef = useRef<HTMLInputElement>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!lockedUntil) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
      setCountdown(left);
      if (left === 0) {
        setLockedUntil(null);
        setAttempts(0);
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [lockedUntil]);

  const locked = lockedUntil !== null && countdown > 0;

  const validate = () => {
    const next: typeof errors = {};
    if (!email.trim()) next.email = "Enter your email address.";
    else if (!EMAIL_RE.test(email.trim())) next.email = "That doesn't look like a valid email address.";
    if (!password) next.password = "Enter your password.";
    else if (password.length < 6) next.password = "Passwords are at least 6 characters.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (locked || !validate()) return;
    setBusy(true);
    setErrors({});
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) throw error;
      if (remember) window.localStorage.setItem("cc-remember-email", email.trim().toLowerCase());
      else window.localStorage.removeItem("cc-remember-email");
      setAttempts(0);
      navigate({ to: "/dashboard" });
    } catch (err) {
      const next = attempts + 1;
      setAttempts(next);
      if (next >= MAX_ATTEMPTS) setLockedUntil(Date.now() + LOCKOUT_SECONDS * 1000);
      setErrors({
        form: err instanceof Error ? err.message : "We couldn't sign you in. Please try again.",
      });
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const saved = window.localStorage.getItem("cc-remember-email");
    if (saved) setEmail(saved);
  }, []);

  return (
    <div className="min-h-dvh">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6 md:px-8">
        <Link to="/" className="font-display text-2xl">Con Cariño PR</Link>
        <Link to="/signup" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
          Create an account
        </Link>
      </div>

      <main className="mx-auto max-w-6xl px-4 pb-20 md:px-8">
        <div className="mx-auto w-full max-w-md rounded-xl border bg-card p-6 shadow-sm">
          <h1 className="font-display text-3xl">Welcome back</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to your caregiving workspace.
          </p>

          <form onSubmit={submit} noValidate className="mt-8 space-y-5">
            <div>
              <label htmlFor="login-email" className="mb-1.5 block text-sm font-medium">
                Email
              </label>
              <input
                id="login-email"
                ref={emailRef}
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "login-email-error" : undefined}
                className="min-h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="you@example.com"
              />
              {errors.email && (
                <p id="login-email-error" className="mt-1.5 text-sm text-destructive">
                  {errors.email}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="login-password" className="mb-1.5 block text-sm font-medium">
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? "login-password-error" : undefined}
                  className="min-h-12 w-full rounded-md border border-input bg-background px-3 py-2 pr-14 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-1 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p id="login-password-error" className="mt-1.5 text-sm text-destructive">
                  {errors.password}
                </p>
              )}
            </div>

            <label htmlFor="login-remember" className="flex min-h-11 items-center gap-2.5 text-sm">
              <input
                id="login-remember"
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-5 w-5 rounded border-input accent-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              Remember me on this device
            </label>

            {errors.form && (
              <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                {errors.form}
                {attempts > 0 && attempts < MAX_ATTEMPTS && (
                  <span className="mt-1 block text-xs">
                    {MAX_ATTEMPTS - attempts} attempt{MAX_ATTEMPTS - attempts === 1 ? "" : "s"} left before a short pause.
                  </span>
                )}
              </p>
            )}

            {locked && (
              <p role="status" className="rounded-md border border-attention/40 bg-attention-soft p-3 text-sm text-attention-foreground">
                Too many attempts. Please wait {countdown}s before trying again.
              </p>
            )}

            <Button type="submit" disabled={busy || locked} className="min-h-12 w-full rounded-full text-base">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {locked ? `Try again in ${countdown}s` : busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            New to Con Cariño PR?{" "}
            <Link to="/signup" className="font-medium text-primary underline-offset-4 hover:underline">
              Create your workspace
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}