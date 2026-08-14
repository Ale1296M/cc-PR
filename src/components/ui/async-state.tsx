import { AlertCircle, Inbox } from "lucide-react";
import { useEffect, type ReactNode } from "react";

export type SkeletonShape = "rows" | "cards" | "list" | "chat" | "chart" | "stats";

function Bar({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className}`} />;
}

export function AsyncSkeleton({
  shape = "rows",
  count = 4,
}: {
  shape?: SkeletonShape;
  count?: number;
}) {
  const items = Array.from({ length: count });
  if (shape === "cards") {
    return (
      <div role="status" aria-busy="true" aria-live="polite" className="grid gap-4 sm:grid-cols-2">
        <span className="sr-only">Loading…</span>
        {items.map((_, i) => (
          <div key={i} className="card-soft p-6">
            <Bar className="h-6 w-1/2" />
            <Bar className="mt-4 h-4 w-3/4" />
            <Bar className="mt-4 h-3 w-2/3" />
          </div>
        ))}
      </div>
    );
  }
  if (shape === "chat") {
    return (
      <div role="status" aria-busy="true" aria-live="polite" className="space-y-4">
        <span className="sr-only">Loading…</span>
        {items.map((_, i) => (
          <div key={i} className={i % 2 ? "flex justify-end" : "flex justify-start"}>
            <Bar className={`h-12 ${i % 2 ? "w-1/2" : "w-2/3"}`} />
          </div>
        ))}
      </div>
    );
  }
  if (shape === "chart") {
    return (
      <div role="status" aria-busy="true" aria-live="polite" className="card-soft p-6">
        <span className="sr-only">Loading…</span>
        <Bar className="h-4 w-1/3" />
        <div className="mt-6 flex h-40 items-end gap-2">
          {Array.from({ length: 14 }).map((_, i) => (
            <Bar key={i} className="flex-1" />
          ))}
        </div>
        <Bar className="mt-6 h-3 w-1/2" />
      </div>
    );
  }
  if (shape === "stats") {
    return (
      <div role="status" aria-busy="true" aria-live="polite" className="grid gap-4 sm:grid-cols-3">
        <span className="sr-only">Loading…</span>
        {items.slice(0, 3).map((_, i) => (
          <div key={i} className="card-soft p-6">
            <Bar className="h-3 w-2/3" />
            <Bar className="mt-4 h-8 w-1/3" />
          </div>
        ))}
      </div>
    );
  }
  if (shape === "list") {
    return (
      <div role="status" aria-busy="true" aria-live="polite" className="card-soft divide-y divide-border">
        <span className="sr-only">Loading…</span>
        {items.map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4">
            <Bar className="h-10 w-10 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1">
              <Bar className="h-4 w-1/3" />
              <Bar className="mt-2 h-3 w-1/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div role="status" aria-busy="true" aria-live="polite" className="card-soft divide-y divide-border">
      <span className="sr-only">Loading…</span>
      {items.map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4">
          <div className="w-16 shrink-0 sm:w-20">
            <Bar className="h-4 w-full" />
            <Bar className="mt-2 h-3 w-3/4" />
          </div>
          <div className="min-w-0 flex-1">
            <Bar className="h-4 w-2/5" />
            <Bar className="mt-2 h-3 w-1/4" />
          </div>
          <Bar className="hidden h-6 w-20 shrink-0 rounded-full sm:block" />
        </div>
      ))}
    </div>
  );
}

export function AsyncEmpty({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="card-soft flex flex-col items-start gap-2 p-6">
      <Inbox className="h-5 w-5 text-muted-foreground" aria-hidden />
      <p className="type-subhead">{title}</p>
      {hint && <p className="max-w-prose type-meta font-normal text-muted-foreground">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function AsyncError({
  what,
  error,
  onRetry,
}: {
  what: string;
  error?: unknown;
  onRetry?: () => void;
}) {
  useEffect(() => {
    if (error) console.error(`[AsyncState] Couldn't load ${what}:`, error);
  }, [error, what]);
  return (
    <div
      role="alert"
      className="card-soft flex flex-col items-start gap-2 border-l-4 border-destructive p-6"
    >
      <div className="flex items-center gap-2">
        <AlertCircle className="h-5 w-5 shrink-0 text-destructive" aria-hidden />
        <p className="type-body font-medium">Couldn&apos;t load {what}.</p>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex min-h-10 items-center rounded-full border border-border px-4 type-meta hover:bg-secondary/50"
        >
          Try again
        </button>
      )}
    </div>
  );
}

/**
 * Four explicit states for every data-loading surface:
 * loading (shape-matched skeleton) → error (retry) → empty (warm copy) → success.
 */
export function AsyncState<T>({
  isPending,
  error,
  data,
  what,
  onRetry,
  skeleton = "rows",
  skeletonCount = 4,
  isEmpty,
  empty,
  children,
}: {
  isPending: boolean;
  error?: unknown;
  data: T | null | undefined;
  what: string;
  onRetry?: () => void;
  skeleton?: SkeletonShape;
  skeletonCount?: number;
  isEmpty?: (data: T) => boolean;
  empty: { title: string; hint?: string; action?: ReactNode };
  children: (data: T) => ReactNode;
}) {
  if (isPending) return <AsyncSkeleton shape={skeleton} count={skeletonCount} />;
  if (error) return <AsyncError what={what} error={error} onRetry={onRetry} />;
  if (data == null) return <AsyncEmpty {...empty} />;
  const empties = isEmpty ? isEmpty(data) : Array.isArray(data) ? data.length === 0 : false;
  if (empties) return <AsyncEmpty {...empty} />;
  return <>{children(data)}</>;
}
