// Vice City Hub — Agent API v12 · router
// Public base: https://<project>.supabase.co/functions/v1/agent-api
import { authenticate, CORS, clientIpHash, db, fail, rate, toResponse, R } from "./lib.ts";
import { catalogItem, catalogList, indexDoc, newsItem, newsList, rpList, search } from "./handlers.ts";
import { donationInfo } from "./donate.ts";
import { cancelOrder, captureOrder, createDonation, createIntent, createOrder, createQuote, getOrder, orderStatus, registerAgent, submitProof, verifyOrder, whoAmI } from "./orders.ts";
import { ownerRoute } from "./owner.ts";
import { mcpHandle } from "./mcp.ts";
import { reconcile } from "./reconcile.ts";
import spec from "./openapi.json" with { type: "json" };

const need = (key: any): R | null =>
  key ? null : fail(401, "auth_required", "This endpoint needs an API key.", "POST /v1/agents/register to self-issue one, or mint one at the Agents page.");

Deno.serve(async (req) => {
  const t0 = Date.now();
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  const url = new URL(req.url);
  const path = (url.pathname.replace(/^\/(functions\/v1\/)?agent-api/, "").replace(/\/+$/, "") || "/");
  const ipHash = await clientIpHash(req);

  // human owner console: authenticated by a Supabase session JWT, not by an agent key
  if (path.startsWith("/v1/owner/")) {
    if (!(await rate(`owner:${ipHash}`, 60, 60))) return toResponse(fail(429, "rate_limited", "Too many requests."));
    let ob: any = {};
    if (req.method === "POST") { try { const t = await req.text(); ob = t ? JSON.parse(t) : {}; } catch { return toResponse(fail(400, "invalid_json", "Request body must be valid JSON.")); } }
    try { return toResponse(await ownerRoute(req, path, ob)); } catch (e) { console.error("owner error", (e as Error).message); return toResponse(fail(500, "internal_error", "Unexpected server error.")); }
  }

  const auth = await authenticate(req);
  if (auth === "invalid") return toResponse(fail(401, "invalid_api_key", "The API key is unknown, revoked or expired."));
  const key = auth;

  // rate limiting
  const bucket = key ? `key:${key.id}` : `ip:${ipHash}`;
  if (!(await rate(bucket, key ? 300 : 120, 60))) {
    const r = fail(429, "rate_limited", "Too many requests. Back off and retry.");
    r.headers = { "Retry-After": "60" };
    return toResponse(r);
  }
  if (req.method === "POST" && !(await rate(`w:${key ? key.id : ipHash}`, 30, 60))) {
    const r = fail(429, "rate_limited", "Write limit: 30 requests/minute.");
    r.headers = { "Retry-After": "60" };
    return toResponse(r);
  }

  let res: Response;
  try {
    if (path === "/mcp") {
      res = await mcpHandle(req, { key, ipHash });
    } else {
      res = toResponse(await route(req, url, path, key, ipHash));
    }
  } catch (e) {
    console.error("agent-api error", path, (e as Error).message);
    res = toResponse(fail(500, "internal_error", "Unexpected server error."));
  }

  if (req.method === "POST") {
    db.from("agent_events").insert({ agent_key_id: key?.id ?? null, method: req.method, path, status: res.status, ip_hash: ipHash, user_agent: (req.headers.get("user-agent") || "").slice(0, 200), ms: Date.now() - t0 }).then(() => {});
  }
  return res;
});

async function route(req: Request, url: URL, path: string, key: any, ipHash: string): Promise<R> {
  const m = req.method;
  const p = url.searchParams;
  let g: RegExpMatchArray | null;

  if (m === "GET") {
    if (path === "/" || path === "/v1") return indexDoc();
    if (path === "/v1/openapi.json") return { status: 200, body: spec, headers: { "Cache-Control": "public, max-age=3600" } };
    if (path === "/v1/catalog") return catalogList(p);
    if ((g = path.match(/^\/v1\/catalog\/(.+)$/))) return catalogItem(decodeURIComponent(g[1]));
    if (path === "/v1/internal/reconcile") return reconcile(); // pg_cron every minute: auto-detects + settles crypto payments
    if (path === "/v1/donate") return donationInfo();
    if (path === "/v1/search") return search(p);
    if (path === "/v1/news") return newsList(p);
    if ((g = path.match(/^\/v1\/news\/(\d+)$/))) return newsItem(g[1]);
    if ((g = path.match(/^\/v1\/rp\/(servers|factions|jobs|mods)$/))) return rpList(g[1], p);
    if (path === "/v1/agents/me") return need(key) || whoAmI(key);
    if ((g = path.match(/^\/v1\/orders\/([\w]+)\/status$/))) {
      // polling an order also nudges the (globally throttled) reconciler so an agent never waits for the next cron tick
      try { (globalThis as any).EdgeRuntime?.waitUntil(reconcile()); } catch (_) { /* best effort */ }
      return orderStatus(g[1]);
    }
    if ((g = path.match(/^\/v1\/orders\/([\w]+)$/))) return need(key) || getOrder(key, g[1]);
  }

  if (m === "POST") {
    let body: any = {};
    try { const txt = await req.text(); body = txt ? JSON.parse(txt) : {}; } catch { return fail(400, "invalid_json", "Request body must be valid JSON."); }
    if (path === "/v1/agents/register") return registerAgent(body, ipHash);
    if (path === "/v1/quotes") return need(key) || createQuote(key, body);
    if (path === "/v1/orders") return need(key) || createOrder(key, body, req.headers.get("idempotency-key"));
    if (path === "/v1/intents") return need(key) || createIntent(key, body);
    if (path === "/v1/donations") return need(key) || createDonation(key, body, req.headers.get("idempotency-key"));
    if ((g = path.match(/^\/v1\/orders\/([\w]+)\/capture$/))) return captureOrder(g[1]);
    if ((g = path.match(/^\/v1\/orders\/([\w]+)\/payment-proof$/))) return need(key) || submitProof(key, g[1], body);
    if ((g = path.match(/^\/v1\/orders\/([\w]+)\/verify$/))) return need(key) || verifyOrder(key, g[1]);
    if ((g = path.match(/^\/v1\/orders\/([\w]+)\/cancel$/))) return need(key) || cancelOrder(key, g[1]);
  }

  return fail(404, "not_found", `No route for ${m} ${path}`, "GET /v1 lists every endpoint.");
}
