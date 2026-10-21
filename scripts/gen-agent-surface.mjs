#!/usr/bin/env node
/**
 * Vice City Hub v12 — Agent Surface generator
 *
 * Builds everything an AI agent needs to discover and use the site, as static files
 * (GitHub Pages has no server code):
 *   public/llms.txt, llms-full.txt          – LLM-readable site guide (llmstxt.org)
 *   public/openapi.json                     – mirror of the live OpenAPI 3.1 spec
 *   public/sitemap.xml                      – replaces the old gen-sitemap.mjs
 *   public/data/*.json                      – static JSON feeds (news, catalog, RP…)
 *   public/.well-known/agent.json           – agent card
 *   public/.well-known/mcp.json (+ /mcp/server-card.json) – MCP server card
 *   public/.well-known/api-catalog          – RFC 9727 linkset
 *   public/.well-known/ai-plugin.json       – legacy plugin manifest (still scanned by many agents)
 *   public/.well-known/security.txt         – RFC 9116
 *
 * Reads only PUBLIC endpoints of the Agent API — no secrets needed.
 * Never fails a build: if the API is unreachable, previous feeds are kept.
 *
 * Usage: node scripts/gen-agent-surface.mjs [--strict]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUB = join(ROOT, 'public');
const STRICT = process.argv.includes('--strict');
const cfg = JSON.parse(readFileSync(join(ROOT, 'site.config.json'), 'utf8'));
const { site: SITE, api: API, version: VERSION } = cfg;
const NOW = new Date();
const ISO = NOW.toISOString();
let degraded = 0;

// ───────────── helpers ─────────────
const one = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const trunc = (s, n) => (one(s).length > n ? one(s).slice(0, n - 1) + '…' : one(s));
const xml = (s) => String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));

function out(rel, content) {
  const p = join(PUB, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, typeof content === 'string' ? content : JSON.stringify(content, null, 2) + '\n', 'utf8');
}
function prev(rel) {
  try { return JSON.parse(readFileSync(join(PUB, rel), 'utf8')); } catch { return null; }
}
async function api(path, init) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 20000);
  try {
    const r = await fetch(API + path, { ...init, signal: ctl.signal, headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'vch-surface-generator/12', ...(init?.headers || {}) } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } catch (e) {
    console.warn(`[surface] ${path} failed: ${e.message}`);
    return null;
  } finally { clearTimeout(t); }
}
async function pool(items, n, fn) {
  const res = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; res[k] = await fn(items[k]); }
  }));
  return res;
}
const feed = (source, items) => ({ generated_at: ISO, source, count: items.length, items });

// ───────────── 1. fetch live data (fallback: previous files) ─────────────
async function loadNews() {
  const list = await api('/v1/news?limit=50');
  if (!list?.items) { degraded++; return prev('data/news.json')?.items || []; }
  const full = await pool(list.items, 5, async (n) => (await api(`/v1/news/${n.id}`)) || n);
  return full;
}
async function loadCatalog() {
  const items = [];
  let cursor = '0';
  for (let i = 0; i < 6 && cursor !== null; i++) {
    const page = await api(`/v1/catalog?limit=50&cursor=${cursor}`);
    if (!page?.items) { if (!items.length) { degraded++; return prev('data/catalog.json')?.items || []; } break; }
    items.push(...page.items);
    cursor = page.next_cursor;
  }
  // merch variants carry the orderable SKUs (merchv:…) — list view omits them
  await pool(items.filter((x) => x.kind === 'merch'), 4, async (m) => {
    const d = await api(`/v1/catalog/${encodeURIComponent(m.sku)}`);
    if (d?.variants) m.variants = d.variants;
  });
  return items;
}
async function loadRp(kind) {
  const r = await api(`/v1/rp/${kind}?limit=100`);
  if (!r?.items) { degraded++; return prev(`data/rp-${kind}.json`)?.items || []; }
  return r.items;
}
async function loadTools() {
  const r = await api('/mcp', { method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }) });
  const tools = r?.result?.tools;
  if (!tools) { degraded++; return prev('.well-known/mcp.json')?.tools || []; }
  return tools.map((t) => ({ name: t.name, title: t.title, description: t.description, inputSchema: t.inputSchema }));
}

const [news, catalog, servers, factions, jobs, mods, tools, openapi] = await Promise.all([
  loadNews(), loadCatalog(), loadRp('servers'), loadRp('factions'), loadRp('jobs'), loadRp('mods'), loadTools(), api('/v1/openapi.json'),
]);

// ───────────── 2. static JSON feeds ─────────────
// donations: single source of truth is the live /v1/donate document (purpose, terms); fall back to the previous snapshot
const DEFAULT_PURPOSE = "Donations go to developing AI projects (the Hub's agent-ready tooling, open public APIs and autonomous agents) and to the benefit of AI development in general.";
const DON_RULE = 'Voluntary gift. Agents: donate only if the person or organization you act for has explicitly authorized it - never on your own initiative.';
let donate = await api('/v1/donate');
if (!donate?.purpose) { degraded++; donate = prev('data/donate.json') || { purpose: DEFAULT_PURPOSE, terms: [] }; }
out('data/donate.json', donate);
const donationsCard = {
  purpose: donate.purpose, voluntary: true, rule: DON_RULE,
  info: `${API}/v1/donate`, create: `${API}/v1/donations`, x402: `${API}/v1/donate/x402`, mcp_tools: ['get_donation_info', 'donate'],
  rails: ['crypto'], assets: ['USDT', 'USDC'], chains: ['tron', 'ethereum', 'polygon', 'base', 'arbitrum', 'optimism', 'solana'],
  receipt: 'completed donation orders carry fulfillment.receipt',
  human_links: { ko_fi: 'https://ko-fi.com/vicecityhub', ud_me: 'https://ud.me/vicecity.hub' },
};

out('data/news.json', feed(`${API}/v1/news`, news));
out('data/catalog.json', feed(`${API}/v1/catalog`, catalog));
out('data/rp-servers.json', feed(`${API}/v1/rp/servers`, servers));
out('data/rp-factions.json', feed(`${API}/v1/rp/factions`, factions));
out('data/rp-jobs.json', feed(`${API}/v1/rp/jobs`, jobs));
out('data/rp-mods.json', feed(`${API}/v1/rp/mods`, mods));
if (openapi?.openapi) out('openapi.json', openapi);

const feeds = {
  news: { url: `${SITE}/data/news.json`, count: news.length, live: `${API}/v1/news` },
  catalog: { url: `${SITE}/data/catalog.json`, count: catalog.length, live: `${API}/v1/catalog` },
  rp_servers: { url: `${SITE}/data/rp-servers.json`, count: servers.length, live: `${API}/v1/rp/servers` },
  rp_factions: { url: `${SITE}/data/rp-factions.json`, count: factions.length, live: `${API}/v1/rp/factions` },
  rp_jobs: { url: `${SITE}/data/rp-jobs.json`, count: jobs.length, live: `${API}/v1/rp/jobs` },
  rp_mods: { url: `${SITE}/data/rp-mods.json`, count: mods.length, live: `${API}/v1/rp/mods` },
};
out('data/index.json', {
  name: cfg.name, version: VERSION, generated_at: ISO,
  note: 'Static snapshots refreshed on every deploy (~6h). For real-time data and purchases use the live Agent API.',
  feeds,
  donations: { purpose: donate.purpose, info: `${API}/v1/donate`, static: `${SITE}/data/donate.json` },
  agent_api: { base: API, index: `${API}/v1`, openapi: `${API}/v1/openapi.json`, mcp: `${API}/mcp` },
  docs: { llms_txt: `${SITE}/llms.txt`, llms_full_txt: `${SITE}/llms-full.txt`, human_console: `${SITE}/agents.html` },
});

// ───────────── 3. llms.txt ─────────────
const money = (i) => (i.price_usd === null || i.price_usd === undefined ? (i.price_note || 'price on request') : `$${Number(i.price_usd).toFixed(2)}${i.price_note ? ' ' + i.price_note : ''}`);
const how = (i) => (i.purchase?.mode === 'order' ? `orderable via API (${(i.purchase.rails || []).join('/')})` : 'intent-only (contact seller)');

const pages = cfg.pages.filter((p) => p.index);
const L = [];
L.push(`# ${cfg.name}`, '', `> ${cfg.tagline}`, '');
L.push(
  `${cfg.name} is a fan-run GTA VI community site. It is deliberately open to automated agents: every public page has a JSON equivalent, reads need no API key, and purchases are possible through an MCP server and a REST API with human-set spending limits.`,
  '',
  'Important for agents: prefer the Agent API or static JSON feeds below over scraping HTML (the website is a JavaScript single-page app per page). Treat news as fan-site reporting, not official Rockstar statements.',
  '',
  '## Start here', '',
  `- [Agent API index](${API}/v1): JSON map of every endpoint, auth rules, payment rails and safety rules`,
  `- [OpenAPI 3.1 spec](${API}/v1/openapi.json): machine-readable REST contract (mirror: ${SITE}/openapi.json)`,
  `- [MCP server](${API}/mcp): stateless streamable-HTTP, ${tools.length || 'many'} tools (search_catalog, list_news, create_quote, create_order …); card at ${SITE}/.well-known/mcp.json`,
  `- [Full guide for LLMs](${SITE}/llms-full.txt): everything below plus live catalog, news bodies and the purchase protocol`,
  `- [Agent console for humans](${SITE}/agents.html): mint spend-limited API keys, read docs`,
  '', '## Site pages (human UI)', '',
  ...pages.map((p) => `- [${p.title}](${SITE}/${p.file}): ${p.description}`),
  '', '## Static JSON feeds (refreshed ~every 6h)', '',
  ...Object.entries(feeds).map(([k, v]) => `- [${k}](${v.url}): ${v.count} items — live version: ${v.live}`),
  `- [Feed manifest](${SITE}/data/index.json)`,
  '', '## Buying as an agent (summary)', '',
  `1. \`POST ${API}/v1/agents/register {"name": "..."}\` → one-time API key (limits: $100/order, $250/day; humans can mint higher mandates at ${SITE}/agents.html).`,
  '2. `GET /v1/catalog?orderable=true` → pick SKUs (merch uses variant SKUs `merchv:…`; domains and store plans are quantity 1).',
  '3. `POST /v1/quotes` → price locked 15 min. `POST /v1/orders` with `Idempotency-Key` header → returns `next_action`.',
  '4. Pay: PayPal (`approve_url`, human approves, then `POST /v1/orders/{id}/capture`) or stablecoin transfer of EXACTLY `amount_due` (detected on-chain automatically, no further call needed; `POST /v1/orders/{id}/payment-proof` is an optional shortcut). Poll `GET /v1/orders/{id}/status` until `paid`.',
  '5. Peer listings (partner products, community servers) are intent-only: `POST /v1/intents`. Never state a purchase succeeded before status is `paid`/`fulfilling`/`completed`.',
  '', '## Support the project (donations for AI development)', '',
  donate.purpose,
  DON_RULE,
  `- [Donation info (JSON)](${API}/v1/donate): purpose, terms, limits, wallets, received totals`,
`- x402 (no API key): \`GET ${API}/v1/donate/x402?amount_usd=5\` answers HTTP 402 with a PAYMENT-REQUIRED header; pay USDC on Base or Solana and retry with PAYMENT-SIGNATURE (x402 v2). Signing the payment is your wallet's authorization.`,
  `- Donate as an agent: \`POST ${API}/v1/donations {amount_usd, authorized_by_principal: true}\` with an \`Idempotency-Key\` (crypto, detected automatically, receipt on completion) or MCP tool \`donate\`. Humans: https://ko-fi.com/vicecityhub or https://ud.me/vicecity.hub`,
  '', '## Optional', '',
  `- [Agent card](${SITE}/.well-known/agent.json)`,
  `- [API catalog (RFC 9727)](${SITE}/.well-known/api-catalog)`,
  `- [Sitemap](${SITE}/sitemap.xml)`,
  `- Contact: ${cfg.contact}`, '',
);
out('llms.txt', L.join('\n'));

// ───────────── 4. llms-full.txt ─────────────
const F = [];
F.push(`# ${cfg.name} — full guide for AI agents (v${VERSION})`, '', `Generated ${ISO}. Live data beats this snapshot: call the API for anything time-sensitive.`, '');
F.push('## What this site is', '', cfg.tagline, '', ...pages.map((p) => `- ${p.title} — ${SITE}/${p.file} — ${p.description}`), '');
F.push(
  '## Access', '',
  `- Base URL: ${API}`, `- Index: GET ${API}/v1`, `- OpenAPI: GET ${API}/v1/openapi.json`, `- MCP: POST ${API}/mcp (JSON-RPC 2.0, optional \`Authorization: Bearer vch_live_…\`)`,
  '- Reads: no key, 120 requests/min per IP. With a key: 300/min. Writes: 30/min.',
  '- Auth: `Authorization: Bearer vch_live_<48 hex>` or `X-API-Key`. Self-register with POST /v1/agents/register (key shown once).',
  '- Errors are JSON: `{error:{code,message,hint,docs,openapi}}`. Honor `Retry-After` on 429.', '',
  '## Quick examples', '', '```bash',
  `curl ${API}/v1/news?limit=5`,
  `curl "${API}/v1/catalog?kind=domain&orderable=true"`,
  `curl -X POST ${API}/v1/agents/register -H 'content-type: application/json' -d '{"name":"my-agent","operator":"me@example.com"}'`,
  '```', '',
  '## Purchase protocol (agent-safe)', '',
  '1. Register once (or have your human mint a key with a custom mandate on the Agent Console).',
  '2. `POST /v1/quotes {items:[{sku,quantity}]}` → `quote_id`, `total_usd`, `payment_rails_available`, `requires`. Quote is valid 15 minutes.',
  '3. `POST /v1/orders {quote_id, payment_rail, shipping|delivery|details}` + header `Idempotency-Key: <8-128 chars>`. Retrying with the same key returns the same order (`Idempotent-Replayed: true`).',
  '4. Follow `next_action` in the response:',
  '   - `approve_paypal`: a human payer must open `url` and approve; then `POST /v1/orders/{id}/capture`.',
  '   - `send_stablecoin`: send EXACTLY `amount_due` (last 4 digits are a unique order tag) in USDT/USDC on the listed chain/address (Base, Polygon, Arbitrum, Optimism, Ethereum, Tron, Solana), and you are done: the transfer is detected and verified on-chain automatically (usually 1-5 min), no further call needed. Optional shortcuts: `POST /v1/orders/{id}/payment-proof {chain, tx_hash, network?}` and `POST /v1/orders/{id}/verify`.',
  '5. Poll `GET /v1/orders/{id}/status` (no key needed). Merch paid in crypto is sent to Printful automatically; domains and store slots are delivered by the operator after payment.',
  '',
  'Safety rules enforced server-side: per-key per-order and daily spend limits, allowed item kinds per key, mandatory idempotency keys, price-locked quotes, unique crypto amount tags with tx-hash replay protection, on-chain verification that fails closed. The operator never takes payment without the payer approving it.',
  'Rails: merch → PayPal or crypto (Printful print-on-demand, needs `shipping`); Web3 domains → crypto only (needs `delivery.wallet_address`); store plans → PayPal or crypto (needs `details.store_name`, `details.contact_email`). Mixed-rail baskets are rejected — split orders.',
  'Intent-only items (partner products, community-sold RP servers, unpriced domains): `POST /v1/intents {sku, message?, contact?}`. Vice City Hub never custodies funds for them.', '',
);
F.push('## Support the project (donations for AI development)', '', donate.purpose, '', DON_RULE, '', ...(donate.terms || []).map((t) => `- ${t}`), '',
  `Endpoint: \`POST ${API}/v1/donations\` body \`{"amount_usd": 5, "authorized_by_principal": true, "message": "optional", "donor": {"agent": "optional"}}\` + header \`Idempotency-Key\`. Crypto only: send EXACTLY \`next_action.amount_due\` in USDT/USDC; the transfer is detected and verified automatically and the order becomes \`completed\` with \`fulfillment.receipt\`. Limits: ${donate.how_to_donate?.limits || "the key spend limits apply"}. Info (no key): \`GET ${API}/v1/donate\`. MCP tools: \`get_donation_info\`, \`donate\`.`, '');
F.push(`## MCP tools (${tools.length})`, '', ...tools.map((t) => `- \`${t.name}\` — ${trunc(t.description, 220)}`), '');
F.push(`## Catalog snapshot (${catalog.length} items)`, '', '| SKU | Kind | Title | Price | Purchase |', '|---|---|---|---|---|');
for (const i of catalog) F.push(`| \`${i.sku}\` | ${i.kind} | ${trunc(i.title, 70).replace(/\|/g, '/')} | ${money(i).replace(/\|/g, '/')} | ${how(i)} |`);
F.push('');
for (const m of catalog.filter((i) => i.kind === 'merch' && i.variants?.length)) {
  F.push(`### Variants of ${m.title} (${m.sku})`, '', ...m.variants.map((v) => `- \`${v.sku}\` ${[v.size, v.color].filter(Boolean).join(' / ') || v.name} — ${v.price_usd !== null ? '$' + Number(v.price_usd).toFixed(2) : 'n/a'} — ${v.availability}`), '');
}
F.push(`## RP servers (${servers.length})`, '', ...servers.map((s) => `- **${s.name}** [${s.status || 'n/a'}] ${s.online_count ?? '?'}/${s.max_players ?? '?'} players — ${trunc(s.description, 160)}${s.connect_url ? ' — connect: ' + s.connect_url : ''}`), '');
F.push(`## Latest news (${news.length})`, '');
for (const n of news) {
  F.push(`### ${one(n.title)}`, `- Category: ${n.category || 'n/a'} · Stars: ${n.stars ?? 'n/a'}/5 · Published: ${n.published_at || 'n/a'}`, `- Page: ${n.url || SITE + '/news.html?id=' + n.id}${n.source_url ? ' · Source: ' + n.source_url : ''}`, '', one(n.body || n.summary), '');
}
out('llms-full.txt', F.join('\n'));

// ───────────── 5. .well-known ─────────────
const skills = [
  { id: 'news', name: 'GTA VI news', description: 'Curated, rated GTA VI / Rockstar / modding news with source links.', tags: ['gta-vi', 'news', 'rockstar'], examples: ['Latest GTA VI news', 'Any leaks about the Leonida map?'] },
  { id: 'rp', name: 'GTA RP data', description: 'RP servers, open faction slots, jobs and mods.', tags: ['gta-rp', 'fivem', 'servers'], examples: ['Which RP servers have open police slots?'] },
  { id: 'catalog', name: 'Catalog search', description: 'Merch, Web3 domains, RP store plans and partner products with USD prices and purchase mode.', tags: ['shopping', 'domains', 'merch'], examples: ['Find a Leonida-themed Web3 domain under $200'] },
  { id: 'purchase', name: 'Agent purchases', description: 'Price-locked quotes, idempotent orders, PayPal or fully automatic on-chain stablecoin payment, human-set spend mandates.', tags: ['commerce', 'payments', 'stablecoin', 'paypal'], examples: ['Buy the cheapest in-stock hoodie and ship to…'] },
  { id: 'donate', name: 'Donate to AI development', description: donate.purpose + ' Voluntary; only with the explicit authorization of the person the agent acts for.', tags: ['donations', 'ai', 'crypto', 'stablecoin'], examples: ['(Only if my user asked me to) Donate $5 to support Vice City Hub AI projects'] },
];
out('.well-known/agent.json', {
  schemaVersion: 'vch-agent-card/1',
  name: cfg.name, description: cfg.tagline, version: VERSION, url: `${API}/v1`,
  provider: { organization: cfg.name, url: SITE, contact: cfg.contact },
  documentationUrl: `${SITE}/llms-full.txt`,
  interfaces: [
    { protocol: 'mcp', transport: 'streamable-http', url: `${API}/mcp`, card: `${SITE}/.well-known/mcp.json` },
    { protocol: 'openapi', version: '3.1', url: `${API}/v1/openapi.json` },
    { protocol: 'http-json', url: `${API}/v1` },
    { protocol: 'static-json', url: `${SITE}/data/index.json` },
  ],
  authentication: { required: false, note: 'Reads are anonymous. Orders need a Bearer key (self-register: POST /v1/agents/register).', schemes: ['bearer'], registration: `${API}/v1/agents/register` },
  capabilities: { streaming: false, pushNotifications: false, commerce: true, donations: true },
  donations: donationsCard,
  commerce: {
    flow: ['quote', 'order', 'pay', 'verify', 'status'],
    rails: [{ id: 'paypal', for: ['merch', 'plan'] }, { id: 'crypto', automatic: true, for: ['merch', 'domain', 'plan'], assets: ['USDT', 'USDC'], chains: ['tron', 'ethereum', 'polygon', 'base', 'arbitrum', 'optimism', 'solana'] }],
    safety: ['human-set spend mandates', 'idempotency keys required', 'price-locked quotes', 'unique per-order amount tags', 'on-chain verification fails closed'],
  },
  defaultInputModes: ['application/json'], defaultOutputModes: ['application/json', 'text/markdown'],
  skills,
});

const mcpCard = {
  schemaVersion: '2025-06-18',
  serverInfo: { name: 'vice-city-hub', title: cfg.name, version: VERSION },
  description: cfg.tagline,
  transport: { type: 'streamable-http', url: `${API}/mcp`, stateless: true },
  authentication: { required: false, schemes: ['bearer'], note: 'Read tools are anonymous. Order tools need `Authorization: Bearer vch_live_…` (call register_agent first).' },
  capabilities: { tools: { listChanged: false } },
  instructions: 'Browse freely (search_catalog, list_news, list_rp). To buy: register_agent once, then create_quote → create_order → pay → poll get_order_status. Never claim a purchase succeeded until status is paid/fulfilling/completed.',
  documentation: `${SITE}/llms-full.txt`,
  donations: donationsCard,
  tools: tools.map((t) => ({ name: t.name, title: t.title, description: t.description })),
};
out('.well-known/mcp.json', mcpCard);
out('.well-known/mcp/server-card.json', mcpCard);

out('.well-known/api-catalog', {
  linkset: [
    { anchor: `${API}/v1`, 'service-desc': [{ href: `${API}/v1/openapi.json`, type: 'application/openapi+json' }], 'service-doc': [{ href: `${SITE}/llms-full.txt`, type: 'text/plain' }, { href: `${SITE}/agents.html`, type: 'text/html' }] },
    { anchor: `${API}/mcp`, 'service-desc': [{ href: `${SITE}/.well-known/mcp.json`, type: 'application/json' }], 'service-doc': [{ href: `${SITE}/llms.txt`, type: 'text/plain' }] },
    { anchor: `${SITE}/data/index.json`, 'service-doc': [{ href: `${SITE}/llms.txt`, type: 'text/plain' }] },
  ],
});

out('.well-known/ai-plugin.json', {
  schema_version: 'v1',
  name_for_human: cfg.name, name_for_model: 'vice_city_hub',
  description_for_human: 'GTA VI news, GTA RP servers, Web3 domains and merch.',
  description_for_model: 'Search GTA VI news, GTA RP servers/factions/jobs/mods and a catalog of merch, Web3 domains, store plans and partner listings. Can create price-locked quotes and orders (PayPal or stablecoin) for orderable SKUs within the key spend limits. Voluntary donations for AI development (GET /v1/donate) are possible only with explicit authorization from the person the agent acts for.',
  auth: { type: 'none' },
  api: { type: 'openapi', url: `${API}/v1/openapi.json` },
  logo_url: cfg.logo, contact_email: cfg.contact, legal_info_url: `${SITE}/agents.html`,
});

const exp = new Date(NOW.getTime() + 365 * 86400000).toISOString();
out('.well-known/security.txt', `Contact: mailto:${cfg.contact}\nExpires: ${exp}\nPreferred-Languages: en, ru\nCanonical: ${SITE}/.well-known/security.txt\n`);
out('.nojekyll', '');

// ───────────── 6. sitemap.xml ─────────────
const day = (d) => String(d || ISO).slice(0, 10);
const urls = [];
for (const p of pages) urls.push({ loc: `${SITE}/${p.file}`, lastmod: day(), freq: p.freq, prio: p.priority });
urls.push({ loc: `${SITE}/llms.txt`, lastmod: day(), freq: 'daily', prio: '0.6' });
urls.push({ loc: `${SITE}/data/index.json`, lastmod: day(), freq: 'daily', prio: '0.4' });
for (const n of news) urls.push({ loc: `${SITE}/news.html?id=${n.id}`, lastmod: day(n.published_at), freq: 'never', prio: '0.5' });
out('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url>\n    <loc>${xml(u.loc)}</loc>\n    <lastmod>${u.lastmod}</lastmod>\n    <changefreq>${u.freq}</changefreq>\n    <priority>${u.prio}</priority>\n  </url>`).join('\n')}\n</urlset>\n`);

console.log(`[surface] v${VERSION}: ${news.length} news · ${catalog.length} catalog · ${servers.length} servers · ${tools.length} MCP tools · ${urls.length} sitemap URLs${degraded ? ` · ${degraded} source(s) fell back to previous data` : ''}`);
if (STRICT && degraded) process.exitCode = 1;
