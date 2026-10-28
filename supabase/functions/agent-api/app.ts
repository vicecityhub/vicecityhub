// Vice City Hub — Agent API v12 · request pipeline
// Pure orchestration, no Deno and no Supabase: every collaborator is injected (see main.ts), which keeps the
// whole pipeline testable from Node (tests/agentApp.test.mjs). Order and behaviour are exactly those of the old
// Deno.serve callback in index.ts:
//   CORS preflight → owner console → API key → rate limits → route / MCP → event log
import type { Key, R } from "./lib.ts";

export interface AppDeps {
  CORS: Record<string, string>;
  clientIpHash: (req: Request) => Promise<string>;
  /** null = anonymous · "invalid" = a key was sent but is wrong/revoked/expired */
  authenticate: (req: Request) => Promise<Key | null | "invalid">;
  /** true while the bucket is under its limit */
  rate: (bucket: string, limit: number, windowSec: number) => Promise<boolean>;
  fail: (status: number, code: string, message: string, hint?: string) => R;
  toResponse: (r: R) => Response;
  /** The route table from router.ts. */
  route: (req: Request, url: URL, path: string, key: Key | null, ipHash: string) => Promise<R>;
  ownerRoute: (req: Request, path: string, body: any) => Promise<R>;
  mcpHandle: (req: Request, ctx: { key: Key | null; ipHash: string }) => Promise<Response>;
  /** Fire-and-forget audit row for POST requests. Must never throw. */
  logEvent: (row: Record<string, unknown>) => void;
}

/** "/functions/v1/agent-api/v1/news/" → "/v1/news"; the bare function URL becomes "/". */
export const normalizePath = (pathname: string): string =>
  pathname.replace(/^\/(functions\/v1\/)?agent-api/, "").replace(/\/+$/, "") || "/";

const UNEXPECTED = "Unexpected server error.";

export function createApp(d: AppDeps) {
  const internalError = () => d.toResponse(d.fail(500, "internal_error", UNEXPECTED));

  const rateLimited = (message: string, retryAfter: boolean): Response => {
    const r = d.fail(429, "rate_limited", message);
    if (retryAfter) r.headers = { "Retry-After": "60" };
    return d.toResponse(r);
  };

  /** Human owner console: authenticated by a Supabase session JWT, not by an agent key. */
  async function handleOwner(req: Request, path: string, ipHash: string): Promise<Response> {
    if (!(await d.rate(`owner:${ipHash}`, 60, 60))) return rateLimited("Too many requests.", false);
    let body: any = {};
    if (req.method === "POST") {
      try {
        const text = await req.text();
        body = text ? JSON.parse(text) : {};
      } catch {
        return d.toResponse(d.fail(400, "invalid_json", "Request body must be valid JSON."));
      }
    }
    try {
      return d.toResponse(await d.ownerRoute(req, path, body));
    } catch (e) {
      console.error("owner error", (e as Error).message);
      return internalError();
    }
  }

  /** 429 when the caller exceeded the general limit or, for POST, the write limit; otherwise null. */
  async function rateLimitResponse(req: Request, key: Key | null, ipHash: string): Promise<Response | null> {
    const bucket = key ? `key:${key.id}` : `ip:${ipHash}`;
    if (!(await d.rate(bucket, key ? 300 : 120, 60))) return rateLimited("Too many requests. Back off and retry.", true);
    if (req.method === "POST" && !(await d.rate(`w:${key ? key.id : ipHash}`, 30, 60))) return rateLimited("Write limit: 30 requests/minute.", true);
    return null;
  }

  /** MCP endpoint or the route table; a handler that throws becomes a 500. */
  async function dispatch(req: Request, url: URL, path: string, key: Key | null, ipHash: string): Promise<Response> {
    try {
      if (path === "/mcp") return await d.mcpHandle(req, { key, ipHash });
      return d.toResponse(await d.route(req, url, path, key, ipHash));
    } catch (e) {
      console.error("agent-api error", path, (e as Error).message);
      return internalError();
    }
  }

  return async function handle(req: Request): Promise<Response> {
    const t0 = Date.now();
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: d.CORS });

    const url = new URL(req.url);
    const path = normalizePath(url.pathname);
    const ipHash = await d.clientIpHash(req);

    if (path.startsWith("/v1/owner/")) return await handleOwner(req, path, ipHash);

    const key = await d.authenticate(req);
    if (key === "invalid") return d.toResponse(d.fail(401, "invalid_api_key", "The API key is unknown, revoked or expired."));

    const limited = await rateLimitResponse(req, key, ipHash);
    if (limited) return limited;

    const res = await dispatch(req, url, path, key, ipHash);

    if (req.method === "POST") {
      d.logEvent({ agent_key_id: key?.id ?? null, method: req.method, path, status: res.status, ip_hash: ipHash, user_agent: (req.headers.get("user-agent") || "").slice(0, 200), ms: Date.now() - t0 });
    }
    return res;
  };
}
