// Vice City Hub — Agent API · quotes, orders, payments, intents, registration
import { API, CRYPTO_WALLETS, db, fail, Key, notifyOwner, ok, R, rate, round2, SITE, sha256Hex } from "./lib.ts";
import { findItem, resolveLine } from "./catalog.ts";
import { dueUnits, EVM_NETWORKS, fmtUnits, type Verdict, verifyCrypto } from "./verify.ts";
import { DONATION, PURPOSE } from "./donate.ts";

const PAYPAL = "https://api-m.paypal.com";
const PF_STORE = 18377240;
// Default ON: a Printful order is submitted for production as soon as the payment is verified (PayPal capture or on-chain).
// Set secret PRINTFUL_AUTO_CONFIRM=0 to create drafts instead, which the operator confirms in the Printful dashboard.
const PF_AUTO = Deno.env.get("PRINTFUL_AUTO_CONFIRM") !== "0";
const PF_STATE = PF_AUTO ? "submitted for fulfillment" : "draft (confirm in Printful dashboard)";
const DEAD = "(cancelled,expired,failed)";

// ───────────── PayPal / Printful plumbing ─────────────
async function ppToken(): Promise<string> {
  const id = Deno.env.get("PAYPAL_CLIENT_ID"), sec = Deno.env.get("PAYPAL_CLIENT_SECRET");
  if (!id || !sec) throw new Error("PayPal credentials are not configured");
  const r = await fetch(`${PAYPAL}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${btoa(`${id}:${sec}`)}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  const d = await r.json();
  if (!r.ok) throw new Error("PayPal auth failed");
  return d.access_token;
}

/** The PayPal shipping block (merch orders only). */
const ppShipping = (s: any) => ({
  name: { full_name: s.name },
  address: { address_line_1: s.address1, address_line_2: s.address2 || undefined, admin_area_2: s.city, admin_area_1: s.state_code || undefined, postal_code: s.zip, country_code: s.country_code },
});

function ppOrderBody(o: any, shipTo: any | null) {
  return {
    intent: "CAPTURE",
    purchase_units: [{
      reference_id: o.public_id,
      custom_id: o.public_id,
      description: `Vice City Hub order ${o.public_id}`,
      amount: { currency_code: "USD", value: Number(o.total_usd).toFixed(2) },
      ...(shipTo ? { shipping: ppShipping(shipTo) } : {}),
    }],
    payment_source: {
      paypal: {
        experience_context: {
          brand_name: "Vice City Hub",
          user_action: "PAY_NOW",
          shipping_preference: shipTo ? "SET_PROVIDED_ADDRESS" : "NO_SHIPPING",
          return_url: `${SITE}/agents.html?order=${o.public_id}&pp=return`,
          cancel_url: `${SITE}/agents.html?order=${o.public_id}&pp=cancel`,
        },
      },
    },
  };
}

async function ppCreate(o: any, hasMerch: boolean) {
  const body = ppOrderBody(o, hasMerch && o.shipping ? o.shipping : null);
  const token = await ppToken();
  const r = await fetch(`${PAYPAL}/v2/checkout/orders`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "PayPal-Request-Id": o.public_id },
    body: JSON.stringify(body),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(`PayPal create failed: ${d?.name || r.status}`);
  const approve = (d.links || []).find((l: any) => l.rel === "payer-action" || l.rel === "approve")?.href;
  return { paypal_order_id: d.id as string, approve_url: approve as string };
}

/** idempotency guard: an order already pushed to Printful (same external_id) is never created twice */
async function printfulFind(publicId: string): Promise<number | null> {
  const t = Deno.env.get("PRINTFUL_API_TOKEN");
  if (!t) return null;
  try {
    const r = await fetch(`https://api.printful.com/orders/@${encodeURIComponent(publicId)}?store_id=${PF_STORE}`, { headers: { Authorization: `Bearer ${t}`, "X-PF-Store-Id": String(PF_STORE) }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    return ((await r.json()).result?.id as number) ?? null;
  } catch { return null; }
}

const pfRecipient = (s: any) => ({ name: s.name, address1: s.address1, address2: s.address2 || undefined, city: s.city, state_code: s.state_code || undefined, country_code: s.country_code, zip: s.zip, email: s.email || undefined, phone: s.phone || undefined });
const pfItems = (o: any) => o.items.filter((i: any) => i.kind === "merch").map((i: any) => ({ sync_variant_id: Number(i.extra?.sync_variant_id), quantity: i.quantity }));

async function printfulDraft(o: any) {
  const items = pfItems(o);
  if (!items.length) return null;
  const t = Deno.env.get("PRINTFUL_API_TOKEN");
  if (!t) throw new Error("PRINTFUL_API_TOKEN missing");
  const existing = await printfulFind(o.public_id);
  if (existing) return existing;
  const r = await fetch(`https://api.printful.com/orders?store_id=${PF_STORE}${PF_AUTO ? "&confirm=1" : ""}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json", "X-PF-Store-Id": String(PF_STORE) },
    body: JSON.stringify({ external_id: o.public_id, shipping: "STANDARD", recipient: pfRecipient(o.shipping), items }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(`Printful: ${d?.error?.message || r.status}`);
  return d.result?.id as number;
}

/** Sends the merch lines to Printful and merges the outcome (order id + state, or the error) into `fulfillment`. Never throws. */
async function tryPrintful(o: any, fulfillment: any): Promise<any> {
  try {
    const pfId = await printfulDraft(o);
    return pfId ? { ...fulfillment, printful_order_id: pfId, printful_state: PF_STATE } : fulfillment;
  } catch (e) { return { ...fulfillment, printful_error: String((e as Error).message) }; }
}

const isMerch = (i: any) => i.kind === "merch";
/** the form in which a tx hash is stored for replay protection (Solana signatures are case-sensitive) */
const claimKey = (chain: string, tx: string) => (chain === "solana" ? tx : tx.toLowerCase());
const OPEN_STATES = ["awaiting_payment", "payment_review"];

// ───────────── Views ─────────────
/** exact on-chain amount (6 decimals) the payer must send for a crypto order */
function dueAmount(o: any): string {
  const a = o.payment?.crypto?.amount_due;
  return typeof a === "string" ? a : Number(o.total_usd).toFixed(6);
}

async function allocateCryptoTag(totalUsd: number): Promise<{ tag: number; amount_due: string }> {
  for (let i = 0; i < 8; i++) {
    const tag = 1 + Math.floor(crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296 * 9999);
    const due = fmtUnits(dueUnits(totalUsd, tag));
    const { data } = await db.from("agent_orders").select("id").eq("status", "awaiting_payment").eq("payment->crypto->>amount_due", due).limit(1);
    if (!data || data.length === 0) return { tag, amount_due: due };
  }
  const tag = 1 + Math.floor(Math.random() * 9999);
  return { tag, amount_due: fmtUnits(dueUnits(totalUsd, tag)) };
}

const cryptoAction = (o: any) => ({
  type: "send_stablecoin",
  amount_due: dueAmount(o),
  exact_amount_required: true,
  auto_detect: true,
  note: "Send EXACTLY amount_due (the last 4 digits are a unique order tag). The transfer is detected and verified automatically; any other amount is never auto-accepted.",
  options: CRYPTO_WALLETS.map((w: any) => (w.chain === "evm" ? { ...w, networks: Object.keys(EVM_NETWORKS) } : w)),
  then: `Nothing else is required: payment is detected automatically (usually 1-5 min, depending on chain confirmations). Optional shortcut: POST ${API}/v1/orders/${o.public_id}/payment-proof {chain, tx_hash, network?}. Poll GET ${API}/v1/orders/${o.public_id}/status until paid/fulfilling.`,
});

function awaitingPaymentAction(o: any) {
  if (o.payment_rail === "paypal") return { type: "approve_paypal", url: o.payment?.approve_url, then: `POST ${API}/v1/orders/${o.public_id}/capture` };
  if (o.payment_rail === "crypto") return cryptoAction(o);
  return { type: "none" };
}

function paymentReviewAction(o: any) {
  if (o.payment?.proof?.verification === "pending_confirmations")
    return { type: "poll_verify", detail: o.payment.proof.detail || null, then: `POST ${API}/v1/orders/${o.public_id}/verify (retry in ~60s)` };
  return { type: "wait", note: "Payment submitted; the operator verifies it manually (usually within 24h)." };
}

const PAID_ACTION = { type: "wait", note: "Paid. Fulfillment in progress; poll the status endpoint." };

function completedAction(o: any) {
  if ((o.items || []).every((i: any) => i.kind === "donation")) return { type: "none", note: "Donation received and verified on-chain. Thank you. The receipt is in fulfillment.receipt." };
  return { type: "none" };
}

/** What the agent should do next, by order status. */
const NEXT_ACTIONS: Record<string, (o: any) => any> = {
  awaiting_payment: awaitingPaymentAction,
  payment_review: paymentReviewAction,
  paid: () => PAID_ACTION,
  fulfilling: () => PAID_ACTION,
  completed: completedAction,
};

function nextAction(o: any) {
  const rule = Object.hasOwn(NEXT_ACTIONS, o.status) ? NEXT_ACTIONS[o.status] : undefined;
  return rule ? rule(o) : { type: "none" };
}

export function view(o: any, full = false) {
  const pay = o.payment_rail === "paypal"
    ? { provider: "paypal", approve_url: o.payment?.approve_url, paypal_order_id: o.payment?.paypal_order_id, capture_id: o.payment?.capture_id }
    : { provider: "crypto", reference: o.public_id, amount_due: dueAmount(o), exact_amount_required: true, options: CRYPTO_WALLETS, proof: o.payment?.proof ? { chain: o.payment.proof.chain, network: o.payment.proof.network, tx_hash: o.payment.proof.tx_hash, verification: o.payment.proof.verification, verified: !!o.payment.proof.verified } : undefined };
  return {
    id: o.public_id,
    status: o.status,
    total_usd: Number(o.total_usd),
    currency: "USD",
    items: (o.items || []).map(({ extra: _e, ...r }: any) => r),
    payment_rail: o.payment_rail,
    payment: pay,
    next_action: nextAction(o),
    expires_at: o.expires_at,
    created_at: o.created_at,
    updated_at: o.updated_at,
    ...(full ? { shipping: o.shipping, delivery: o.delivery, fulfillment: o.fulfillment } : {}),
    links: { self: `${API}/v1/orders/${o.public_id}`, status: `${API}/v1/orders/${o.public_id}/status`, human: `${SITE}/agents.html?order=${o.public_id}` },
  };
}

async function loadOrder(publicId: string) {
  const { data } = await db.from("agent_orders").select("*").eq("public_id", publicId).maybeSingle();
  if (data && data.status === "awaiting_payment" && new Date(data.expires_at) < new Date()) {
    const { data: u } = await db.from("agent_orders").update({ status: "expired", updated_at: new Date().toISOString() }).eq("id", data.id).select("*").single();
    return u || data;
  }
  return data;
}

async function ownOrder(key: Key, publicId: string) {
  const o = await loadOrder(publicId);
  if (!o) return null;
  if (o.agent_key_id === key.id || (key.owner_id && o.owner_id === key.owner_id)) return o;
  return null;
}

// ───────────── Pricing / validation ─────────────
const invalidItems = (msg: string) => ({ error: fail(422, "invalid_items", msg) });

/** Why a SKU could not be resolved; unknown reasons yield undefined, as before. */
const LINE_FAILURES: Record<string, (sku: string) => R> = {
  unknown_sku: (sku) => fail(404, "unknown_sku", `SKU not found: ${sku}`, "List SKUs with GET /v1/catalog."),
  out_of_stock: (sku) => fail(409, "out_of_stock", `Out of stock: ${sku}`),
  use_variant_sku: () => fail(422, "use_variant_sku", "Merch products are ordered by variant.", "Use a `merchv:<id>` SKU from the product's `variants` array."),
  intent_only: (sku) => fail(422, "not_orderable", `${sku} is a peer listing without on-site checkout.`, "Use POST /v1/intents to contact the seller."),
  no_price: (sku) => fail(409, "no_price", `${sku} has no price right now.`),
};

function lineFailure(sku: string, reason: string | undefined): R {
  const key = reason || "unknown_sku";
  return (Object.hasOwn(LINE_FAILURES, key) ? LINE_FAILURES[key] : undefined)?.(sku) as R;
}

/** One raw item as {sku, quantity}, or null when it is malformed. */
function parseItem(it: any): { sku: string; q: number } | null {
  const sku = typeof it?.sku === "string" ? it.sku.trim() : "";
  const q = it?.quantity === undefined ? 1 : Number(it.quantity);
  return sku && Number.isInteger(q) && q >= 1 && q <= 10 ? { sku, q } : null;
}

/** Validates the raw `items` and merges duplicate SKUs; quantities add up. */
function mergeItems(input: any): { merged: Map<string, number> } | { error: R } {
  if (!Array.isArray(input) || input.length < 1 || input.length > 10)
    return invalidItems("`items` must be an array of 1-10 {sku, quantity} objects.");
  const merged = new Map<string, number>();
  for (const it of input) {
    const p = parseItem(it);
    if (!p) return invalidItems("Each item needs a string `sku` and an integer `quantity` between 1 and 10.");
    merged.set(p.sku, (merged.get(p.sku) || 0) + p.q);
  }
  return { merged };
}

/** Key and quantity rules for one resolved line. */
function lineRuleError(key: Key, line: any, qty: number): R | null {
  if (!key.allowed_kinds.includes(line.kind)) return fail(403, "kind_not_allowed", `This API key may not buy '${line.kind}' items.`);
  if ((line.kind === "domain" || line.kind === "plan") && qty !== 1) return fail(422, "invalid_items", `${line.kind} items are quantity 1 only.`);
  return null;
}

async function priceItems(key: Key, input: any) {
  const m = mergeItems(input);
  if ("error" in m) return m;
  const lines: any[] = [];
  let rails: string[] | null = null;
  const requires = new Set<string>();
  let total = 0;
  for (const [sku, qty] of m.merged) {
    const { line, reason } = await resolveLine(sku);
    if (!line) return { error: lineFailure(sku, reason) };
    const bad = lineRuleError(key, line, qty);
    if (bad) return { error: bad };
    rails = rails ? rails.filter((r) => line.rails.includes(r)) : [...line.rails];
    line.requires.forEach((r) => requires.add(r));
    const lineUsd = round2(line.unit_usd * qty);
    total += lineUsd;
    lines.push({ sku, kind: line.kind, title: line.title, quantity: qty, unit_usd: line.unit_usd, line_usd: lineUsd, extra: line.extra });
  }
  total = round2(total);
  if (!rails || rails.length === 0)
    return { error: fail(422, "mixed_rails", "These items cannot be paid in one order (no common payment rail).", "Split into separate orders: domains are crypto-only; merch and store plans accept PayPal or crypto.") };
  const limited = await limitsError(key, total);
  if (limited) return { error: limited };
  return { lines, total, rails, requires: [...requires] };
}

/** per-order and rolling-24h spend mandate of the key (shared by orders and donations) */
async function limitsError(key: Key, total: number): Promise<R | null> {
  if (total > key.max_order_usd)
    return fail(403, "limit_exceeded", `Order total $${total} exceeds this key's per-order limit of $${key.max_order_usd}.`, "A human owner can mint a key with a higher mandate from the Agents page.");
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { data } = await db.from("agent_orders").select("total_usd").eq("agent_key_id", key.id).gte("created_at", since).not("status", "in", DEAD);
  const spent = (data || []).reduce((s: number, o: any) => s + Number(o.total_usd), 0);
  if (spent + total > key.max_daily_usd)
    return fail(403, "daily_limit_exceeded", `24h spend would be $${round2(spent + total)} > limit $${key.max_daily_usd}.`);
  return null;
}

const SHIPPING_FIELDS = ["name", "address1", "city", "zip", "country_code"];
const STATE_REQUIRED_COUNTRIES = ["US", "CA", "AU"];

const isBlank = (v: unknown) => typeof v !== "string" || !v.trim();

/** Rules in order; the first one that fails is the message the buyer sees. */
const SHIPPING_RULES: ((s: any) => string | null)[] = [
  (s) => (!s || typeof s !== "object" ? "shipping is required for merch" : null),
  (s) => { const f = SHIPPING_FIELDS.find((name) => isBlank(s[name])); return f ? `shipping.${f} is required` : null; },
  (s) => (/^[A-Z]{2}$/.test(s.country_code) ? null : "shipping.country_code must be ISO-3166 alpha-2 (e.g. US)"),
  (s) => (STATE_REQUIRED_COUNTRIES.includes(s.country_code) && !s.state_code ? "shipping.state_code is required for US/CA/AU" : null),
];

function validShipping(s: any): string | null {
  for (const rule of SHIPPING_RULES) {
    const problem = rule(s);
    if (problem) return problem;
  }
  return null;
}

// ───────────── Handlers ─────────────
export async function createQuote(key: Key, body: any): Promise<R> {
  if (!key.scopes.includes("quote")) return fail(403, "scope_missing", "This key lacks the 'quote' scope.");
  const p = await priceItems(key, body?.items);
  if (p.error) return p.error;
  const { data, error } = await db.from("agent_quotes").insert({ agent_key_id: key.id, items: p.lines, total_usd: p.total }).select("public_id,expires_at").single();
  if (error) return fail(500, "db_error", "Could not store the quote.");
  return ok({
    quote_id: data.public_id,
    items: p.lines!.map(({ extra: _e, ...r }: any) => r),
    total_usd: p.total,
    currency: "USD",
    payment_rails_available: p.rails,
    requires: p.requires,
    expires_at: data.expires_at,
    next: `POST ${API}/v1/orders with {quote_id, payment_rail, ...required fields} and an Idempotency-Key header`,
  }, 201);
}

// POST /v1/orders is a pipeline. Each stage returns an R (stop here) or its result, as `{ error }` / `{ ... }`.
// The ORDER matters: scope and idempotency first, replay before pricing, price check before payment-rail and field validation,
// the row is written before PayPal is called (so a PayPal failure can mark it failed).
type Failure = { error: R };
const replayed = (o: any) => ok(view(o, true), 200, { "Idempotent-Replayed": "true" });

async function findByIdempotencyKey(key: Key, idem: string) {
  return (await db.from("agent_orders").select("*").eq("agent_key_id", key.id).eq("idempotency_key", idem).maybeSingle()).data;
}

/** The items to price: taken from a still-valid quote when `quote_id` is sent (and then remembered, to catch price drift), else from the body. */
async function orderSource(key: Key, body: any): Promise<{ input: any; quoted: number | null } | Failure> {
  if (!body?.quote_id) return { input: body?.items, quoted: null };
  const { data: q } = await db.from("agent_quotes").select("*").eq("public_id", body.quote_id).eq("agent_key_id", key.id).maybeSingle();
  if (!q || new Date(q.expires_at) < new Date()) return { error: fail(410, "quote_expired", "Quote not found or expired.", "Request a fresh quote.") };
  return { input: q.items.map((l: any) => ({ sku: l.sku, quantity: l.quantity })), quoted: Number(q.total_usd) };
}

function priceDrift(quoted: number | null, total: number): R | null {
  return quoted !== null && Math.abs(quoted - total) > 0.005
    ? fail(409, "price_changed", `Price changed from $${quoted} to $${total}.`, "Request a new quote.")
    : null;
}

// What the buyer must provide per requirement of the items. `fill` writes into the order's shipping / delivery or returns the error.
type Fulfilment = { shipping: any; delivery: any };
const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function readShipping(body: any, f: Fulfilment): R | null {
  const e = validShipping(body?.shipping);
  if (e) return fail(422, "invalid_shipping", e);
  const s = body.shipping;
  f.shipping = { name: s.name, address1: s.address1, address2: s.address2 || null, city: s.city, state_code: s.state_code || null, zip: s.zip, country_code: s.country_code, email: s.email || null, phone: s.phone || null };
  return null;
}

function readWalletAddress(body: any, f: Fulfilment): R | null {
  const w = body?.delivery?.wallet_address;
  if (typeof w !== "string" || !EVM_ADDRESS.test(w)) return fail(422, "invalid_delivery", "delivery.wallet_address must be an EVM address (0x…40 hex) — domains live on Polygon/Ethereum.");
  f.delivery = { wallet_address: w };
  return null;
}

function readStoreDetails(body: any, f: Fulfilment): R | null {
  const d = body?.details;
  if (!d?.store_name || !EMAIL.test(d?.contact_email || "")) return fail(422, "invalid_details", "details.store_name and a valid details.contact_email are required for store plans.");
  f.delivery = { ...(f.delivery || {}), details: { store_name: String(d.store_name).slice(0, 120), contact_email: d.contact_email, website_url: d.website_url || null, discord_url: d.discord_url || null } };
  return null;
}

const REQUIREMENT_READERS: [string, (body: any, f: Fulfilment) => R | null][] = [
  ["shipping", readShipping],
  ["delivery.wallet_address", readWalletAddress],
  ["details.store_name", readStoreDetails],
];

function collectRequirements(requires: string[], body: any): Fulfilment | Failure {
  const f: Fulfilment = { shipping: null, delivery: null };
  for (const [req, read] of REQUIREMENT_READERS) {
    if (!requires.includes(req)) continue;
    const error = read(body, f);
    if (error) return { error };
  }
  return f;
}

/** Writes the order row. A unique-key race with the same Idempotency-Key replays the winner instead of failing. */
async function storeOrder(key: Key, idem: string, p: any, rail: string, f: Fulfilment): Promise<{ order: any } | Failure> {
  const { data: o, error } = await db.from("agent_orders").insert({
    agent_key_id: key.id, owner_id: key.owner_id, idempotency_key: idem, items: p.lines, total_usd: p.total,
    payment_rail: rail, shipping: f.shipping, delivery: f.delivery, payment: rail === "crypto" ? { crypto: await allocateCryptoTag(p.total!) } : {},
  }).select("*").single();
  if (!error) return { order: o };
  const winner = (error as any).code === "23505" ? await findByIdempotencyKey(key, idem) : null;
  return { error: winner ? replayed(winner) : fail(500, "db_error", "Could not create the order.") };
}

/** Creates the PayPal order for a stored row; if PayPal refuses, the row is marked failed. */
async function startPaypal(o: any, lines: any[]): Promise<{ order: any } | Failure> {
  try {
    const pp = await ppCreate(o, lines.some((l: any) => l.kind === "merch"));
    const { data: u } = await db.from("agent_orders").update({ payment: pp, updated_at: new Date().toISOString() }).eq("id", o.id).select("*").single();
    return { order: u || { ...o, payment: pp } };
  } catch (e) {
    await db.from("agent_orders").update({ status: "failed", fulfillment: { error: String((e as Error).message) } }).eq("id", o.id);
    return { error: fail(502, "payment_provider_error", "Could not create the PayPal order.", "Retry with a new Idempotency-Key or use the crypto rail.") };
  }
}

const idempotencyKeyValid = (idem: string | null): idem is string => !!idem && idem.length >= 8 && idem.length <= 128;

/** scope, Idempotency-Key and replay: the answer to send before any work is done, if there is one */
async function orderPreflight(key: Key, idem: string | null): Promise<R | null> {
  if (!key.scopes.includes("order")) return fail(403, "scope_missing", "This key lacks the 'order' scope.");
  if (!idempotencyKeyValid(idem)) return fail(400, "idempotency_key_required", "Send an `Idempotency-Key` header (8-128 chars, unique per purchase attempt).");
  const existing = await findByIdempotencyKey(key, idem);
  return existing ? replayed(existing) : null;
}

type Priced = Awaited<ReturnType<typeof priceItems>>;

/** Items (from the body or a quote), prices, limits and quote drift: the priced order or the first refusal. */
async function priceOrder(key: Key, body: any): Promise<{ p: Priced } | Failure> {
  const source = await orderSource(key, body);
  if ("error" in source) return source;
  const p = await priceItems(key, source.input);
  if (p.error) return { error: p.error };
  const drift = priceDrift(source.quoted, p.total!);
  return drift ? { error: drift } : { p };
}

function railError(rail: any, rails: string[]): R | null {
  if (!rail || !rails.includes(rail)) return fail(422, "invalid_payment_rail", `payment_rail must be one of: ${rails.join(", ")}`);
  return null;
}

/** PayPal orders need a PayPal order created for the stored row; crypto orders are answered as stored. */
async function finishOrder(o: any, rail: string, lines: any[]): Promise<R> {
  if (rail !== "paypal") return ok(view(o, true), 201);
  const paypal = await startPaypal(o, lines);
  return "error" in paypal ? paypal.error : ok(view(paypal.order, true), 201);
}

export async function createOrder(key: Key, body: any, idem: string | null): Promise<R> {
  const early = await orderPreflight(key, idem);
  if (early) return early;
  const priced = await priceOrder(key, body);
  if ("error" in priced) return priced.error;
  const { p } = priced;

  const rail = body?.payment_rail;
  const badRail = railError(rail, p.rails!);
  if (badRail) return badRail;
  const fulfilment = collectRequirements(p.requires!, body);
  if ("error" in fulfilment) return fulfilment.error;

  const stored = await storeOrder(key, idem!, p, rail, fulfilment);
  if ("error" in stored) return stored.error;
  return await finishOrder(stored.order, rail, p.lines!);
}

// ───────────── Donations ─────────────
/** amount_usd rules: finite, within the donation range, at most 2 decimals */
const DONATION_AMOUNT_RULES: ((n: number) => boolean)[] = [
  Number.isFinite,
  (n) => n >= DONATION.min_usd,
  (n) => n <= DONATION.max_usd,
  (n) => Math.abs(n * 100 - Math.round(n * 100)) <= 1e-6,
];

/** scope, 'donation' kind, Idempotency-Key and replay: the answer to send before any work is done, if there is one */
async function donationPreflight(key: Key, idem: string | null): Promise<R | null> {
  if (!key.scopes.includes("order")) return fail(403, "scope_missing", "This key lacks the 'order' scope.");
  if (!key.allowed_kinds.includes("donation")) return fail(403, "kind_not_allowed", "This API key may not donate.", "A human owner can allow the 'donation' kind when minting a key on the Agents page.");
  if (!idempotencyKeyValid(idem)) return fail(400, "idempotency_key_required", "Send an `Idempotency-Key` header (8-128 chars, unique per donation attempt).");
  const existing = await findByIdempotencyKey(key, idem);
  return existing ? replayed(existing) : null;
}

/** The principal's explicit authorisation and a valid amount; returns the rounded total. */
function readDonation(body: any): { total: number } | Failure {
  if (body?.authorized_by_principal !== true)
    return { error: fail(422, "authorization_required", "Set `authorized_by_principal: true` only if the person or organization you act for has explicitly authorized this donation.", "Agents must not donate on their own initiative. GET /v1/donate explains the terms.") };
  const amount = Number(body?.amount_usd);
  if (!DONATION_AMOUNT_RULES.every((rule) => rule(amount)))
    return { error: fail(422, "invalid_amount", `amount_usd must be a number between ${DONATION.min_usd} and ${DONATION.max_usd} with at most 2 decimals.`) };
  return { total: round2(amount) };
}

const trimmed = (v: unknown, n: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null);

function donationLines(total: number, body: any) {
  const donor = { name: trimmed(body?.donor?.name, 120), agent: trimmed(body?.donor?.agent, 120), operator: trimmed(body?.donor?.operator, 120) };
  return [{ sku: DONATION.sku, kind: "donation", title: DONATION.title, quantity: 1, unit_usd: total, line_usd: total, extra: { donor, message: trimmed(body?.message, 500) } }];
}

/** Writes the donation row. A unique-key race with the same Idempotency-Key replays the winner instead of failing. */
async function storeDonation(key: Key, idem: string, lines: any[], total: number): Promise<R> {
  const { data: o, error } = await db.from("agent_orders").insert({
    agent_key_id: key.id, owner_id: key.owner_id, idempotency_key: idem, items: lines, total_usd: total,
    payment_rail: "crypto", shipping: null, delivery: null, payment: { crypto: await allocateCryptoTag(total) },
  }).select("*").single();
  if (!error) return ok({ ...view(o, true), purpose: PURPOSE }, 201);
  const winner = (error as any).code === "23505" ? await findByIdempotencyKey(key, idem) : null;
  return winner ? replayed(winner) : fail(500, "db_error", "Could not create the donation.");
}

/** Voluntary donation for AI development: crypto only, fully automatic detection, receipt on completion. */
export async function createDonation(key: Key, body: any, idem: string | null): Promise<R> {
  const early = await donationPreflight(key, idem);
  if (early) return early;
  const donation = readDonation(body);
  if ("error" in donation) return donation.error;
  const limited = await limitsError(key, donation.total);
  if (limited) return limited;
  return await storeDonation(key, idem!, donationLines(donation.total, body), donation.total);
}

export async function getOrder(key: Key, id: string): Promise<R> {
  const o = await ownOrder(key, id);
  return o ? ok(view(o, true)) : fail(404, "order_not_found", "No such order for this key.");
}

export async function orderStatus(id: string): Promise<R> {
  const o = await loadOrder(id);
  if (!o) return fail(404, "order_not_found", "No such order.");
  return ok({ id: o.public_id, status: o.status, total_usd: Number(o.total_usd), payment_rail: o.payment_rail, updated_at: o.updated_at, expires_at: o.expires_at });
}

const CAPTURED_STATES = ["paid", "fulfilling", "completed", "payment_review"];

/** Why this order cannot be captured (or the settled order to return as is); null when it can. */
function captureRefusal(o: any): R | null {
  if (!o) return fail(404, "order_not_found", "No such order.");
  if (o.payment_rail !== "paypal") return fail(422, "wrong_rail", "Only PayPal orders can be captured.");
  if (CAPTURED_STATES.includes(o.status)) return ok(view(o));
  if (o.status !== "awaiting_payment") return fail(409, "bad_state", `Order is ${o.status}.`);
  return null;
}

async function paypalCapture(o: any): Promise<{ data: any } | Failure> {
  const token = await ppToken();
  const r = await fetch(`${PAYPAL}/v2/checkout/orders/${o.payment.paypal_order_id}/capture`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "PayPal-Request-Id": `cap-${o.public_id}` },
  });
  const d = await r.json();
  if (r.ok) return { data: d };
  const issue = d?.details?.[0]?.issue;
  return { error: issue === "ORDER_NOT_APPROVED"
    ? fail(409, "payment_not_approved", "The payer has not approved this PayPal order yet.", "Open payment.approve_url, approve, then call capture again.")
    : fail(502, "paypal_error", `PayPal capture failed (${issue || r.status}).`) };
}

const firstCapture = (d: any) => d.purchase_units?.[0]?.payments?.captures?.[0];

/** A capture is accepted automatically only if it is COMPLETED, in USD, for the exact total and tagged with this order's id. */
function captureIsClean(o: any, d: any): boolean {
  const cap = firstCapture(d);
  if (!cap || cap.status !== "COMPLETED" || cap.amount?.currency_code !== "USD") return false;
  return Math.abs(Number(cap.amount.value) - Number(o.total_usd)) < 0.005 && d.purchase_units[0].custom_id === o.public_id;
}

const capturedPayment = (o: any, d: any) => ({ ...o.payment, capture_id: firstCapture(d)?.id, payer_email: d.payer?.email_address || null, captured_at: new Date().toISOString() });

async function holdForReview(o: any, payment: any): Promise<R> {
  const { data: u } = await db.from("agent_orders").update({ status: "payment_review", payment, updated_at: new Date().toISOString() }).eq("id", o.id).select("*").single();
  await notifyOwner("VCH order needs manual review", `${o.public_id}: PayPal capture is not a clean COMPLETED/amount match.`);
  return ok(view(u || o));
}

async function fulfilPaypal(o: any, payment: any): Promise<R> {
  const fulfillment = await tryPrintful(o, { ...(o.fulfillment || {}) });
  const { data: u } = await db.from("agent_orders").update({ status: fulfillment.printful_error ? "paid" : "fulfilling", payment, fulfillment, updated_at: new Date().toISOString() }).eq("id", o.id).select("*").single();
  await notifyOwner("VCH agent order PAID", `${o.public_id} — $${o.total_usd}\nItems: ${(o.items || []).map((i: any) => `${i.quantity}× ${i.title}`).join(", ")}\n${fulfillment.printful_error ? "Printful error: " + fulfillment.printful_error : "Fulfilment started."}`);
  return ok(view(u || o));
}

export async function captureOrder(id: string): Promise<R> {
  const o = await loadOrder(id);
  const refused = captureRefusal(o);
  if (refused) return refused;
  const captured = await paypalCapture(o);
  if ("error" in captured) return captured.error;
  const payment = capturedPayment(o, captured.data);
  return captureIsClean(o, captured.data) ? await fulfilPaypal(o, payment) : await holdForReview(o, payment);
}

/** Why this order takes no payment proof; null when it does. */
function proofOrderError(o: any): R | null {
  if (!o) return fail(404, "order_not_found", "No such order for this key.");
  if (o.payment_rail !== "crypto") return fail(422, "wrong_rail", "Payment proof applies to crypto orders only.");
  if (!OPEN_STATES.includes(o.status)) return fail(409, "bad_state", `Order is ${o.status}.`);
  return null;
}

const TX_FORMATS = new Map<string, RegExp>([["tron", /^[0-9a-fA-F]{64}$/], ["evm", /^0x[0-9a-fA-F]{64}$/]]);
const OTHER_TX_FORMAT = /^[1-9A-HJ-NP-Za-km-z]{60,100}$/; // Solana signature (base58)

function evmNetworkError(chain: string, network: string | undefined): R | null {
  if (chain !== "evm" || !network || EVM_NETWORKS[network]) return null;
  return fail(422, "invalid_network", `network must be one of: ${Object.keys(EVM_NETWORKS).join(", ")}`);
}

type ProofInput = { chain: string; tx: string; network: string | undefined; txKey: string };

/** chain, tx hash and (EVM) network of a payment proof, validated. */
function readProofInput(body: any): ProofInput | Failure {
  const chain = String(body?.chain || ""), tx = String(body?.tx_hash || "").trim();
  if (!CRYPTO_WALLETS.some((w: any) => w.chain === chain)) return { error: fail(422, "invalid_chain", `chain must be one of: ${CRYPTO_WALLETS.map((w: any) => w.chain).join(", ")}`) };
  if (!(TX_FORMATS.get(chain) || OTHER_TX_FORMAT).test(tx)) return { error: fail(422, "invalid_tx_hash", "tx_hash format does not match the chain.") };
  const network = body?.network ? String(body.network).toLowerCase() : undefined;
  const badNetwork = evmNetworkError(chain, network);
  return badNetwork ? { error: badNetwork } : { chain, tx, network, txKey: claimKey(chain, tx) };
}

/** replay protection: one tx hash pays for exactly one order (the same order may claim its own hash again) */
async function claimTx(orderId: string, chain: string, txKey: string): Promise<"claimed" | "db_error" | "taken"> {
  const { error } = await db.from("agent_tx_claims").insert({ chain, tx_hash: txKey, order_id: orderId });
  if (!error) return "claimed";
  if ((error as any).code !== "23505") return "db_error";
  const { data: cl } = await db.from("agent_tx_claims").select("order_id").eq("chain", chain).eq("tx_hash", txKey).maybeSingle();
  return cl && cl.order_id === orderId ? "claimed" : "taken";
}

/** explicit opt-out: skip on-chain verification, the operator reviews by hand */
async function manualReview(o: any, proof: any): Promise<R> {
  const reviewed = { ...proof, verification: "manual" };
  const { data: u } = await db.from("agent_orders").update({ status: "payment_review", payment: { ...o.payment, proof: reviewed }, updated_at: new Date().toISOString() }).eq("id", o.id).select("*").single();
  await notifyOwner("VCH crypto payment submitted (manual review)", `${o.public_id} — $${o.total_usd}\nchain=${proof.chain}\ntx=${proof.tx_hash}\nItems: ${(o.items || []).map((i: any) => i.title).join(", ")}\nDelivery: ${JSON.stringify(o.delivery)}`);
  return ok(view(u || o, true));
}

const newProof = (input: ProofInput, body: any): any =>
  ({ chain: input.chain, network: input.network || null, tx_hash: input.tx, note: body?.note ? String(body.note).slice(0, 300) : null, submitted_at: new Date().toISOString() });

export async function submitProof(key: Key, id: string, body: any): Promise<R> {
  const o = await ownOrder(key, id);
  const refused = proofOrderError(o);
  if (refused) return refused;
  const input = readProofInput(body);
  if ("error" in input) return input.error;

  const claim = await claimTx(o.id, input.chain, input.txKey);
  if (claim === "db_error") return fail(500, "db_error", "Could not register the transaction.");
  if (claim === "taken") return fail(409, "tx_already_used", "This transaction hash is already attached to another order.");

  const proof = newProof(input, body);
  return body?.request_manual_review === true ? await manualReview(o, proof) : await runVerification(o, proof);
}

/** Re-check a previously submitted crypto payment (agents call this while confirmations accumulate). */
export async function verifyOrder(key: Key, id: string): Promise<R> {
  const o = await ownOrder(key, id);
  if (!o) return fail(404, "order_not_found", "No such order for this key.");
  if (o.payment_rail !== "crypto") return fail(422, "wrong_rail", "Only crypto orders are verified on-chain.");
  if (["paid", "fulfilling", "completed"].includes(o.status)) return ok(view(o, true));
  const proof = o.payment?.proof;
  if (!proof?.tx_hash) return fail(409, "no_payment_proof", "Submit POST /payment-proof first.");
  if (proof.verification === "manual") return ok(view(o, true));
  if (!["awaiting_payment", "payment_review"].includes(o.status)) return fail(409, "bad_state", `Order is ${o.status}.`);
  return await runVerification(o, proof);
}

async function releaseClaim(o: any, proof: any) {
  await db.from("agent_tx_claims").delete().eq("chain", proof.chain).eq("tx_hash", claimKey(proof.chain, String(proof.tx_hash))).eq("order_id", o.id);
}

type Confirmed = Extract<Verdict, { state: "confirmed" }>;
type Pending = Extract<Verdict, { state: "pending" }>;

/** What the order contains decides how it is fulfilled: merch goes to Printful, domains / store slots are delivered by the operator, donations complete on payment. */
type ItemMix = { hasMerch: boolean; isDonation: boolean; hasManual: boolean };
function itemMix(items: any[]): ItemMix {
  return {
    hasMerch: items.some(isMerch),
    isDonation: items.length > 0 && items.every((i) => i.kind === "donation"),
    hasManual: items.some((i) => i.kind !== "merch" && i.kind !== "donation"),
  };
}

const MANUAL_DELIVERY_NOTE = "Payment verified on-chain automatically. Delivery (domain transfer / slot activation) is done by the operator, usually within 24h.";

function donationReceipt(o: any, v: Confirmed, proof: any, now: string) {
  return {
    receipt: { type: "donation", reference: o.public_id, amount_usd: Number(o.total_usd), currency: "USD", network: v.network, tx_hash: proof.tx_hash, verified_at: now, purpose: PURPOSE },
    note: "Thank you! Your donation was received and verified on-chain. It supports the development of AI projects and the benefit of AI development. No goods or services are provided in return.",
  };
}

function settledStatus(mix: ItemMix, fulfillment: any): string {
  if (mix.isDonation) return "completed";
  return mix.hasMerch && !mix.hasManual && !fulfillment.printful_error ? "fulfilling" : "paid";
}

const printfulLine = (mix: ItemMix, f: any) =>
  mix.hasMerch ? (f.printful_error ? "Printful error: " + f.printful_error : "Printful order created (" + PF_STATE + ").") + " " : "";

async function notifyDonation(o: any, proof: any, v: Confirmed) {
  const dn = (o.items || [])[0]?.extra || {};
  await notifyOwner("VCH DONATION received (auto-verified)", `${o.public_id} — $${o.total_usd}\nnetwork=${v.network}\ntx=${proof.tx_hash}\nDonor: ${JSON.stringify(dn.donor || {})}\nMessage: ${dn.message || "-"}\nAgent key: ${o.agent_key_id}`);
}

async function notifyOrderPaid(o: any, proof: any, v: Confirmed, mix: ItemMix, fulfillment: any) {
  await notifyOwner("VCH crypto order PAID (auto-verified)", `${o.public_id} — $${o.total_usd}\nnetwork=${v.network}\ntx=${proof.tx_hash}\nItems: ${(o.items || []).map((i: any) => `${i.quantity}× ${i.title}`).join(", ")}\nDelivery: ${JSON.stringify(o.delivery)}\n${printfulLine(mix, fulfillment)}${mix.hasManual ? "ACTION: deliver the item." : ""}`);
}

async function notifySettled(o: any, proof: any, v: Confirmed, mix: ItemMix, fulfillment: any) {
  if (mix.isDonation) await notifyDonation(o, proof, v);
  else await notifyOrderPaid(o, proof, v, mix, fulfillment);
}

/** Fulfilment of a settled order: Printful for merch, an operator note for manual delivery, a receipt for donations. */
async function fulfilSettled(o: any, proof: any, v: Confirmed, now: string, mix: ItemMix, fulfillment: any): Promise<any> {
  let f = mix.hasMerch ? await tryPrintful(o, fulfillment) : fulfillment;
  if (mix.hasManual) f = { ...f, note: MANUAL_DELIVERY_NOTE };
  if (mix.isDonation) f = { ...f, ...donationReceipt(o, v, proof, now) };
  return f;
}

/** The payment is verified on-chain: settle the order, start fulfilment, tell the operator. */
async function settleConfirmed(o: any, proof: any, v: Confirmed, now: string): Promise<R> {
  const done = { ...proof, verification: "confirmed", verified: true, network: v.network, verified_at: now, paid_units: v.paid_units, block_time: v.block_time };
  const mix = itemMix(o.items || []);
  const initial: any = { ...(o.fulfillment || {}) };
  // atomic: only ONE concurrent verifier (cron / agent / status poll) may settle and fulfill this order
  const { data: won } = await db.from("agent_orders").update({ status: "paid", payment: { ...o.payment, proof: done }, fulfillment: initial, updated_at: now }).eq("id", o.id).in("status", OPEN_STATES).select("*").maybeSingle();
  if (!won) { const { data: cur } = await db.from("agent_orders").select("*").eq("id", o.id).single(); return ok(view(cur || o, true)); }

  const fulfillment = await fulfilSettled(o, proof, v, now, mix, initial);
  const { data: u } = await db.from("agent_orders").update({ status: settledStatus(mix, fulfillment), fulfillment, updated_at: new Date().toISOString() }).eq("id", o.id).select("*").single();
  await notifySettled(o, proof, v, mix, fulfillment);
  return ok(view(u || o, true));
}

/** Not enough confirmations yet: park the order in payment_review and let the caller poll again. */
async function parkPending(o: any, proof: any, v: Pending, now: string): Promise<R> {
  const pend = { ...proof, verification: "pending_confirmations", detail: v.detail, checked_at: now };
  const { data: u } = await db.from("agent_orders").update({ status: "payment_review", payment: { ...o.payment, proof: pend }, updated_at: now }).eq("id", o.id).select("*").single();
  return ok(view(u || o, true), 202);
}

/** Not accepted: free the hash so it can't be used to grief the real payer, then explain why. */
async function rejectPayment(o: any, proof: any, v: Verdict): Promise<R> {
  await releaseClaim(o, proof);
  if (v.state === "not_found") return fail(409, "tx_not_found", v.detail + ".", "Wait until the transaction is broadcast, then resubmit.");
  if (v.state === "mismatch") return fail(422, "payment_mismatch", v.detail + ".", `Send exactly the order's amount_due, or resubmit with request_manual_review=true / email vicecityhub@proton.me quoting ${o.public_id}.`);
  return fail(503, "verification_unavailable", "On-chain verification is temporarily unavailable.", "Retry in a minute (the order stays open).");
}

async function runVerification(o: any, proof: any): Promise<R> {
  const tag = Number(o.payment?.crypto?.tag || 0);
  const v: Verdict = await verifyCrypto({
    chain: proof.chain,
    tx: proof.tx_hash,
    network: proof.network || undefined,
    due: dueUnits(Number(o.total_usd), tag),
    createdAtMs: new Date(o.created_at).getTime(),
  });
  const now = new Date().toISOString();
  if (v.state === "confirmed") return await settleConfirmed(o, proof, v, now);
  if (v.state === "pending") return await parkPending(o, proof, v, now);
  return await rejectPayment(o, proof, v);
}

/** Auto-settlement entry point: a scanned on-chain transfer matched this order's exact tagged amount. Full verification still runs. */
export async function settleFromScan(o: any, c: { chain: string; network: string; tx: string }): Promise<string> {
  const claim = await claimTx(o.id, c.chain, claimKey(c.chain, c.tx));
  if (claim === "db_error") return "db_error";
  if (claim === "taken") return "claimed_by_other_order";
  const proof = { chain: c.chain, network: c.chain === "evm" ? c.network : null, tx_hash: c.tx, note: "auto-detected on-chain", auto_detected: true, submitted_at: new Date().toISOString() };
  const r = await runVerification(o, proof);
  return `verification -> HTTP ${r.status}`;
}

const MAX_PRINTFUL_ATTEMPTS = 6;

/** Why a paid order is not retried (null: it should be). */
function retrySkipReason(o: any, f: any): string | null {
  if (o.status !== "paid" || f.printful_order_id) return "nothing_to_retry";
  if (!(o.items || []).some(isMerch)) return "nothing_to_retry";
  return Number(f.printful_attempts || 0) >= MAX_PRINTFUL_ATTEMPTS ? "gave_up" : null;
}

/** compare-and-swap on updated_at: only one worker may own this attempt */
async function claimAttempt(o: any, f: any, attempt: number): Promise<boolean> {
  const { data: mine } = await db.from("agent_orders").update({ fulfillment: { ...f, printful_attempts: attempt }, updated_at: new Date().toISOString() }).eq("id", o.id).eq("status", "paid").eq("updated_at", o.updated_at).select("id").maybeSingle();
  return !!mine;
}

/** Stores the outcome of a retry; the 6th failed attempt alerts the operator. */
async function recordRetry(o: any, fulfillment: any, attempt: number): Promise<string> {
  const done = !!fulfillment.printful_order_id && (o.items || []).every(isMerch);
  await db.from("agent_orders").update({ status: done ? "fulfilling" : "paid", fulfillment, updated_at: new Date().toISOString() }).eq("id", o.id);
  if (!fulfillment.printful_order_id && attempt >= MAX_PRINTFUL_ATTEMPTS) await alertStuck(o, fulfillment);
  return done ? "fulfilled" : "retry_failed";
}

const alertStuck = (o: any, fulfillment: any) =>
  notifyOwner("VCH order stuck: Printful fulfillment failed 6x", `${o.public_id} — $${o.total_usd}\n${fulfillment.printful_error || "unknown error"}\nACTION: create the Printful order manually (payment is verified).`);

/** Self-healing fulfillment: a verified-paid merch order that never reached Printful (crash, 5xx, rate limit) is retried by the reconciler. */
export async function retryFulfilment(o: any): Promise<string> {
  const f = o.fulfillment || {};
  const skip = retrySkipReason(o, f);
  if (skip) return skip;
  const attempt = Number(f.printful_attempts || 0) + 1;
  if (!(await claimAttempt(o, f, attempt))) return "claimed_elsewhere";

  const fulfillment = await tryPrintful(o, { ...f, printful_attempts: attempt });
  if (fulfillment.printful_order_id) delete fulfillment.printful_error;
  return await recordRetry(o, fulfillment, attempt);
}

/** Re-run verification for an order whose proof is waiting for confirmations. */
export async function recheckOrder(o: any): Promise<string> {
  const proof = o.payment?.proof;
  if (!proof?.tx_hash || proof.verification !== "pending_confirmations") return "nothing_to_recheck";
  const r = await runVerification(o, proof);
  return `recheck -> HTTP ${r.status}`;
}

export async function cancelOrder(key: Key, id: string): Promise<R> {
  const o = await ownOrder(key, id);
  if (!o) return fail(404, "order_not_found", "No such order for this key.");
  if (o.status !== "awaiting_payment") return fail(409, "bad_state", `Only awaiting_payment orders can be cancelled (this one is ${o.status}).`);
  const { data: u } = await db.from("agent_orders").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", o.id).select("*").single();
  return ok(view(u || o));
}

const INTENT_CONTACT_FIELDS = ["email", "discord", "telegram", "wallet"];

/** Only the known contact fields, only strings, each cut to 200 characters. */
function intentContact(body: any): Record<string, string> {
  const contact: Record<string, string> = {};
  for (const f of INTENT_CONTACT_FIELDS) if (typeof body?.contact?.[f] === "string") contact[f] = body.contact[f].slice(0, 200);
  return contact;
}

/** Tells the buyer how to finish: the seller's link for external listings, the seller's own contact for marketplace servers. */
async function intentHowTo(item: any, sku: string): Promise<string> {
  let how = "Intent recorded. The operator will follow up using the contact details you supplied.";
  if (item.purchase.external_url) how = `Buy directly from the seller: ${item.purchase.external_url}`;
  if (item.kind !== "server") return how;
  const { data: s } = await db.from("server_marketplace").select("seller_contact").eq("id", sku.split(":")[1]).maybeSingle();
  return s?.seller_contact ? `Contact the seller directly: ${s.seller_contact}` : how;
}

export async function createIntent(key: Key, body: any): Promise<R> {
  const sku = typeof body?.sku === "string" ? body.sku.trim() : "";
  const item = sku ? await findItem(sku) : null;
  if (!item) return fail(404, "unknown_sku", "SKU not found.");
  const contact = intentContact(body);
  const message = typeof body?.message === "string" ? body.message.slice(0, 1000) : null;
  const { data, error } = await db.from("agent_intents").insert({ agent_key_id: key.id, sku, message, contact }).select("public_id").single();
  if (error) return fail(500, "db_error", "Could not record the intent.");
  const how = await intentHowTo(item, sku);
  await notifyOwner("VCH purchase intent", `${data.public_id}: ${sku} (${item.title})\n${message || ""}\n${JSON.stringify(contact)}`);
  return ok({ intent_id: data.public_id, sku, status: "recorded", how_to_complete: how, note: "Vice City Hub never holds funds for third-party listings." }, 201);
}

export async function registerAgent(body: any, ipHash: string): Promise<R> {
  if (!(await rate(`reg:${ipHash}`, 5, 86_400))) return fail(429, "rate_limited", "Max 5 registrations per day per IP.");
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 80) : "";
  if (!name) return fail(422, "invalid_name", "`name` (1-80 chars) is required — tell us who you are.");
  const info: Record<string, string> = {};
  for (const f of ["homepage", "contact", "model", "framework", "operator"]) if (typeof body?.[f] === "string") info[f] = body[f].slice(0, 200);
  const raw = "vch_live_" + [...crypto.getRandomValues(new Uint8Array(24))].map((b) => b.toString(16).padStart(2, "0")).join("");
  const { data, error } = await db.from("agent_keys").insert({
    owner_id: null, name, key_prefix: raw.slice(0, 13), key_hash: await sha256Hex(raw),
    scopes: ["read", "quote", "order"], max_order_usd: 100, max_daily_usd: 250, agent_info: info,
  }).select("id").single();
  if (error) return fail(500, "db_error", "Could not create the key.");
  return ok({
    api_key: raw, key_id: data.id, key_prefix: raw.slice(0, 13),
    scopes: ["read", "quote", "order"], limits: { max_order_usd: 100, max_daily_usd: 250 },
    note: "Store this key now — it is shown once. Higher limits (e.g. for domains) require a human owner to mint a key at " + `${SITE}/agents.html`,
    auth: "Authorization: Bearer <api_key>",
  }, 201);
}

export async function whoAmI(key: Key): Promise<R> {
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { data } = await db.from("agent_orders").select("total_usd").eq("agent_key_id", key.id).gte("created_at", since).not("status", "in", DEAD);
  const spent = (data || []).reduce((s: number, o: any) => s + Number(o.total_usd), 0);
  return ok({ key_id: key.id, name: key.name, owner: key.owner_id ? "human-owned" : "self-registered", scopes: key.scopes, allowed_kinds: key.allowed_kinds, limits: { max_order_usd: key.max_order_usd, max_daily_usd: key.max_daily_usd }, spent_24h_usd: round2(spent) });
}
