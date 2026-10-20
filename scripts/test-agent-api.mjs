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

// merch over the crypto rail (never paid in the smoke test)
const mer = await call('GET', '/v1/catalog?kind=merch&limit=5');
const merch = mer.j?.items?.[0];
check('merch lists the crypto rail', !!merch && merch.purchase.rails.includes('crypto'), merch?.sku);
if (merch) {
  const det = await call('GET', `/v1/catalog/${encodeURIComponent(merch.sku)}`);
  const variant = det.j?.variants?.find((v) => v.availability === 'in_stock' && v.price_usd <= 100);
  if (variant) {
    const mo = await call('POST', '/v1/orders', { key, idem: 'smoke-merch-' + Date.now(), body: { items: [{ sku: variant.sku }], payment_rail: 'crypto', shipping: { name: 'Smoke Test', address1: '1 Test St', city: 'Miami', state_code: 'FL', zip: '33101', country_code: 'US' } } });
    check('merch order created via crypto (auto-detect)', mo.s === 201 && mo.j.next_action?.type === 'send_stablecoin' && mo.j.next_action?.auto_detect === true, mo.j?.id || mo.j?.error?.code);
    const mc = await call('POST', `/v1/orders/${mo.j?.id}/cancel`, { key });
    check('merch crypto order cancel', mc.s === 200);
  } else console.log('SKIP  no in-stock merch variant <= $100');
}
// donations for AI development (crypto only, automatic; never paid in the smoke test)
const di = await call('GET', '/v1/donate');
check('donate info states the purpose', di.s === 200 && /AI/.test(di.j?.purpose || '') && di.j?.voluntary === true && /\/v1\/donations/.test(di.j?.how_to_donate?.endpoint || ''), (di.j?.purpose || '').slice(0, 60));
const dn0 = await call('POST', '/v1/donations', { body: { amount_usd: 5, authorized_by_principal: true }, idem: 'smoke-don-anon-1' });
check('donation needs a key', dn0.s === 401, dn0.s);
const dn1 = await call('POST', '/v1/donations', { key, body: { amount_usd: 5 }, idem: 'smoke-don-noauth-' + Date.now() });
check('donation needs principal authorization', dn1.s === 422 && dn1.j?.error?.code === 'authorization_required', dn1.j?.error?.code);
const dn2 = await call('POST', '/v1/donations', { key, body: { amount_usd: 0.5, authorized_by_principal: true }, idem: 'smoke-don-low-' + Date.now() });
check('donation below minimum rejected', dn2.s === 422 && dn2.j?.error?.code === 'invalid_amount', dn2.j?.error?.code);
const dkey = 'smoke-don-' + Date.now();
const dn3 = await call('POST', '/v1/donations', { key, idem: dkey, body: { amount_usd: 1, authorized_by_principal: true, message: 'smoke test', donor: { agent: 'smoke-test' } } });
check('donation order created (crypto, auto-detect)', dn3.s === 201 && dn3.j?.next_action?.type === 'send_stablecoin' && dn3.j?.next_action?.auto_detect === true && /^1\.00\d{4}$/.test(dn3.j?.next_action?.amount_due || '') && /AI/.test(dn3.j?.purpose || ''), dn3.j?.next_action?.amount_due || dn3.j?.error?.code);
const dn4 = await call('POST', '/v1/donations', { key, idem: dkey, body: { amount_usd: 1, authorized_by_principal: true } });
check('donation idempotent replay', dn4.s === 200 && dn4.j?.id === dn3.j?.id, dn4.s);
const dnc = await call('POST', `/v1/orders/${dn3.j?.id}/cancel`, { key });
check('donation order cancel', dnc.s === 200);
const rc = await call('GET', '/v1/internal/reconcile');
check('reconciler endpoint', rc.s === 200 && (rc.j?.skipped === 'throttled' || typeof rc.j?.awaiting_orders === 'number'), JSON.stringify(rc.j));

// MCP
const mcpCall = async (method, params, id = 1) => (await fetch(BASE + '/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id, method, params }) })).json();
const init = await mcpCall('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'smoke', version: '1' } });
check('mcp initialize', init.result?.serverInfo?.name === 'vice-city-hub');
const tl = await mcpCall('tools/list', {}, 2);
check('mcp tools/list', tl.result?.tools?.length >= 10, `${tl.result?.tools?.length} tools`);
check('mcp has donation tools', ['get_donation_info', 'donate'].every((n) => tl.result?.tools?.some((t) => t.name === n)));
const tc = await mcpCall('tools/call', { name: 'list_news', arguments: { limit: 1 } }, 3);
check('mcp tools/call list_news', tc.result?.isError === false);
const ta = await mcpCall('tools/call', { name: 'create_quote', arguments: { items: [{ sku: 'x' }] } }, 4);
check('mcp auth tool without key → isError', ta.result?.isError === true);

console.log(`\n${pass} passed, ${failn} failed`);
process.exit(failn ? 1 : 0);
