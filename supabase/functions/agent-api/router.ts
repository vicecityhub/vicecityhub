// Vice City Hub — Agent API v12 · route table
// Pure dispatch: no Deno, no Supabase. The handlers are injected (see index.ts), which keeps this file
// testable from Node (tests/agentRouter.test.mjs). Route order and behaviour are exactly those of the old
// if-chain in index.ts.
import type { R } from "./lib.ts";

type Handler<A extends unknown[] = any[]> = (...args: A) => R | Promise<R>;

/** Everything the router needs from the outside world. */
export interface RouterDeps {
  fail: (status: number, code: string, message: string, hint?: string) => R;
  /** The OpenAPI document served at /v1/openapi.json. */
  spec: unknown;
  /** Fire-and-forget nudge of the (globally throttled) payment reconciler. Must never throw. */
  nudgeReconcile: () => void;
  indexDoc: Handler;
  catalogList: Handler;
  catalogItem: Handler;
  reconcile: Handler;
  donationInfo: Handler;
  x402Donate: Handler;
  search: Handler;
  newsList: Handler;
  newsItem: Handler;
  rpList: Handler;
  whoAmI: Handler;
  orderStatus: Handler;
  getOrder: Handler;
  registerAgent: Handler;
  createQuote: Handler;
  createOrder: Handler;
  createIntent: Handler;
  createDonation: Handler;
  captureOrder: Handler;
  submitProof: Handler;
  verifyOrder: Handler;
  cancelOrder: Handler;
}

/** Per-request data handed to every route. `body` is {} for GET. */
export interface RouteCtx {
  req: Request;
  p: URLSearchParams;
  key: any;
  ipHash: string;
  body: any;
}

interface Route {
  method: "GET" | "POST";
  /** A regular expression; the captured groups are passed to `run`. */
  path: RegExp;
  run: (c: RouteCtx, g: RegExpMatchArray) => R | Promise<R>;
}

const exact = (path: string) => new RegExp(`^${path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);

export function createRouter(d: RouterDeps) {
  const need = (key: any): R | null =>
    key ? null : d.fail(401, "auth_required", "This endpoint needs an API key.", "POST /v1/agents/register to self-issue one, or mint one at the Agents page.");

  /** Run `handler` only when the request carries a valid API key; otherwise answer 401. */
  const keyed = <A extends unknown[]>(c: RouteCtx, handler: (...a: A) => R | Promise<R>, ...args: A) => need(c.key) || handler(...args);

  const routes: Route[] = [
    // ── GET ──
    { method: "GET", path: /^(?:\/|\/v1)$/, run: () => d.indexDoc() },
    { method: "GET", path: exact("/v1/openapi.json"), run: () => ({ status: 200, body: d.spec, headers: { "Cache-Control": "public, max-age=3600" } }) },
    { method: "GET", path: exact("/v1/catalog"), run: (c) => d.catalogList(c.p) },
    { method: "GET", path: /^\/v1\/catalog\/(.+)$/, run: (_c, g) => d.catalogItem(decodeURIComponent(g[1])) },
    // pg_cron every minute: auto-detects + settles crypto payments
    { method: "GET", path: exact("/v1/internal/reconcile"), run: () => d.reconcile() },
    { method: "GET", path: exact("/v1/donate"), run: () => d.donationInfo() },
    { method: "GET", path: exact("/v1/donate/x402"), run: (c) => d.x402Donate(c.req, c.p, {}, c.ipHash) },
    { method: "GET", path: exact("/v1/search"), run: (c) => d.search(c.p) },
    { method: "GET", path: exact("/v1/news"), run: (c) => d.newsList(c.p) },
    { method: "GET", path: /^\/v1\/news\/(\d+)$/, run: (_c, g) => d.newsItem(g[1]) },
    { method: "GET", path: /^\/v1\/rp\/(servers|factions|jobs|mods)$/, run: (c, g) => d.rpList(g[1], c.p) },
    { method: "GET", path: exact("/v1/agents/me"), run: (c) => keyed(c, d.whoAmI, c.key) },
    {
      method: "GET",
      path: /^\/v1\/orders\/([\w]+)\/status$/,
      run: (_c, g) => {
        // polling an order also nudges the reconciler so an agent never waits for the next cron tick
        d.nudgeReconcile();
        return d.orderStatus(g[1]);
      },
    },
    { method: "GET", path: /^\/v1\/orders\/([\w]+)$/, run: (c, g) => keyed(c, d.getOrder, c.key, g[1]) },

    // ── POST ──
    { method: "POST", path: exact("/v1/agents/register"), run: (c) => d.registerAgent(c.body, c.ipHash) },
    { method: "POST", path: exact("/v1/quotes"), run: (c) => keyed(c, d.createQuote, c.key, c.body) },
    { method: "POST", path: exact("/v1/orders"), run: (c) => keyed(c, d.createOrder, c.key, c.body, c.req.headers.get("idempotency-key")) },
    { method: "POST", path: exact("/v1/intents"), run: (c) => keyed(c, d.createIntent, c.key, c.body) },
    { method: "POST", path: exact("/v1/donate/x402"), run: (c) => d.x402Donate(c.req, c.p, c.body, c.ipHash) },
    { method: "POST", path: exact("/v1/donations"), run: (c) => keyed(c, d.createDonation, c.key, c.body, c.req.headers.get("idempotency-key")) },
    { method: "POST", path: /^\/v1\/orders\/([\w]+)\/capture$/, run: (_c, g) => d.captureOrder(g[1]) },
    { method: "POST", path: /^\/v1\/orders\/([\w]+)\/payment-proof$/, run: (c, g) => keyed(c, d.submitProof, c.key, g[1], c.body) },
    { method: "POST", path: /^\/v1\/orders\/([\w]+)\/verify$/, run: (c, g) => keyed(c, d.verifyOrder, c.key, g[1]) },
    { method: "POST", path: /^\/v1\/orders\/([\w]+)\/cancel$/, run: (c, g) => keyed(c, d.cancelOrder, c.key, g[1]) },
  ];

  /** Find the first route of this method whose path matches. */
  function match(method: string, path: string): { route: Route; groups: RegExpMatchArray } | null {
    for (const route of routes) {
      if (route.method !== method) continue;
      const groups = path.match(route.path);
      if (groups) return { route, groups };
    }
    return null;
  }

  return async function route(req: Request, url: URL, path: string, key: any, ipHash: string): Promise<R> {
    const method = req.method;
    let body: any = {};
    if (method === "POST") {
      // the body is parsed (and rejected when it is not JSON) before any route is looked at
      try {
        const txt = await req.text();
        body = txt ? JSON.parse(txt) : {};
      } catch {
        return d.fail(400, "invalid_json", "Request body must be valid JSON.");
      }
    }
    const hit = match(method, path);
    if (hit) return hit.route.run({ req, p: url.searchParams, key, ipHash, body }, hit.groups);
    return d.fail(404, "not_found", `No route for ${method} ${path}`, "GET /v1 lists every endpoint.");
  };
}
