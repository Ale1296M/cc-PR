import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

const STATIC_RE = /\.(js|mjs|css|woff2?|ttf|ico|svg|png|jpe?g|webp|avif)$/i;
const SENSITIVE_PREFIXES = ["/app", "/_serverFn", "/api", "/dashboard", "/mcp", "/.mcp"];

function applyEdgeHeaders(request: Request, response: Response): Response {
  const res = new Response(response.body, response);
  const { pathname } = new URL(request.url);
  const h = res.headers;

  if (SENSITIVE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    h.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
    h.set("Pragma", "no-cache");
    h.set("Expires", "0");
  } else if (pathname.startsWith("/assets/") && res.ok) {
    h.set("Cache-Control", "public, max-age=31536000, immutable");
  } else if (STATIC_RE.test(pathname) && res.ok) {
    h.set("Cache-Control", "public, max-age=86400");
  } else if (!h.has("Cache-Control")) {
    // HTML pages may embed user data after SSR — never cache on shared devices.
    h.set("Cache-Control", "no-store");
  }

  h.set("X-Content-Type-Options", "nosniff");
  h.set("X-Frame-Options", "DENY");
  h.set("Referrer-Policy", "strict-origin-when-cross-origin");
  h.set("Permissions-Policy", "geolocation=(self), camera=(), microphone=()");
  return res;
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return applyEdgeHeaders(request, await normalizeCatastrophicSsrResponse(response));
    } catch (error) {
      console.error(error);
      return applyEdgeHeaders(
        request,
        new Response(renderErrorPage(), {
          status: 500,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
      );
    }
  },
};
