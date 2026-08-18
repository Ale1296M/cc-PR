import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Check, Eye, EyeOff, HeartHandshake, Loader2, ShieldCheck, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export type WizardRole = "caregiver" | "admin" | "family_member";

const ROLES: { value: WizardRole; title: string; body: string; icon: typeof Users }[] = [
  { value: "caregiver", title: "Caregiver", body: "Log visits, follow care plans, message families.", icon: HeartHandshake },
  { value: "admin", title: "Administrator", body: "Schedule shifts, manage the roster, review incidents.", icon: ShieldCheck },
  { value: "family_member", title: "Family member", body: "Follow your loved one's day and message the team.", icon: Users },
];

const TIMEZONES = [
  "America/Puerto_Rico",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function passwordScore(pw: string) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw) || /[^A-Za-z0-9]/.test(pw)) score++;
  if (pw.length >= 12) score++;
  return score; // 0–4
}

function passwordProblems(pw: string) {
  const problems: string[] = [];
  if (pw.length < 8) problems.push("at least 8 characters");
  if (!/[a-z]/.test(pw) || !/[A-Z]/.test(pw)) problems.push("upper and lower case letters");
  if (!/[0-9]/.test(pw) && !/[^A-Za-z0-9]/.test(pw)) problems.push("a number or symbol");
  return problems;
}

const STRENGTH_LABEL = ["Too weak", "Weak", "Fair", "Strong", "Very strong"];

export function SignupWizard({ startStep = 1 }: { startStep?: 1 | 2 | 3 }) {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(startStep);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  // Step 1
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Step 2
  const [role, setRole] = useState<WizardRole | null>(null);

  // Step 3
  const [workspace, setWorkspace] = useState("");
  const [timezone, setTimezone] = useState(TIMEZONES[0]!);
  const [invites, setInvites] = useState("");
  const [mfa, setMfa] = useState(false);

  const score = useMemo(() => passwordScore(password), [password]);

  const validateStep1 = () => {
    const next: Record<string, string> = {};
    if (!fullName.trim()) next.fullName = "Tell us your name.";
    if (!EMAIL_RE.test(email.trim())) next.email = "Enter a valid email address.";
    const problems = passwordProblems(password);
    if (problems.length) next.password = `Password needs ${problems.join(", ")}.`;
    if (confirm !== password) next.confirm = "Passwords don't match.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const validateStep2 = () => {
    if (!role) {
      setErrors({ role: "Choose how you'll use Con Cariño PR." });
      return false;
    }
    setErrors({});
    return true;
  };

  const finish = async () => {
    const next: Record<string, string> = {};
    if (!workspace.trim()) next.workspace = "Give your workspace a name.";
    const badInvite = invites
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .find((s) => !EMAIL_RE.test(s));
    if (badInvite) next.invites = `"${badInvite}" isn't a valid email address.`;
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: {
            full_name: fullName.trim(),
            requested_role: role,
            workspace_name: workspace.trim(),
            timezone,
            mfa_opt_in: mfa,
          },
        },
      });
      if (error) throw error;
      window.localStorage.setItem("cc-mfa-pref", String(mfa));
      navigate({ to: "/dashboard" });
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-xl rounded-xl border bg-card p-6 shadow-sm">
      <div className="mb-6">
        <div className="flex items-center justify-between text-sm font-medium">
          <span>Step {step} of 3</span>
          <span className="text-muted-foreground">
            {step === 1 ? "Account setup" : step === 2 ? "Role selection" : "Workspace configuration"}
          </span>
        </div>
        <div
          className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={step}
          aria-valuemin={1}
          aria-valuemax={3}
          aria-label="Signup progress"
        >
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>
      </div>

      {step === 1 && (
        <div className="space-y-5">
          <h1 className="font-display text-3xl">Create your account</h1>
          <Field id="su-name" label="Full name" error={errors.fullName}>
            <input
              id="su-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
              aria-invalid={!!errors.fullName}
              aria-describedby={errors.fullName ? "su-name-error" : undefined}
              className={inputClass}
              placeholder="Ana Meléndez"
            />
          </Field>
          <Field id="su-email" label="Email" error={errors.email}>
            <input
              id="su-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "su-email-error" : undefined}
              className={inputClass}
              placeholder="you@example.com"
            />
          </Field>
          <Field id="su-password" label="Password" error={errors.password}>
            <div className="relative">
              <input
                id="su-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={!!errors.password}
                aria-describedby={`su-password-hint${errors.password ? " su-password-error" : ""}`}
                className={`${inputClass} pr-14`}
                placeholder="At least 8 characters"
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
            <div className="mt-2 flex items-center gap-2" aria-hidden="true">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={`h-1.5 flex-1 rounded-full ${
                    i < score ? (score >= 3 ? "bg-primary" : "bg-attention") : "bg-muted"
                  }`}
                />
              ))}
            </div>
            <p id="su-password-hint" className="mt-1.5 text-xs text-muted-foreground">
              Strength: {STRENGTH_LABEL[score]} — 8+ characters with upper and lower case and a number or symbol.
            </p>
          </Field>
          <Field id="su-confirm" label="Confirm password" error={errors.confirm}>
            <input
              id="su-confirm"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              aria-invalid={!!errors.confirm}
              aria-describedby={errors.confirm ? "su-confirm-error" : undefined}
              className={inputClass}
            />
          </Field>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <h1 className="font-display text-3xl">How will you use Con Cariño PR?</h1>
          <div role="radiogroup" aria-label="Role" className="grid gap-3">
            {ROLES.map((r) => {
              const Icon = r.icon;
              const active = role === r.value;
              return (
                <button
                  key={r.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setRole(r.value)}
                  className={`flex min-h-12 items-start gap-4 rounded-xl border p-5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    active ? "border-primary bg-primary/5" : "border-border hover:border-primary/60"
                  }`}
                >
                  <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="min-w-0">
                    <span className="block font-medium">{r.title}</span>
                    <span className="block text-sm text-muted-foreground">{r.body}</span>
                  </span>
                  {active && <Check className="ml-auto h-5 w-5 shrink-0 text-primary" />}
                </button>
              );
            })}
          </div>
          {errors.role && <p className="text-sm text-destructive">{errors.role}</p>}
          <p className="rounded-md border border-border bg-muted/40 p-4 text-xs text-muted-foreground">
            Administrator access is confirmed by your agency before it takes effect.
          </p>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-5">
          <h1 className="font-display text-3xl">Set up your workspace</h1>
          <Field id="su-workspace" label="Workspace name" error={errors.workspace}>
            <input
              id="su-workspace"
              value={workspace}
              onChange={(e) => setWorkspace(e.target.value)}
              aria-invalid={!!errors.workspace}
              aria-describedby={errors.workspace ? "su-workspace-error" : undefined}
              className={inputClass}
              placeholder="Familia Rodríguez"
            />
          </Field>
          <Field id="su-tz" label="Timezone">
            <select
              id="su-tz"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className={inputClass}
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz.replace("_", " ")}</option>
              ))}
            </select>
          </Field>
          <Field id="su-invites" label="Invite teammates (optional)" error={errors.invites}>
            <textarea
              id="su-invites"
              value={invites}
              onChange={(e) => setInvites(e.target.value)}
              rows={3}
              aria-invalid={!!errors.invites}
              aria-describedby={errors.invites ? "su-invites-error" : undefined}
              className={inputClass}
              placeholder="maya@example.com, sam@example.com"
            />
          </Field>

          <div className="flex items-start justify-between gap-4 rounded-xl border p-5">
            <div className="min-w-0">
              <p className="font-medium">Enable two-factor authentication</p>
              <p className="text-sm text-muted-foreground">
                We'll walk you through setup after your first sign-in. {/* TODO: wire to Supabase MFA enrollment */}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={mfa}
              aria-label="Enable two-factor authentication"
              onClick={() => setMfa((v) => !v)}
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                mfa ? "bg-primary" : "bg-muted border border-border"
              }`}
            >
              <span
                className={`absolute top-0.5 h-6 w-6 rounded-full bg-card shadow transition-all ${
                  mfa ? "left-[1.4rem]" : "left-0.5"
                }`}
              />
            </button>
          </div>

          {errors.form && (
            <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              {errors.form}
            </p>
          )}
        </div>
      )}

      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        {step > 1 ? (
          <Button
            type="button"
            variant="ghost"
            className="min-h-12 w-full sm:w-auto"
            onClick={() => setStep((s) => (s === 3 ? 2 : 1))}
          >
            Back
          </Button>
        ) : (
          <span className="hidden sm:block" />
        )}
        {step < 3 ? (
          <Button
            type="button"
            className="min-h-12 w-full rounded-full sm:w-auto sm:px-8"
            onClick={() => {
              if (step === 1 ? validateStep1() : validateStep2()) setStep((s) => (s === 1 ? 2 : 3));
            }}
          >
            Continue
          </Button>
        ) : (
          <Button
            type="button"
            disabled={busy}
            onClick={finish}
            className="min-h-12 w-full rounded-full sm:w-auto sm:px-8"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {busy ? "Creating…" : "Create workspace"}
          </Button>
        )}
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

const inputClass =
  "min-h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}