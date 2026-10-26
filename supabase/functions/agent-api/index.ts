// Vice City Hub — Agent API v12 · router
// Public base: https://<project>.supabase.co/functions/v1/agent-api
import { authenticate, CORS, clientIpHash, db, fail, rate, toResponse } from "./lib.ts";
import { catalogItem, catalogList, indexDoc, newsItem, newsList, rpList, search } from "./handlers.ts";
import { donationInfo } from "./donate.ts";
import { x402Donate } from "./x402.ts";
import { cancelOrder, captureOrder, createDonation, createIntent, createOrder, createQuote, getOrder, orderStatus, registerAgent, submitProof, verifyOrder, whoAmI } from "./orders.ts";
import { ownerRoute } from "./owner.ts";
import { mcpHandle } from "./mcp.ts";
import { reconcile } from "./reconcile.ts";
import { createRouter } from "./router.ts";
import spec from "./openapi.json" with { type: "json" };

const route = createRouter({
  fail, spec,
  // polling an order also nudges the (globally throttled) reconciler so an agent never waits for the next cron tick
  nudgeReconcile: () => { try { (globalThis as any).EdgeRuntime?.waitUntil(reconcile()); } catch (_) { /* best effort */ } },
  indexDoc, catalogList, catalogItem, reconcile, donationInfo, x402Donate, search, newsList, newsItem, rpList,
  whoAmI, orderStatus, getOrder, registerAgent, createQuote, createOrder, createIntent, createDonation,
  captureOrder, submitProof, verifyOrder, cancelOrder,
});

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
