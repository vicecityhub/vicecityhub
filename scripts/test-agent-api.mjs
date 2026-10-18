/**
 * VCH v12 — Agent API smoke test (safe: never touches PayPal, never moves money).
 * Usage: node scripts/test-agent-api.mjs [baseUrl]
 */
const BASE = process.argv[2] || 'https://lpglkglhjdqnktybksth.supabase.co/functions/v1/agent-api';
let pass = 0, failn = 0;
const check = (name, cond, extra = '') => { (cond ? pass++ : failn++); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  → ' + extra : ''}`); };
const call = async (method, path, { body, key, idem } = {}) => {
  const r = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: `Bearer ${key}` } : {}), ...(idem ? { 'Idempotency-Key': idem } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let j = null; try { j = await r.json(); } catch {}
  return { s: r.status, j, h: r.headers };
};

const idx = await call('GET', '/v1');
check('index', idx.s === 200 && idx.j?.mcp?.url);

const oa = await call('GET', '/v1/openapi.json');
check('openapi', oa.s === 200 && oa.j?.openapi === '3.1.0', `${Object.keys(oa.j?.paths || {}).length} paths`);

const cat = await call('GET', '/v1/catalog?limit=50');
check('catalog', cat.s === 200 && cat.j.total > 0, `total=${cat.j?.total}`);
check('catalog list has no heavy variants', !JSON.stringify(cat.j).includes('"variants":['));

const dom = await call('GET', '/v1/catalog?kind=domain&orderable=true&limit=1');
const domain = dom.j?.items?.[0];
check('domain item orderable', !!domain && domain.purchase.rails.includes('crypto'), domain?.sku);

const news = await call('GET', '/v1/news?limit=1');
check('news', news.s === 200 && news.j.items.length === 1);
const one = await call('GET', `/v1/news/${news.j.items[0].id}`);
check('news item has body', one.s === 200 && 'body' in one.j);

const rp = await call('GET', '/v1/rp/servers');
check('rp servers', rp.s === 200 && Array.isArray(rp.j.items));

const sr = await call('GET', '/v1/search?q=gta');
check('search', sr.s === 200);

const noauth = await call('POST', '/v1/quotes', { body: { items: [{ sku: domain?.sku }] } });
check('quotes need key → 401', noauth.s === 401);

const reg = await call('POST', '/v1/agents/register', { body: { name: 'vch-smoke-test', operator: 'Vice City Hub CI' } });
check('register', reg.s === 201 && /^vch_live_[0-9a-f]{48}$/.test(reg.j?.api_key || ''));
const key = reg.j?.api_key;

const me = await call('GET', '/v1/agents/me', { key });
check('whoami', me.s === 200 && me.j.limits.max_order_usd === 100);

// domain > $100 must hit the mandate limit (default self-registered key)
const q1 = await call('POST', '/v1/quotes', { key, body: { items: [{ sku: domain.sku }] } });
check('self-key cannot quote domain over $100 → 403 limit_exceeded', q1.s === 403 && q1.j?.error?.code === 'limit_exceeded', q1.j?.error?.code);

const q2 = await call('POST', '/v1/quotes', { key, body: { items: [{ sku: 'nope:1' }] } });
check('unknown sku → 404', q2.s === 404);

const noIdem = await call('POST', '/v1/orders', { key, body: { items: [{ sku: domain.sku }], payment_rail: 'crypto' } });
check('order without Idempotency-Key → 400', noIdem.s === 400);

// plan order via crypto rail (cheap, no external calls)
const plans = await call('GET', '/v1/catalog?kind=plan&limit=10');
const starter = plans.j.items.find((p) => p.price_usd <= 100);
if (starter) {
  const idem = 'smoke-' + Date.now();
  const bad = await call('POST', '/v1/orders', { key, idem, body: { items: [{ sku: starter.sku }], payment_rail: 'crypto' } });
  check('plan order without details → 422', bad.s === 422, bad.j?.error?.code);
  const body = { items: [{ sku: starter.sku }], payment_rail: 'crypto', details: { store_name: 'Smoke Test Store', contact_email: 'smoke@example.com' } };
  const o = await call('POST', '/v1/orders', { key, idem, body });
  check('order created (crypto)', o.s === 201 && o.j.status === 'awaiting_payment' && o.j.next_action?.type === 'send_stablecoin', o.j?.id);
  const o2 = await call('POST', '/v1/orders', { key, idem, body });
  check('idempotent replay', o2.s === 200 && o2.j.id === o.j.id && o2.h.get('idempotent-replayed') === 'true');
  const st = await call('GET', `/v1/orders/${o.j.id}/status`);
  check('public status', st.s === 200 && st.j.status === 'awaiting_payment');
  const badProof = await call('POST', `/v1/orders/${o.j.id}/payment-proof`, { key, body: { chain: 'tron', tx_hash: 'xyz' } });
  check('bad tx hash → 422', badProof.s === 422);
  const due = o.j.next_action?.amount_due;
  check('crypto order has exact tagged amount_due', /^\d+\.\d{6}$/.test(due || '') && Number(due) > o.j.total_usd && Number(due) - o.j.total_usd < 0.01, due);
  const v0 = await call('POST', `/v1/orders/${o.j.id}/verify`, { key });
  check('verify before any proof → 409', v0.s === 409 && v0.j?.error?.code === 'no_payment_proof', v0.j?.error?.code);
  const fake = await call('POST', `/v1/orders/${o.j.id}/payment-proof`, { key, body: { chain: 'evm', network: 'polygon', tx_hash: '0x' + 'ab'.repeat(32) } });
  check('unknown tx never marks paid (409 tx_not_found | 503)', (fake.s === 409 && fake.j?.error?.code === 'tx_not_found') || fake.s === 503, `${fake.s} ${fake.j?.error?.code}`);
  const stAfter = await call('GET', `/v1/orders/${o.j.id}/status`);
  check('order still awaiting_payment after fake proof', stAfter.j?.status === 'awaiting_payment', stAfter.j?.status);
  const own = await call('GET', '/v1/owner/keys');
  check('owner console needs a signed-in human → 401', own.s === 401, String(own.s));
  const cx = await call('POST', `/v1/orders/${o.j.id}/cancel`, { key });
  check('cancel', cx.s === 200 && cx.j.status === 'cancelled');
} else {
  console.log('SKIP  no plan ≤ $100 in catalog');
}

// MCP
const mcpCall = async (method, params, id = 1) => (await fetch(BASE + '/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id, method, params }) })).json();
const init = await mcpCall('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'smoke', version: '1' } });
check('mcp initialize', init.result?.serverInfo?.name === 'vice-city-hub');
const tl = await mcpCall('tools/list', {}, 2);
check('mcp tools/list', tl.result?.tools?.length >= 10, `${tl.result?.tools?.length} tools`);
const tc = await mcpCall('tools/call', { name: 'list_news', arguments: { limit: 1 } }, 3);
check('mcp tools/call list_news', tc.result?.isError === false);
const ta = await mcpCall('tools/call', { name: 'create_quote', arguments: { items: [{ sku: 'x' }] } }, 4);
check('mcp auth tool without key → isError', ta.result?.isError === true);

console.log(`\n${pass} passed, ${failn} failed`);
process.exit(failn ? 1 : 0);
