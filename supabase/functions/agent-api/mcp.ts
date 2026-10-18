// Vice City Hub — Agent API · MCP server (stateless streamable-HTTP / JSON-RPC 2.0)
import { CORS, fail, Key, R, rate } from "./lib.ts";
import { catalogItem, catalogList, newsItem, newsList, rpList, search } from "./handlers.ts";
import { cancelOrder, captureOrder, createIntent, createOrder, createQuote, getOrder, orderStatus, registerAgent, submitProof, verifyOrder, whoAmI } from "./orders.ts";

interface Ctx { key: Key | null; ipHash: string }
interface Tool { name: string; title: string; description: string; inputSchema: any; auth?: boolean; run: (a: any, c: Ctx) => Promise<R> }

const sp = (o: Record<string, unknown>) => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => [k, String(v)]));
const needKey = (): R => fail(401, "auth_required", "This tool needs an API key.", "Call register_agent, then reconnect this MCP server with header `Authorization: Bearer <api_key>`.");
const obj = (properties: any, required: string[] = []) => ({ type: "object", properties, required, additionalProperties: false });

const ITEMS = { type: "array", minItems: 1, maxItems: 10, items: obj({ sku: { type: "string" }, quantity: { type: "integer", minimum: 1, maximum: 10, default: 1 } }, ["sku"]) };

export const TOOLS: Tool[] = [
  { name: "search_catalog", title: "Search catalog", description: "Search merch, store plans, Web3 domains, partner products and servers for sale. Returns SKUs, USD prices and how each can be bought.",
    inputSchema: obj({ q: { type: "string" }, kind: { type: "string", enum: ["merch", "plan", "domain", "product", "server"] }, max_price: { type: "number" }, min_price: { type: "number" }, orderable: { type: "boolean", description: "only items with on-site checkout" }, sort: { type: "string", enum: ["price_asc", "price_desc"] }, limit: { type: "integer", maximum: 50 } }),
    run: (a) => catalogList(sp(a)) },
  { name: "get_item", title: "Get catalog item", description: "Full details for one SKU including variants (merch) and purchase instructions.", inputSchema: obj({ sku: { type: "string" } }, ["sku"]), run: (a) => catalogItem(String(a.sku)) },
  { name: "list_news", title: "GTA VI news", description: "Latest curated GTA VI / Rockstar news from The Wire, newest first.", inputSchema: obj({ q: { type: "string" }, category: { type: "string" }, featured: { type: "boolean" }, limit: { type: "integer", maximum: 50 } }), run: (a) => newsList(sp(a)) },
  { name: "get_news", title: "Get news article", description: "Full article body by numeric id.", inputSchema: obj({ id: { type: "integer" } }, ["id"]), run: (a) => newsItem(String(a.id)) },
  { name: "list_rp", title: "RP Hub data", description: "GTA RP data: servers, open faction slots, jobs, or mods.", inputSchema: obj({ collection: { type: "string", enum: ["servers", "factions", "jobs", "mods"] }, limit: { type: "integer", maximum: 100 } }, ["collection"]), run: (a) => rpList(String(a.collection), sp({ limit: a.limit })) },
  { name: "search_site", title: "Search everything", description: "Cross-search news, catalog and RP servers.", inputSchema: obj({ q: { type: "string", minLength: 2 } }, ["q"]), run: (a) => search(sp(a)) },
  { name: "register_agent", title: "Register this agent", description: "Get a self-service API key (limits: $100/order, $250/day). Shown once.", inputSchema: obj({ name: { type: "string" }, homepage: { type: "string" }, contact: { type: "string" }, model: { type: "string" }, operator: { type: "string" } }, ["name"]), run: (a, c) => registerAgent(a, c.ipHash) },
  { name: "whoami", title: "My key & limits", description: "Scopes, spend limits and 24h spend of the current key.", inputSchema: obj({}), auth: true, run: (_a, c) => whoAmI(c.key!) },
  { name: "create_quote", title: "Create price-locked quote", description: "Validate items and lock the price for 15 minutes. Merch must use variant SKUs (merchv:…).", inputSchema: obj({ items: ITEMS }, ["items"]), auth: true, run: (a, c) => createQuote(c.key!, a) },
  { name: "create_order", title: "Create order", description: "Create an order from a quote or items. PayPal rail returns an approve_url; crypto rail returns stablecoin wallet options. Merch needs `shipping`, domains need `delivery.wallet_address`, store plans need `details`. Safe to retry with the same idempotency_key.",
    inputSchema: obj({ quote_id: { type: "string" }, items: ITEMS, payment_rail: { type: "string", enum: ["paypal", "crypto"] }, idempotency_key: { type: "string", minLength: 8, maxLength: 128 }, shipping: { type: "object" }, delivery: obj({ wallet_address: { type: "string" } }), details: { type: "object" } }, ["payment_rail", "idempotency_key"]),
    auth: true, run: (a, c) => createOrder(c.key!, a, a.idempotency_key || null) },
  { name: "get_order", title: "Get order", description: "Full order incl. next_action.", inputSchema: obj({ order_id: { type: "string" } }, ["order_id"]), auth: true, run: (a, c) => getOrder(c.key!, String(a.order_id)) },
  { name: "get_order_status", title: "Order status", description: "Cheap status poll (no key needed).", inputSchema: obj({ order_id: { type: "string" } }, ["order_id"]), run: (a) => orderStatus(String(a.order_id)) },
  { name: "capture_paypal_order", title: "Capture PayPal payment", description: "Call after the payer approved payment.approve_url. Idempotent.", inputSchema: obj({ order_id: { type: "string" } }, ["order_id"]), run: (a) => captureOrder(String(a.order_id)) },
  { name: "submit_crypto_payment_proof", title: "Submit crypto tx", description: "After sending EXACTLY next_action.amount_due in stablecoins, submit chain (tron|evm|solana), tx_hash and, for evm, network (polygon|ethereum). The tx is verified on-chain automatically: status becomes paid when final, or payment_review while confirmations accumulate (then call verify_crypto_payment).", inputSchema: obj({ order_id: { type: "string" }, chain: { type: "string", enum: ["tron", "evm", "solana"] }, network: { type: "string", enum: ["polygon", "ethereum"] }, tx_hash: { type: "string" }, note: { type: "string" }, request_manual_review: { type: "boolean", description: "skip auto-verification; operator checks by hand" } }, ["order_id", "chain", "tx_hash"]), auth: true, run: (a, c) => submitProof(c.key!, String(a.order_id), a) },
  { name: "verify_crypto_payment", title: "Re-check crypto payment", description: "Re-run on-chain verification for an order whose payment proof is pending confirmations. Idempotent; poll about once a minute.", inputSchema: obj({ order_id: { type: "string" } }, ["order_id"]), auth: true, run: (a, c) => verifyOrder(c.key!, String(a.order_id)) },
  { name: "cancel_order", title: "Cancel unpaid order", description: "Cancel an order that is still awaiting_payment.", inputSchema: obj({ order_id: { type: "string" } }, ["order_id"]), auth: true, run: (a, c) => cancelOrder(c.key!, String(a.order_id)) },
  { name: "create_purchase_intent", title: "Purchase intent", description: "For peer listings without on-site checkout (partner products, community servers, domains without a price). Records interest and returns how to complete the purchase.", inputSchema: obj({ sku: { type: "string" }, message: { type: "string" }, contact: obj({ email: { type: "string" }, discord: { type: "string" }, telegram: { type: "string" }, wallet: { type: "string" } }) }, ["sku"]), auth: true, run: (a, c) => createIntent(c.key!, a) },
];

const INSTRUCTIONS =
  "Vice City Hub is a GTA VI fan hub. Browse freely (search_catalog, list_news, list_rp). To buy: register_agent once, then create_quote → create_order → complete payment (PayPal approve link or stablecoin transfer) → poll get_order_status. Never claim a purchase succeeded until status is paid/fulfilling/completed. Third-party listings are intent-only.";

const rpc = (id: any, result: any) => ({ jsonrpc: "2.0", id, result });
const rpcErr = (id: any, code: number, message: string) => ({ jsonrpc: "2.0", id, error: { code, message } });

async function one(m: any, c: Ctx): Promise<any | null> {
  if (!m || m.jsonrpc !== "2.0" || typeof m.method !== "string") return rpcErr(m?.id ?? null, -32600, "Invalid Request");
  if (m.method.startsWith("notifications/")) return null;
  switch (m.method) {
    case "initialize":
      return rpc(m.id, { protocolVersion: m.params?.protocolVersion || "2025-06-18", capabilities: { tools: { listChanged: false } }, serverInfo: { name: "vice-city-hub", title: "Vice City Hub", version: "12.0.0" }, instructions: INSTRUCTIONS });
    case "ping": return rpc(m.id, {});
    case "tools/list": return rpc(m.id, { tools: TOOLS.map(({ run: _r, auth: _a, ...t }) => t) });
    case "tools/call": {
      const t = TOOLS.find((x) => x.name === m.params?.name);
      if (!t) return rpcErr(m.id, -32602, `Unknown tool: ${m.params?.name}`);
      if (c.key && !(await rate(`mcp:${c.key.id}`, 60, 60))) return rpc(m.id, { isError: true, content: [{ type: "text", text: "rate_limited: 60 tool calls/min" }] });
      const r = t.auth && !c.key ? needKey() : await t.run(m.params?.arguments || {}, c);
      const text = JSON.stringify(r.body);
      return rpc(m.id, { content: [{ type: "text", text }], ...(r.body && typeof r.body === "object" ? { structuredContent: r.body } : {}), isError: r.status >= 400 });
    }
    default: return rpcErr(m.id ?? null, -32601, `Method not found: ${m.method}`);
  }
}

export async function mcpHandle(req: Request, c: Ctx): Promise<Response> {
  const h = { ...CORS, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Use POST with a JSON-RPC 2.0 body. This is a stateless MCP server.", tools: TOOLS.map((t) => t.name) }), { status: 405, headers: { ...h, Allow: "POST, OPTIONS" } });
  let body: any;
  try { body = await req.json(); } catch { return new Response(JSON.stringify(rpcErr(null, -32700, "Parse error")), { status: 400, headers: h }); }
  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map((m) => one(m, c)))).filter((x) => x !== null);
    return out.length ? new Response(JSON.stringify(out), { headers: h }) : new Response(null, { status: 202, headers: CORS });
  }
  const r = await one(body, c);
  return r === null ? new Response(null, { status: 202, headers: CORS }) : new Response(JSON.stringify(r), { headers: h });
}
