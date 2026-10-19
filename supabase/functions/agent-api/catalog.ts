// Vice City Hub — Agent API · unified catalog (merch + plans + domains + partner products + servers)
import { db, num, parseMeta, round2, SITE } from "./lib.ts";

export type Kind = "merch" | "plan" | "domain" | "product" | "server";

export interface Item {
  sku: string;
  kind: Kind;
  title: string;
  description: string | null;
  price_usd: number | null;
  price_note?: string;
  currency: "USD" | "EUR";
  seller: string;
  availability: "in_stock" | "available" | "out_of_stock" | "unknown";
  purchase: { mode: "order" | "intent"; rails: string[]; requires: string[]; external_url?: string };
  url: string;
  image?: string | null;
  attributes: Record<string, unknown>;
  variants?: any[];
}

const PF_STORE = 18377240;
const TTL_DB = 60_000;
const TTL_PF = 600_000;

// ───────────── Printful (merch) ─────────────
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** null = not configured / permanent error · undefined = transient failure after retries (429/5xx/network) */
async function pf(path: string, deadline = Infinity): Promise<any> {
  const t = Deno.env.get("PRINTFUL_API_TOKEN");
  if (!t) return null;
  for (let i = 0; i < 4; i++) {
    if (Date.now() > deadline) return undefined; // never make an agent wait on Printful retries forever
    try {
      const r = await fetch(`https://api.printful.com${path}`, { headers: { Authorization: `Bearer ${t}` } });
      if (r.ok) return (await r.json()).result;
      if (r.status !== 429 && r.status < 500) return null;
      const ra = Number(r.headers.get("retry-after"));
      await sleep(Number.isFinite(ra) && ra > 0 ? Math.min(ra, 5) * 1000 : 500 * 2 ** i);
    } catch { await sleep(500 * 2 ** i); }
  }
  return undefined;
}

/** run fn over items with at most `n` in flight (Printful throttles bursts) */
async function pool<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]); }
  }));
  return out;
}

interface MerchSnap { at: number; items: Item[]; variants: Map<string, any> }
const SNAP_MAX_AGE = 24 * 3_600_000;
let pfCache: MerchSnap | null = null;
let pfInflight: Promise<MerchSnap> | null = null;

// v12: the merch catalog is a SHARED snapshot in `agent_cache` (edge isolates do not share memory, and every
// uncached request used to fan out ~13 calls to Printful, which then answered 429 and dropped products).
async function readSnap(): Promise<MerchSnap | null> {
  const { data } = await db.from("agent_cache").select("value,updated_at").eq("key", "merch").maybeSingle();
  if (!data?.value?.items) return null;
  // snapshots written before the crypto rail existed still say rails:["paypal"] for merch: normalise on read
  const items = (data.value.items as Item[]).map((i) => (i.kind === "merch" ? { ...i, purchase: { ...i.purchase, rails: ["paypal", "crypto"] } } : i));
  return { at: new Date(data.updated_at).getTime(), items, variants: new Map(data.value.variants || []) };
}
async function saveSnap(s: MerchSnap) {
  await db.from("agent_cache").upsert({ key: "merch", value: { items: s.items, variants: [...s.variants] }, refresh_lock: null, updated_at: new Date().toISOString() });
}
/** atomic: exactly one caller wins the right to refresh a stale snapshot (60s lease); everyone else serves stale */
async function claimRefresh(): Promise<boolean> {
  const now = new Date();
  const { data } = await db.from("agent_cache").update({ refresh_lock: new Date(now.getTime() + 60_000).toISOString() })
    .eq("key", "merch").or(`refresh_lock.is.null,refresh_lock.lt.${now.toISOString()}`).select("key");
  return !!data && data.length > 0;
}
const soon = (s: MerchSnap): MerchSnap => ({ ...s, at: Date.now() - TTL_PF + 30_000 }); // re-check in 30s

export function loadMerch(): Promise<MerchSnap> {
  if (pfCache && Date.now() - pfCache.at < TTL_PF) return Promise.resolve(pfCache);
  if (pfInflight) return pfInflight; // single-flight inside one isolate
  pfInflight = (async () => {
    try {
      const snap = await readSnap();
      if (snap && Date.now() - snap.at < TTL_PF) return (pfCache = snap);
      if (snap && Date.now() - snap.at < SNAP_MAX_AGE && !(await claimRefresh())) return (pfCache = soon(snap));
      const fresh = await fetchMerch();
      if (fresh.complete) {
        const { complete: _c, ...ok } = fresh;
        await saveSnap(ok);
        return (pfCache = ok);
      }
      const { complete: _c, ...partial } = fresh;
      if (snap && snap.items.length >= partial.items.length) return (pfCache = soon(snap));
      return (pfCache = soon(partial));
    } finally { pfInflight = null; }
  })();
  return pfInflight;
}

async function fetchMerch(): Promise<MerchSnap & { complete: boolean }> {
  const deadline = Date.now() + 12_000;
  const items: Item[] = [];
  const variants = new Map<string, any>();
  const rawList = await pf(`/store/products?store_id=${PF_STORE}&limit=100`, deadline);
  const list = rawList || [];
  const details = await pool(list.filter((p: any) => !p.is_ignored), 3, (p: any) => pf(`/store/products/${p.id}?store_id=${PF_STORE}`, deadline));
  // v12: a throttled/failed Printful call must never silently drop products from the catalog
  const complete = rawList !== undefined && details.every((d: any) => d !== undefined);
  for (const d of details) {
    if (!d?.sync_product) continue;
    const sp = d.sync_product;
    const vs = (d.sync_variants || []).filter((v: any) => !v.is_ignored);
    const vlist = vs.map((v: any) => {
      const sku = `merchv:${v.id}`;
      const rec = {
        sku,
        name: v.name,
        size: v.size || null,
        color: v.color || null,
        price_usd: num(v.retail_price),
        availability: v.availability_status === "active" || !v.availability_status ? "in_stock" : "out_of_stock",
      };
      variants.set(sku, { ...rec, product: sp.name, product_id: sp.id, sync_variant_id: v.id });
      return rec;
    });
    const prices = vlist.map((v: any) => v.price_usd).filter((p: any) => p !== null) as number[];
    items.push({
      sku: `merch:${sp.id}`,
      kind: "merch",
      title: sp.name,
      description: "Official Vice City Hub merch, printed on demand by Printful. Order by variant SKU.",
      price_usd: prices.length ? Math.min(...prices) : null,
      price_note: prices.length > 1 ? "from (lowest variant)" : undefined,
      currency: "USD",
      seller: "Vice City Hub",
      availability: vlist.some((v: any) => v.availability === "in_stock") ? "in_stock" : "out_of_stock",
      purchase: { mode: "order", rails: ["paypal", "crypto"], requires: ["shipping"] },
      url: `${SITE}/market.html`,
      image: sp.thumbnail_url || null,
      attributes: { fulfillment: "Printful print-on-demand" },
      variants: vlist,
    });
  }
  return { at: Date.now(), items, variants, complete };
}

// ───────────── Database-backed items ─────────────
let dbCache: { at: number; items: Item[] } | null = null;

export async function loadDbItems(): Promise<Item[]> {
  if (dbCache && Date.now() - dbCache.at < TTL_DB) return dbCache.items;
  const [plans, domains, products, servers] = await Promise.all([
    db.from("store_plans").select("*").order("sort_order"),
    db.from("posts").select("id,title,body,meta,author_name,created_at,is_published").eq("type", "domain"),
    db.from("store_products").select("*, store_tenants(name,website_url,is_active)").order("sort_order"),
    db.from("server_marketplace").select("*").eq("status", "ACTIVE"),
  ]);
  const items: Item[] = [];

  for (const p of plans.data || []) {
    items.push({
      sku: `plan:${p.id}`, kind: "plan", title: `Store slot — ${p.name}`,
      description: `Vice City Hub RP store listing plan. ${p.slot_count} slot(s). ${(p.features || []).join(" · ")}`.trim(),
      price_usd: num(p.price_usd), currency: "USD", seller: "Vice City Hub", availability: "available",
      purchase: { mode: "order", rails: ["paypal", "crypto"], requires: ["details.store_name", "details.contact_email"] },
      url: `${SITE}/rp.html`, attributes: { slots: p.slot_count, features: p.features || [], badge: p.badge_label || null },
    });
  }

  for (const d of domains.data || []) {
    if (d.is_published === false) continue;
    const m = parseMeta(d.meta);
    const price = num(m.price);
    items.push({
      sku: `domain:${d.id}`, kind: "domain", title: d.title,
      description: d.body || `Web3 domain ${d.title}`,
      price_usd: price, price_note: price === null ? "price on request — use an intent" : undefined,
      currency: "USD", seller: d.author_name || "Vice City Hub", availability: "available",
      purchase: price === null
        ? { mode: "intent", rails: [], requires: [] }
        : { mode: "order", rails: ["crypto"], requires: ["delivery.wallet_address"] },
      url: `${SITE}/market.html`,
      attributes: { tld: d.title.includes(".") ? d.title.split(".").pop() : null, blockchain: m.blockchain || null, tag: m.tag || null, listed_at: d.created_at },
    });
  }

  for (const p of products.data || []) {
    if (p.store_tenants && p.store_tenants.is_active === false) continue;
    items.push({
      sku: `product:${p.id}`, kind: "product", title: p.title, description: p.description || null,
      price_usd: num(p.price_usd), price_note: p.price_label || undefined, currency: "USD",
      seller: p.store_tenants?.name || "Partner store", availability: "available",
      purchase: { mode: "intent", rails: [], requires: [], external_url: p.buy_url },
      url: `${SITE}/rp.html`, image: p.preview_url || null,
      attributes: { category: p.category, tags: p.tags || [], frameworks: p.frameworks || [] },
    });
  }

  for (const s of servers.data || []) {
    items.push({
      sku: `server:${s.id}`, kind: "server", title: s.title, description: s.description || null,
      price_usd: null, price_note: s.price_eur !== null && s.price_eur !== undefined ? `${s.price_eur} EUR (seller-quoted)` : s.price_label || undefined,
      currency: "EUR", seller: "Community seller", availability: "available",
      purchase: { mode: "intent", rails: [], requires: [] },
      url: `${SITE}/rp.html`,
      attributes: { price_eur: num(s.price_eur), framework: s.framework, discord_members: s.discord_members, player_slots: s.player_slots, includes: s.includes || [], whitelisted: s.is_wl },
    });
  }

  dbCache = { at: Date.now(), items };
  return items;
}

export async function loadCatalog(): Promise<Item[]> {
  const [a, b] = await Promise.all([loadDbItems(), loadMerch()]);
  return [...b.items, ...a];
}

export async function findItem(sku: string): Promise<Item | null> {
  if (sku.startsWith("merchv:")) {
    const m = await loadMerch();
    const v = m.variants.get(sku);
    return v ? m.items.find((i) => i.sku === `merch:${v.product_id}`) || null : null;
  }
  return (await loadCatalog()).find((i) => i.sku === sku) || null;
}

// ───────────── Orderable line resolution ─────────────
export interface Line {
  sku: string; kind: Kind; title: string; unit_usd: number;
  rails: string[]; requires: string[]; extra?: Record<string, unknown>;
}

export async function resolveLine(sku: string): Promise<{ line?: Line; reason?: string }> {
  if (sku.startsWith("merchv:")) {
    const v = (await loadMerch()).variants.get(sku);
    if (!v) return { reason: "unknown_sku" };
    if (v.availability !== "in_stock") return { reason: "out_of_stock" };
    if (v.price_usd === null) return { reason: "no_price" };
    return { line: { sku, kind: "merch", title: `${v.product} — ${v.name}`, unit_usd: v.price_usd, rails: ["paypal", "crypto"], requires: ["shipping"], extra: { sync_variant_id: v.sync_variant_id } } };
  }
  const item = (await loadDbItems()).find((i) => i.sku === sku);
  if (!item) return { reason: sku.startsWith("merch:") ? "use_variant_sku" : "unknown_sku" };
  if (item.purchase.mode !== "order" || item.price_usd === null) return { reason: "intent_only" };
  return { line: { sku, kind: item.kind, title: item.title, unit_usd: round2(item.price_usd), rails: item.purchase.rails, requires: item.purchase.requires } };
}
