// Vice City Hub - premium pay-per-request endpoints for AI agents (x402 v2, USDC on Base or Solana)
//   GET /                 free: catalog of paid products
//   GET /intel/preview    free: what the paid brief looks like (3 headlines, no bodies)
//   GET /intel?hours=72   paid ($0.02): entity-tagged, deduplicated, canonical-linked GTA VI intel brief as one JSON document
// Payment: no PAYMENT-SIGNATURE header -> 402 + PAYMENT-REQUIRED. With a valid signed payment the Coinbase CDP facilitator
// verifies it, the brief is built, then the payment is settled directly to the Hub wallets (no custody here), and the sale is recorded.
// The brief is built BEFORE settlement so a data failure never costs the payer anything.
// Deployed with verify_jwt = false (public endpoint; payment is the authorization).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SB = Deno.env.get("SUPABASE_URL")!;
const db = createClient(SB, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const SITE = "https://vicecityhub.github.io/vicecityhub";
const API = `${SB}/functions/v1/agent-api`;
const FN = `${SB}/functions/v1/agent-premium`;

const PRICE_INTEL = 0.02;
const FAC_HOST = "api.cdp.coinbase.com";
const BASE_NET = "eip155:8453";
const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const SOL_NET = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";
const SOL_USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, payment-signature, x-payment",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Expose-Headers": "PAYMENT-REQUIRED, PAYMENT-RESPONSE",
};
const json = (b: unknown, status = 200, h: Record<string, string> = {}) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json; charset=utf-8", ...h } });

const enc = new TextEncoder();
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const b64u = (u: Uint8Array) => b64(u).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
const jsonB64 = (o: unknown) => b64(enc.encode(JSON.stringify(o)));

const x402Enabled = () => !!(Deno.env.get("CDP_API_KEY_ID") && Deno.env.get("CDP_API_KEY_SECRET"));

// ---------- CDP facilitator auth (EdDSA JWT) ----------
let signKey: CryptoKey | null = null;
async function cdpJwt(method: string, path: string): Promise<string> {
  const id = Deno.env.get("CDP_API_KEY_ID")!;
  if (!signKey) {
    const raw = fromB64(Deno.env.get("CDP_API_KEY_SECRET")!.trim());
    if (raw.length < 32) throw new Error("CDP secret has unexpected length");
    const prefix = Uint8Array.from([0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20]);
    const pkcs8 = new Uint8Array(prefix.length + 32);
    pkcs8.set(prefix); pkcs8.set(raw.slice(0, 32), prefix.length);
    signKey = await crypto.subtle.importKey("pkcs8", pkcs8, { name: "Ed25519" }, false, ["sign"]);
  }
  const now = Math.floor(Date.now() / 1000);
  const nonce = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, "0")).join("");
  const head = b64u(enc.encode(JSON.stringify({ alg: "EdDSA", typ: "JWT", kid: id, nonce })));
  const body = b64u(enc.encode(JSON.stringify({ sub: id, iss: "cdp", aud: ["cdp_service"], nbf: now, exp: now + 120, uri: `${method} ${FAC_HOST}${path}` })));
  const sig = new Uint8Array(await crypto.subtle.sign("Ed25519", signKey, enc.encode(`${head}.${body}`)));
  return `${head}.${body}.${b64u(sig)}`;
}
async function fac(method: "GET" | "POST", sub: string, body?: unknown): Promise<{ status: number; json: any }> {
  const path = `/platform${sub}`;
  const r = await fetch(`https://${FAC_HOST}${path}`, {
    method,
    headers: { Authorization: `Bearer ${await cdpJwt(method, path)}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(sub.endsWith("settle") ? 40_000 : 15_000),
  });
  return { status: r.status, json: await r.json().catch(() => ({})) };
}

// ---------- payTo wallets (read from the live donation document so there is a single source of truth) ----------
let walletCache: { at: number; evm: string | null; sol: string | null } | null = null;
async function wallets() {
  if (walletCache && Date.now() - walletCache.at < 600_000) return walletCache;
  let evm: string | null = null, sol: string | null = null;
  try {
    const r = await fetch(`${API}/v1/donate`, { signal: AbortSignal.timeout(10_000) });
    const j = await r.json();
    const list: any[] = j?.direct_transfer?.wallets || [];
    evm = list.find((w) => w.chain === "evm")?.address ?? null;
    sol = list.find((w) => w.chain === "solana")?.address ?? null;
  } catch (_) { /* keep nulls */ }
  if (evm || sol) walletCache = { at: Date.now(), evm, sol };
  return { at: Date.now(), evm, sol };
}
let feePayerCache: { at: number; v: string | null } | null = null;
async function solanaFeePayer(): Promise<string | null> {
  if (feePayerCache && Date.now() - feePayerCache.at < 600_000) return feePayerCache.v;
  let v: string | null = null;
  try {
    const { status, json: j } = await fac("GET", "/v2/x402/supported");
    if (status === 200) v = (j.kinds || []).find((k: any) => k.network === SOL_NET && k.scheme === "exact")?.extra?.feePayer ?? null;
  } catch (_) { /* Solana option is omitted */ }
  feePayerCache = { at: Date.now(), v };
  return v;
}
async function requirements(priceUsd: number) {
  const amount = String(Math.round(priceUsd * 1_000_000));
  const w = await wallets();
  const out: any[] = [];
  if (w.evm) out.push({ scheme: "exact", network: BASE_NET, amount, asset: BASE_USDC, payTo: w.evm, maxTimeoutSeconds: 60, extra: { name: "USD Coin", version: "2" } });
  const fp = w.sol ? await solanaFeePayer() : null;
  if (w.sol && fp) out.push({ scheme: "exact", network: SOL_NET, amount, asset: SOL_USDC, payTo: w.sol, maxTimeoutSeconds: 60, extra: { feePayer: fp } });
  return out;
}

// ---------- rate limit (same table the Agent API uses) ----------
async function rate(bucket: string, limit: number, windowSec: number): Promise<boolean> {
  const ws = new Date(Math.floor(Date.now() / 1000 / windowSec) * windowSec * 1000).toISOString();
  const { data } = await db.from("agent_rate").select("hits").eq("bucket", bucket).eq("window_start", ws).maybeSingle();
  const hits = (data?.hits ?? 0) + 1;
  if (hits > limit) return false;
  await db.from("agent_rate").upsert({ bucket, window_start: ws, hits }, { onConflict: "bucket,window_start" });
  return true;
}
async function ipHash(req: Request) {
  const d = await crypto.subtle.digest("SHA-256", enc.encode("vch-premium|" + ((req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "?")));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0")).join("").slice(0, 24);
}

// ---------- x402 paywall ----------
async function paywall(req: Request, product: string, priceUsd: number, resourceUrl: string, description: string, produce: () => Promise<unknown>): Promise<Response> {
  if (!x402Enabled()) return json({ error: "x402_unavailable", message: "x402 payments are not configured on this deployment." }, 503);
  const accepts = await requirements(priceUsd);
  if (!accepts.length) return json({ error: "x402_unavailable", message: "No payment option is available right now." }, 503);
  const resource = { url: resourceUrl, description, mimeType: "application/json" };
  const header = req.headers.get("payment-signature") || req.headers.get("x-payment");

  if (!header) {
    const pr = { x402Version: 2, error: "payment required", resource, accepts };
    return json({ ...pr, how: "Sign a payment for one of `accepts` with your wallet and retry this request with the base64 JSON in the PAYMENT-SIGNATURE header.", preview: `${FN}/intel/preview` }, 402, { "PAYMENT-REQUIRED": jsonB64(pr) });
  }

  let payload: any;
  try { payload = JSON.parse(new TextDecoder().decode(fromB64(header.trim()))); } catch { return json({ error: "invalid_payment_header", message: "PAYMENT-SIGNATURE must be base64-encoded JSON." }, 400); }
  if (payload?.x402Version !== 2) return json({ error: "unsupported_x402_version", message: "Only x402 v2 is supported." }, 400);
  if (!(await rate(`premium:${await ipHash(req)}`, 30, 3600))) return json({ error: "rate_limited" }, 429);
  const chosen = accepts.find((a) => a.network === payload?.accepted?.network && a.scheme === payload?.accepted?.scheme);
  if (!chosen) return json({ error: "payment_option_mismatch", offered: accepts.map((a) => a.network) }, 422);

  const call = { x402Version: 2, paymentPayload: payload, paymentRequirements: chosen };
  let v: { status: number; json: any };
  try { v = await fac("POST", "/v2/x402/verify", call); } catch (e) { console.error("verify", (e as Error).message); return json({ error: "facilitator_unreachable", message: "Nothing was charged; retry shortly." }, 502); }
  if (v.status !== 200 || !v.json?.isValid) {
    const reason = String(v.json?.invalidReason || v.json?.errorMessage || `facilitator http ${v.status}`).slice(0, 200);
    return json({ x402Version: 2, error: reason, accepts, hint: "Payment was not valid. Nothing was charged." }, 402, { "PAYMENT-REQUIRED": jsonB64({ x402Version: 2, error: reason, resource, accepts }) });
  }

  let data: unknown;
  try { data = await produce(); } catch (e) { console.error("produce", (e as Error).message); return json({ error: "product_unavailable", message: "The product could not be built. Nothing was charged." }, 503); }

  let s: { status: number; json: any };
  try { s = await fac("POST", "/v2/x402/settle", call); } catch (e) { console.error("settle", (e as Error).message); return json({ error: "settlement_unconfirmed", message: "Settlement did not return. Check the payer wallet before retrying." }, 502); }
  if (s.status !== 200 || !s.json?.success) {
    const reason = String(s.json?.errorReason || s.json?.errorMessage || `facilitator http ${s.status}`).slice(0, 200);
    return json({ x402Version: 2, error: `settlement failed: ${reason}`, accepts }, 402, { "PAYMENT-RESPONSE": jsonB64({ success: false, errorReason: reason, transaction: "", network: chosen.network }) });
  }
  const tx = String(s.json.transaction || "");
  const net = String(s.json.network || chosen.network);
  const payer = s.json.payer ? String(s.json.payer) : null;
  try { await db.from("agent_premium_sales").upsert({ product, network: net, tx_hash: tx, payer, asset: "USDC", amount_usd: priceUsd }, { onConflict: "network,tx_hash", ignoreDuplicates: true }); } catch (e) { console.error("record", (e as Error).message); }
  return json({ receipt: { product, amount_usd: priceUsd, asset: "USDC", network: net, tx_hash: tx, payer }, data }, 200, { "PAYMENT-RESPONSE": jsonB64({ success: true, transaction: tx, network: net, payer }) });
}

// ---------- the product: GTA VI intel brief ----------
// slug() must stay identical to slugify() in scripts/lib/seo.mjs so the canonical URLs match the static pages.
const slug = (t: string) => String(t || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70).replace(/-+$/, "");
const TAGS: [string, RegExp][] = [
  ["jason", /\bjason\b/i], ["lucia", /\blucia\b/i], ["rockstar", /\brockstar\b/i], ["take-two", /take-two|take two|zelnick/i],
  ["trailer", /trailer/i], ["release-date", /release date|november 19|launch day|launch/i], ["pre-orders", /pre-?order/i],
  ["price", /\bprice|\$\d|\bcost/i], ["leak", /\bleak|leaker|leaked/i], ["radio-music", /radio|soundtrack|\bscore\b|station|\bsong|music/i],
  ["leonida-map", /leonida|vice city|\bmap\b/i], ["vehicles", /\bcars?\b|vehicle|\bbike|\bboat|motorcycle/i], ["gta-online", /gta online/i],
  ["platforms", /ps5|playstation|xbox|series x|pc version/i], ["rp-fivem", /\brp\b|fivem|roleplay/i], ["delay", /\bdelay/i], ["physical-edition", /\bdisc|physical|boxed/i],
];
async function brief(hours: number, limit: number, withBodies: boolean) {
  const since = new Date(Date.now() - hours * 3600_000).toISOString();
  const { data, error } = await db.from("news").select("id,title,summary,body,category,source_url,created_at,is_featured,meta").eq("is_published", true).gte("created_at", since).order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  const items = (data || []).map((n: any) => {
    const text = `${n.title} ${n.summary || ""} ${n.body || ""}`;
    const meta = typeof n.meta === "string" ? JSON.parse(n.meta || "{}") : (n.meta || {});
    return {
      id: n.id, title: n.title, summary: n.summary, ...(withBodies ? { body: n.body } : {}),
      category: n.category, heat_stars: Number(meta.stars) || null, featured: !!n.is_featured,
      source_name: meta.source_name || null, source_url: n.source_url || null, published_at: n.created_at,
      url: `${SITE}/n/${n.id}-${slug(n.title)}/`, tags: TAGS.filter(([, re]) => re.test(text)).map(([t]) => t),
    };
  });
  const byCat: Record<string, number> = {}, tagCount: Record<string, number> = {};
  let heat = 0, heated = 0;
  for (const i of items) {
    byCat[i.category || "Other"] = (byCat[i.category || "Other"] || 0) + 1;
    for (const t of i.tags) tagCount[t] = (tagCount[t] || 0) + 1;
    if (i.heat_stars) { heat += i.heat_stars; heated++; }
  }
  return {
    items,
    signals: {
      window_hours: hours, count: items.length, by_category: byCat,
      top_tags: Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([tag, count]) => ({ tag, count })),
      avg_heat_stars: heated ? Math.round((heat / heated) * 10) / 10 : null,
      top_story_id: [...items].sort((a, b) => (b.heat_stars || 0) - (a.heat_stars || 0))[0]?.id ?? null,
    },
  };
}

const CATALOG = {
  name: "Vice City Hub premium (x402)",
  protocol: "x402 v2, USDC on Base or Solana, settled directly to the Hub wallets",
  products: [{
    id: "intel", price_usd: PRICE_INTEL, endpoint: `GET ${FN}/intel?hours=72&limit=30`,
    preview: `${FN}/intel/preview`,
    description: "GTA VI / Rockstar intel brief as ONE JSON document: full item bodies, entity tags, heat stars, per-category counts, top tags, canonical URLs and source links for every item in the window. The underlying news is also available free item by item via the Agent API; you are paying for the pre-assembled, tagged brief.",
    note: "Fan-site reporting, not official Rockstar statements. Verify through source_url.",
  }],
  free: { agent_api: `${API}/v1`, llms_txt: `${SITE}/llms.txt` },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "GET") return json({ error: "method_not_allowed" }, 405);
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/agent-premium/, "").replace(/\/+$/, "") || "/";
  try {
    if (path === "/") return json(CATALOG, 200, { "Cache-Control": "public, max-age=300" });
    if (path === "/intel/preview") {
      const b = await brief(72, 30, false);
      return json({ price_usd: PRICE_INTEL, buy: `${FN}/intel`, signals: b.signals, sample: b.items.slice(0, 3).map((i) => ({ title: i.title, category: i.category, heat_stars: i.heat_stars, tags: i.tags, url: i.url })) }, 200, { "Cache-Control": "public, max-age=120" });
    }
    if (path === "/intel") {
      const hours = Math.min(168, Math.max(1, Number(url.searchParams.get("hours")) || 72));
      const limit = Math.min(40, Math.max(1, Number(url.searchParams.get("limit")) || 30));
      return await paywall(req, "intel", PRICE_INTEL, `${FN}/intel`, "Vice City Hub GTA VI intel brief (JSON)", async () => {
        const b = await brief(hours, limit, true);
        return { generated_at: new Date().toISOString(), source: SITE, disclaimer: CATALOG.products[0].note, ...b };
      });
    }
    return json({ error: "not_found" }, 404);
  } catch (e) {
    console.error("premium", (e as Error).message);
    return json({ error: "internal_error" }, 500);
  }
});
