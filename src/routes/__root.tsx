import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  const [errorId] = useState(() =>
    Math.random().toString(16).slice(2, 10).toUpperCase(),
  );
  useEffect(() => {
    console.error(`[CCPR-${errorId}]`, error);
    reportLovableError(error, {
      boundary: "tanstack_root_error_component",
      errorId,
      timestamp: new Date().toISOString(),
    });
  }, [error, errorId]);

  return (
    <main role="alert" className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-lg text-center">
        <h1 className="text-3xl font-semibold text-foreground">Un momento, por favor</h1>
        <p className="mt-1 text-lg text-muted-foreground">One moment, please</p>
        <p className="mt-4 text-lg text-foreground">
          Ocurrió un problema técnico, pero sus datos y citas están seguros. Nuestro equipo ya fue notificado.
        </p>
        <p className="mt-2 text-base text-muted-foreground">
          Something went wrong, but your information is safe. Our team has been notified.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex min-h-12 items-center justify-center rounded-md bg-primary px-6 text-lg font-medium text-primary-foreground hover:bg-primary/90"
          >
            Volver a intentar · Try again
          </button>
          <a
            href="/"
            className="inline-flex min-h-12 items-center justify-center rounded-md border border-input bg-background px-6 text-lg font-medium text-foreground hover:bg-accent"
          >
            Ir al inicio · Go home
          </a>
        </div>
        <p className="mt-6 text-sm text-muted-foreground">Código de referencia / Reference: CCPR-{errorId}</p>
      </div>
    </main>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Con Cariño PR — caregiving coordination" },
      { name: "description", content: "Con Cariño PR keeps caregivers, clients, and families on the same page — schedules, care plans, visit logs and messages in one warm, calm workspace." },
      { name: "author", content: "Con Cariño PR" },
      { property: "og:title", content: "Con Cariño PR — caregiving coordination" },
      { property: "og:description", content: "Schedules, care plans, visit logs and messages for home care teams and the families they serve." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&family=Inter:wght@400;500;600;700&display=swap" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600;700&family=DM+Sans:wght@400;500;600;700&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <Toaster />
    </QueryClientProvider>
  );
}
