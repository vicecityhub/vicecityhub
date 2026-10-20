// Vice City Hub — Agent API · read-only handlers (catalog, news, RP, search, index)
import { API, db, fail, num, ok, parseMeta, R, SITE } from "./lib.ts";
import { findItem, loadCatalog } from "./catalog.ts";
import { PURPOSE } from "./donate.ts";

const cache = (s = 60) => ({ "Cache-Control": `public, max-age=${s}` });
const lim = (v: string | null, d = 20, m = 50) => Math.min(Math.max(parseInt(v || "") || d, 1), m);
const clean = (q: string) => q.replace(/[,()%*\\]/g, " ").trim().slice(0, 80);

export function indexDoc(): R {
  return ok({
    name: "Vice City Hub Agent API",
    version: "12.0.0",
    description: "Machine interface of the GTA VI fan hub: news, RP servers, a unified catalog (merch, store plans, Web3 domains, partner products) and agent-safe ordering.",
    site: SITE,
    auth: {
      anonymous: "Read endpoints need no key (120 req/min per IP).",
      api_key: "Authorization: Bearer vch_live_… (or X-API-Key). Self-register: POST /v1/agents/register.",
      note: "Humans can mint keys with higher spend mandates (up to $1,000,000/order) at " + `${SITE}/agents.html`,
      owner_console: { mint: `POST ${API}/v1/owner/keys`, list: `GET ${API}/v1/owner/keys`, revoke: `POST ${API}/v1/owner/keys/{id}/revoke`, auth: "Supabase session JWT of the signed-in human" },
    },
    endpoints: {
      catalog: `${API}/v1/catalog`, catalog_item: `${API}/v1/catalog/{sku}`, search: `${API}/v1/search?q=`,
      news: `${API}/v1/news`, rp_servers: `${API}/v1/rp/servers`, rp_factions: `${API}/v1/rp/factions`, rp_jobs: `${API}/v1/rp/jobs`, rp_mods: `${API}/v1/rp/mods`,
      register: `${API}/v1/agents/register`, me: `${API}/v1/agents/me`,
      quotes: `${API}/v1/quotes`, orders: `${API}/v1/orders`, intents: `${API}/v1/intents`,
      verify_payment: `${API}/v1/orders/{id}/verify`,
      donate_info: `${API}/v1/donate`, donations: `${API}/v1/donations`,
    },
    mcp: { url: `${API}/mcp`, transport: "streamable-http (stateless JSON)", auth: "optional Bearer key" },
    machine_readable: { openapi: `${API}/v1/openapi.json`, llms_txt: `${SITE}/llms.txt`, llms_full_txt: `${SITE}/llms-full.txt`, agent_card: `${SITE}/.well-known/agent.json`, mcp_card: `${SITE}/.well-known/mcp.json`, api_catalog: `${SITE}/.well-known/api-catalog`, static_feeds: `${SITE}/data/index.json`, sitemap: `${SITE}/sitemap.xml` },
    payments: {
      paypal: "merch + store plans: returns approve_url (a human payer approves it), then POST /v1/orders/{id}/capture",
      crypto: "merch + domains + store plans, FULLY AUTOMATIC: send EXACTLY next_action.amount_due in USDT/USDC (Base, Polygon, Arbitrum, Optimism, Ethereum, TRON, Solana). The transfer is detected and verified on-chain with no further call (usually 1-5 min): just poll GET /v1/orders/{id}/status. POST /v1/orders/{id}/payment-proof and /verify are optional shortcuts. Merch then goes to Printful automatically; domains and store slots are delivered by the operator.",
      third_party: "partner products and community server sales are intent-only: Vice City Hub does not custody funds for them",
    },
    donations: {
      purpose: PURPOSE,
      voluntary: true,
      info: `GET ${API}/v1/donate`,
      create: `POST ${API}/v1/donations {amount_usd, authorized_by_principal: true, message?, donor?} + Idempotency-Key (crypto, fully automatic, receipt on completion)`,
      rule: "Donate only when the person or organization you act for has explicitly authorized it; never on your own initiative.",
    },
    safety: ["per-key spend limits (human-set mandates)", "mandatory Idempotency-Key on orders", "price-locked quotes (15 min)", "unique per-order crypto amount tag + tx replay protection", "on-chain verification fails closed", "no payment is ever taken without the payer approving it"],
  }, 200, cache(300));
}

export async function catalogList(p: URLSearchParams): Promise<R> {
  let items = await loadCatalog();
  const kind = p.get("kind");
  if (kind) items = items.filter((i) => i.kind === kind);
  const q = p.get("q")?.toLowerCase().trim();
  if (q) items = items.filter((i) => `${i.title} ${i.description || ""} ${i.seller}`.toLowerCase().includes(q));
  const min = num(p.get("min_price")), max = num(p.get("max_price"));
  if (min !== null) items = items.filter((i) => i.price_usd !== null && i.price_usd >= min);
  if (max !== null) items = items.filter((i) => i.price_usd !== null && i.price_usd <= max);
  if (p.get("orderable") === "true") items = items.filter((i) => i.purchase.mode === "order");
  const sort = p.get("sort");
  if (sort === "price_asc") items = [...items].sort((a, b) => (a.price_usd ?? 1e12) - (b.price_usd ?? 1e12));
  if (sort === "price_desc") items = [...items].sort((a, b) => (b.price_usd ?? -1) - (a.price_usd ?? -1));
  const total = items.length;
  const offset = Math.max(parseInt(p.get("cursor") || "0") || 0, 0);
  const limit = lim(p.get("limit"));
  // list view stays light: variants (merch can have 50+) are only returned by GET /v1/catalog/{sku}
  const slim = items.slice(offset, offset + limit).map(({ variants, ...rest }) => (variants ? { ...rest, variants_count: variants.length, variants_hint: `GET ${API}/v1/catalog/${rest.sku} for variant SKUs` } : rest));
  return ok({
    items: slim,
    total,
    next_cursor: offset + limit < total ? String(offset + limit) : null,
    kinds: ["merch", "plan", "domain", "product", "server"],
  }, 200, cache(60));
}

export async function catalogItem(sku: string): Promise<R> {
  const item = await findItem(sku);
  if (!item) return fail(404, "unknown_sku", `No catalog item with SKU ${sku}.`);
  const how = item.purchase.mode === "order"
    ? `POST ${API}/v1/quotes then POST ${API}/v1/orders (rails: ${item.purchase.rails.join(", ")}; requires: ${item.purchase.requires.join(", ") || "nothing extra"}).`
    : `Intent-only: POST ${API}/v1/intents {sku}${item.purchase.external_url ? ` or buy directly at ${item.purchase.external_url}` : ""}.`;
  return ok({ ...item, how_to_buy: how }, 200, cache(60));
}

function shapeNews(n: any, withBody = false) {
  const m = parseMeta(n.meta);
  return {
    id: n.id, title: n.title, summary: n.summary || null, category: n.category || null,
    stars: typeof m.stars === "number" ? m.stars : null, source_name: m.source_name || null, source_url: n.source_url || null,
    featured: !!n.is_featured, published_at: n.created_at, images: Array.isArray(m.images) ? m.images : [],
    url: `${SITE}/news.html?id=${n.id}`,
    ...(withBody ? { body: n.body || null, x_post_text: m.x_post_text || null } : {}),
  };
}

export async function newsList(p: URLSearchParams): Promise<R> {
  let qb = db.from("news").select("id,title,summary,category,source_url,created_at,is_featured,meta").eq("is_published", true).order("created_at", { ascending: false }).limit(lim(p.get("limit")));
  if (p.get("category")) qb = qb.eq("category", p.get("category")!);
  if (p.get("featured") === "true") qb = qb.eq("is_featured", true);
  const q = p.get("q") ? clean(p.get("q")!) : "";
  if (q) qb = qb.or(`title.ilike.%${q}%,summary.ilike.%${q}%`);
  const { data, error } = await qb;
  if (error) return fail(500, "db_error", "Could not load news.");
  return ok({ items: (data || []).map((n) => shapeNews(n)), count: data?.length || 0 }, 200, cache(120));
}

export async function newsItem(id: string): Promise<R> {
  const { data } = await db.from("news").select("*").eq("id", Number(id)).eq("is_published", true).maybeSingle();
  return data ? ok(shapeNews(data, true), 200, cache(300)) : fail(404, "not_found", "No such news item.");
}

const RP_TABLES: Record<string, { table: string; cols: string; order: string; filter?: [string, any] }> = {
  servers: { table: "rp_servers", cols: "id,name,status,online_count,max_players,tags,description,connect_url,discord_url,is_featured,logo_url", order: "sort_order" },
  factions: { table: "faction_slots", cols: "id,server_name,faction_name,faction_type,slots_total,slots_filled,requirements,description,discord_url,is_available,is_lore_friendly", order: "sort_order", filter: ["is_available", true] },
  jobs: { table: "rp_jobs", cols: "id,title,faction,legality,salary_range,description,responsibilities,requirements,difficulty", order: "sort_order" },
  mods: { table: "mods_catalog", cols: "id,title,author,category,description,progress_pct,votes,tags,download_url,is_featured", order: "created_at" },
};

export async function rpList(kind: string, p: URLSearchParams): Promise<R> {
  const spec = RP_TABLES[kind];
  if (!spec) return fail(404, "not_found", "Unknown RP collection.", "Use servers | factions | jobs | mods.");
  let qb = db.from(spec.table).select(spec.cols).order(spec.order, { ascending: spec.order !== "created_at" }).limit(lim(p.get("limit"), 50, 100));
  if (spec.filter) qb = qb.eq(spec.filter[0], spec.filter[1]);
  const { data, error } = await qb;
  if (error) return fail(500, "db_error", "Could not load data.");
  return ok({ items: data, count: data?.length || 0, human_url: `${SITE}/rp.html` }, 200, cache(120));
}

export async function search(p: URLSearchParams): Promise<R> {
  const q = clean(p.get("q") || "");
  if (q.length < 2) return fail(422, "invalid_query", "`q` must be at least 2 characters.");
  const [news, cat, srv] = await Promise.all([
    db.from("news").select("id,title,summary,category,source_url,created_at,is_featured,meta").eq("is_published", true).or(`title.ilike.%${q}%,summary.ilike.%${q}%`).order("created_at", { ascending: false }).limit(5),
    catalogList(new URLSearchParams({ q, limit: "10" })),
    db.from("rp_servers").select("id,name,status,description,connect_url,discord_url").ilike("name", `%${q}%`).limit(5),
  ]);
  return ok({ query: q, news: (news.data || []).map((n) => shapeNews(n)), catalog: (cat.body as any).items, rp_servers: srv.data || [] }, 200, cache(60));
}
