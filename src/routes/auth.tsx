import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

const searchSchema = z.object({
  mode: z.enum(["signin", "signup"]).optional(),
  next: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Sign in · Kindred" },
      { name: "description", content: "Sign in or create your Kindred caregiving workspace." },
    ],
  }),
});

function AuthPage() {
  const { mode: initialMode, next } = useSearch({ from: "/auth" });
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">(initialMode ?? "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [language, setLanguage] = useState<"en" | "es">("en");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}${safeNext(next) ?? "/app"}`,
            data: {
              full_name: fullName,
              phone,
              preferred_language: language,
            },
          },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      const target = safeNext(next);
      if (target) {
        window.location.href = target;
      } else {
        navigate({ to: "/app" });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="hidden flex-col justify-between bg-primary p-10 text-primary-foreground md:flex">
        <Link to="/" className="font-display text-3xl">Kindred</Link>
        <div>
          <p className="max-w-md font-display text-4xl leading-tight">
            "The little notes at the end of each visit make my week."
          </p>
          <p className="mt-4 text-sm text-primary-foreground/70">
            — Ana, daughter & family coordinator
          </p>
        </div>
        <p className="text-xs text-primary-foreground/60">© {new Date().getFullYear()} Kindred</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <Link to="/" className="mb-6 inline-block font-display text-2xl md:hidden">Kindred</Link>
          <h1 className="font-display text-4xl">
            {mode === "signup" ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "signup"
              ? "Start coordinating care in minutes."
              : "Sign in to your caregiving workspace."}
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            {mode === "signup" && (
              <>
                <Field label="Full name">
                  <input
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="input"
                    placeholder="Jane Doe"
                  />
                </Field>
                <Field label="Phone (optional)">
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="input"
                    placeholder="+1 555 123 4567"
                  />
                </Field>
                <Field label="Preferred language">
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { v: "en", label: "English" },
                      { v: "es", label: "Español" },
                    ] as const).map((o) => (
                      <button
                        type="button"
                        key={o.v}
                        onClick={() => setLanguage(o.v)}
                        className={`rounded-lg border px-3 py-2 text-sm transition ${
                          language === o.v
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-border hover:border-primary/60"
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </Field>
                <p className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                  New accounts start without access to care data. An agency admin
                  assigns your role (caregiver or family member) after signup.
                </p>
              </>
            )}
            <Field label="Email">
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="you@example.com"
              />
            </Field>
            <Field label="Password">
              <input
                required
                type="password"
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
              />
            </Field>

            {error && (
              <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                {error}
              </p>
            )}

            <button
              disabled={busy}
              className="w-full rounded-full bg-primary px-4 py-3 font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
            >
              {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signup" ? "Already have an account?" : "New to Kindred?"}{" "}
            <button
              onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {mode === "signup" ? "Sign in" : "Create an account"}
            </button>
          </p>
        </div>
      </div>

      <style>{`
        .input {
          width: 100%;
          border: 1px solid var(--color-border);
          background: var(--color-card);
          border-radius: var(--radius-md);
          padding: 0.65rem 0.85rem;
          font: inherit;
          color: inherit;
          outline: none;
        }
        .input:focus { border-color: var(--color-primary); box-shadow: 0 0 0 3px oklch(0.38 0.075 155 / 0.15); }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

// Only same-origin relative paths are allowed as a post-auth return target.
function safeNext(next?: string) {
  if (!next) return undefined;
  if (!next.startsWith("/") || next.startsWith("//")) return undefined;
  return next;
}
