import { AlertCircle, Inbox, Loader2 } from "lucide-react";

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="card-soft flex items-center gap-4 p-6 text-sm text-muted-foreground"
    >
      <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card-soft flex flex-col items-start gap-2 p-6">
      <Inbox className="h-5 w-5 text-muted-foreground" aria-hidden />
      <p className="font-display text-xl">{title}</p>
      {hint && <p className="max-w-prose text-sm text-muted-foreground">{hint}</p>}
      {action}
    </div>
  );
}

export function ErrorState({
  what,
  error,
  onRetry,
}: {
  what: string;
  error?: unknown;
  onRetry?: () => void;
}) {
  const detail = error instanceof Error ? error.message : null;
  return (
    <div role="alert" className="card-soft flex flex-col items-start gap-2 border-l-4 border-destructive p-6">
      <div className="flex items-center gap-2">
        <AlertCircle className="h-5 w-5 shrink-0 text-destructive" aria-hidden />
        <p className="font-medium">Couldn&apos;t load {what} — try again.</p>
      </div>
      {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 min-h-10 rounded-full border border-border px-4 text-sm hover:bg-secondary/50"
        >
          Try again
        </button>
      )}
    </div>
  );
}
