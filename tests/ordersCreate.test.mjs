// Characterization of createOrder (POST /v1/orders): every branch, against a scripted fake database and catalog.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { loadOrders } from './helpers/loadOrders.mjs';

const O = await loadOrders();
const { createOrder } = O.mod;
const NOW = Date.parse('2026-10-29T12:00:00Z');
Date.now = () => NOW;

const KEY = { id: 'k1', owner_id: 'own1', name: 'bot', scopes: ['quote', 'order'], max_order_usd: 500, max_daily_usd: 1000, allowed_kinds: ['merch', 'plan', 'domain', 'product'] };
const IDEM = 'idem-12345678';
const SHIP = { name: 'A B', address1: '1 Main', city: 'Vice City', zip: '33101', country_code: 'US', state_code: 'FL', email: 'a@b.co' };

const LINES = {
  tee: { kind: 'merch', title: 'Tee', unit_usd: 25, rails: ['paypal', 'crypto'], requires: ['shipping'], extra: { secret: 1 } },
  mug: { kind: 'merch', title: 'Mug', unit_usd: 10, rails: ['paypal', 'crypto'], requires: ['shipping'], extra: {} },
  dom: { kind: 'domain', title: 'Domain', unit_usd: 12.5, rails: ['crypto'], requires: ['delivery.wallet_address'], extra: {} },
  plan: { kind: 'plan', title: 'Plan', unit_usd: 5, rails: ['paypal', 'crypto'], requires: ['details.store_name'], extra: {} },
  ppo: { kind: 'plan', title: 'PayPal only', unit_usd: 3, rails: ['paypal'], requires: [], extra: {} },
};

let S;
function fresh(over = {}) {
  S = {
    existing: null, last: null, quote: null, spent: [], tagTaken: false, insert: null, insertResult: null, again: null, updates: [], inserts: [], ...over,
  };
  O.env.PAYPAL_CLIENT_ID = undefined; O.env.PAYPAL_CLIENT_SECRET = undefined;
  O.resolveLine = undefined;
  O.resolveLine = async (sku) => (LINES[sku] ? { line: LINES[sku] } : { reason: sku.startsWith('r:') ? sku.slice(2) : 'unknown_sku' });
  O.route = (c) => {
    const eq = (col) => (c.filters.find((f) => f[0] === 'eq' && f[1] === col) || [])[2];
    if (c.table === 'agent_quotes') return { data: S.quote };
    if (c.table === 'agent_orders') {
      if (c.op === 'insert') { S.inserts.push(c.payload); S.last = { id: 'oid', public_id: 'VCH-1', status: 'awaiting_payment', ...c.payload }; return S.insertResult || { data: S.last, error: null }; }
      if (c.op === 'update') { S.updates.push(c.payload); return { data: { ...S.last, ...c.payload }, error: null }; }
      if (c.single === 'maybeSingle' && eq('idempotency_key')) { const r = S.insertResult && S.again !== undefined && S.inserts.length ? S.again : S.existing; return { data: r }; }
      if (c.cols === 'total_usd') return { data: S.spent.map((t) => ({ total_usd: t })) };
      return { data: S.tagTaken ? [{ id: 'x' }] : [] };
    }
    return { data: null, error: null };
  };
}
beforeEach(() => fresh());

const run = (body, idem = IDEM, key = KEY) => createOrder(key, body, idem);
const err = (r, status, code) => { assert.equal(r.status, status); assert.equal(r.body.error.code, code); return r.body.error; };

test('scope and idempotency key are checked first', async () => {
  err(await run({}, IDEM, { ...KEY, scopes: ['quote'] }), 403, 'scope_missing');
  for (const bad of [null, '', 'short', 'x'.repeat(129)]) err(await run({}, bad), 400, 'idempotency_key_required');
  assert.equal((await run({ items: [{ sku: 'tee' }], payment_rail: 'crypto', shipping: SHIP }, 'x'.repeat(128))).status, 201);
  assert.equal((await run({ items: [{ sku: 'tee' }], payment_rail: 'crypto', shipping: SHIP }, 'x'.repeat(8))).status, 201);
});

test('same idempotency key replays the stored order', async () => {
  fresh({ existing: { public_id: 'VCH-9', status: 'paid', payment_rail: 'crypto', total_usd: 25, items: [{ sku: 'tee', extra: 1 }], payment: {} } });
  const r = await run({ items: [{ sku: 'tee' }] });
  assert.equal(r.status, 200);
  assert.equal(r.headers['Idempotent-Replayed'], 'true');
  assert.equal(r.body.id, 'VCH-9');
  assert.ok('shipping' in r.body);
  assert.deepEqual(S.inserts, []);
});

test('quote: missing or expired -> 410; valid quote prices the quoted lines', async () => {
  err(await run({ quote_id: 'Q1' }), 410, 'quote_expired');
  fresh({ quote: { items: [{ sku: 'tee', quantity: 1 }], total_usd: 25, expires_at: '2001-01-01T00:00:00Z' } });
  err(await run({ quote_id: 'Q1' }), 410, 'quote_expired');
  fresh({ quote: { items: [{ sku: 'tee', quantity: 2 }], total_usd: 50, expires_at: '2099-01-01T00:00:00Z' } });
  const r = await run({ quote_id: 'Q1', payment_rail: 'crypto', shipping: SHIP, items: [{ sku: 'ignored' }] });
  assert.equal(r.status, 201);
  assert.equal(r.body.total_usd, 50);
  assert.equal(S.inserts[0].items[0].quantity, 2);
});

test('quote: price drift beyond half a cent -> 409, within it passes', async () => {
  const q = (t) => ({ items: [{ sku: 'tee', quantity: 1 }], total_usd: t, expires_at: '2099-01-01T00:00:00Z' });
  fresh({ quote: q(24) });
  const e = err(await run({ quote_id: 'Q', payment_rail: 'crypto', shipping: SHIP }), 409, 'price_changed');
  assert.equal(e.message, 'Price changed from $24 to $25.');
  fresh({ quote: q(25.004) });
  assert.equal((await run({ quote_id: 'Q', payment_rail: 'crypto', shipping: SHIP })).status, 201);
});

test('items: shape, limits, unknown sku, kind not allowed, domain quantity, mixed rails, spend limits', async () => {
  err(await run({}), 422, 'invalid_items');
  err(await run({ items: [] }), 422, 'invalid_items');
  err(await run({ items: [{ sku: 'tee', quantity: 11 }] }), 422, 'invalid_items');
  err(await run({ items: [{ sku: '' }] }), 422, 'invalid_items');
  err(await run({ items: [{ sku: 'nope' }] }), 404, 'unknown_sku');
  err(await run({ items: [{ sku: 'r:out_of_stock' }] }), 409, 'out_of_stock');
  err(await run({ items: [{ sku: 'tee' }] }, IDEM, { ...KEY, allowed_kinds: ['plan'] }), 403, 'kind_not_allowed');
  err(await run({ items: [{ sku: 'dom', quantity: 2 }] }), 422, 'invalid_items');
  err(await run({ items: [{ sku: 'dom' }, { sku: 'ppo' }], payment_rail: 'crypto' }), 422, 'mixed_rails');
  err(await run({ items: [{ sku: 'tee', quantity: 10 }] }, IDEM, { ...KEY, max_order_usd: 100 }), 403, 'limit_exceeded');
  fresh({ spent: [900, 80] });
  err(await run({ items: [{ sku: 'tee' }] }), 403, 'daily_limit_exceeded');
});

test('payment_rail must be one the items share', async () => {
  const e = err(await run({ items: [{ sku: 'dom' }], payment_rail: 'paypal' }), 422, 'invalid_payment_rail');
  assert.equal(e.message, 'payment_rail must be one of: crypto');
  err(await run({ items: [{ sku: 'tee' }] }), 422, 'invalid_payment_rail');
});

test('shipping: required fields, country code, US/CA/AU need a state; address is normalised', async () => {
  const bad = async (shipping) => (await run({ items: [{ sku: 'tee' }], payment_rail: 'crypto', shipping })).body.error;
  assert.equal((await bad(undefined)).message, 'shipping is required for merch');
  assert.equal((await bad({ ...SHIP, city: ' ' })).message, 'shipping.city is required');
  assert.equal((await bad({ ...SHIP, country_code: 'usa' })).message, 'shipping.country_code must be ISO-3166 alpha-2 (e.g. US)');
  assert.equal((await bad({ ...SHIP, state_code: '' })).message, 'shipping.state_code is required for US/CA/AU');
  assert.equal((await bad(undefined)).code, 'invalid_shipping');
  const r = await run({ items: [{ sku: 'tee' }], payment_rail: 'crypto', shipping: { ...SHIP, country_code: 'DE', state_code: undefined, extra: 'x' } });
  assert.equal(r.status, 201);
  assert.deepEqual(S.inserts[0].shipping, { name: 'A B', address1: '1 Main', address2: null, city: 'Vice City', state_code: null, zip: '33101', country_code: 'DE', email: 'a@b.co', phone: null });
});

test('domain: delivery wallet must be an EVM address', async () => {
  for (const w of [undefined, 'abc', '0x123', '0x' + 'g'.repeat(40), 5]) err(await run({ items: [{ sku: 'dom' }], payment_rail: 'crypto', delivery: { wallet_address: w } }), 422, 'invalid_delivery');
  const w = '0x' + 'aB'.repeat(20);
  const r = await run({ items: [{ sku: 'dom' }], payment_rail: 'crypto', delivery: { wallet_address: w } });
  assert.equal(r.status, 201);
  assert.deepEqual(S.inserts[0].delivery, { wallet_address: w });
  assert.equal(S.inserts[0].shipping, null);
});

test('store plan: needs store name and a valid contact email; details are trimmed and stored in delivery', async () => {
  const send = (details) => run({ items: [{ sku: 'plan' }], payment_rail: 'crypto', details });
  err(await send(undefined), 422, 'invalid_details');
  err(await send({ store_name: 'S' }), 422, 'invalid_details');
  err(await send({ store_name: 'S', contact_email: 'nope' }), 422, 'invalid_details');
  err(await send({ contact_email: 'a@b.co' }), 422, 'invalid_details');
  const r = await send({ store_name: 'S'.repeat(200), contact_email: 'a@b.co', website_url: 'https://x.io' });
  assert.equal(r.status, 201);
  assert.deepEqual(S.inserts[0].delivery, { details: { store_name: 'S'.repeat(120), contact_email: 'a@b.co', website_url: 'https://x.io', discord_url: null } });
});

test('plan + domain in one order is impossible (no common rail needed: both crypto) and keeps both requirements', async () => {
  const w = '0x' + '1'.repeat(40);
  const r = await run({ items: [{ sku: 'dom' }, { sku: 'plan' }], payment_rail: 'crypto', delivery: { wallet_address: w }, details: { store_name: 'S', contact_email: 'a@b.co' } });
  assert.equal(r.status, 201);
  assert.deepEqual(S.inserts[0].delivery, { wallet_address: w, details: { store_name: 'S', contact_email: 'a@b.co', website_url: null, discord_url: null } });
});

test('crypto: duplicate SKUs merge, the row carries the key, owner and a unique amount tag', async () => {
  const r = await run({ items: [{ sku: 'tee' }, { sku: 'mug', quantity: 2 }, { sku: 'tee', quantity: 2 }], payment_rail: 'crypto', shipping: SHIP });
  assert.equal(r.status, 201);
  const row = S.inserts[0];
  assert.equal(row.agent_key_id, 'k1'); assert.equal(row.owner_id, 'own1'); assert.equal(row.idempotency_key, IDEM);
  assert.equal(row.total_usd, 95);
  assert.deepEqual(row.items.map((l) => [l.sku, l.quantity, l.line_usd]), [['tee', 3, 75], ['mug', 2, 20]]);
  assert.equal(row.payment_rail, 'crypto');
  assert.ok(Number.isInteger(row.payment.crypto.tag) && row.payment.crypto.tag >= 1 && row.payment.crypto.tag <= 9999);
  assert.match(row.payment.crypto.amount_due, /^95\.\d{6}$/);
  assert.equal(r.body.payment.provider, 'crypto');
  assert.deepEqual(S.updates, []);
  assert.ok(!('extra' in r.body.items[0]));
});

test('crypto: a taken amount makes it retry, and after 8 tries it still produces a tag', async () => {
  fresh({ tagTaken: true });
  const r = await run({ items: [{ sku: 'tee' }], payment_rail: 'crypto', shipping: SHIP });
  assert.equal(r.status, 201);
  assert.ok(S.inserts[0].payment.crypto.tag >= 1);
});

test('insert errors: unique violation replays the winner, otherwise 500', async () => {
  fresh({ insertResult: { data: null, error: { code: '23505' } }, again: { public_id: 'VCH-7', status: 'awaiting_payment', payment_rail: 'crypto', total_usd: 25, items: [], payment: {} } });
  const r = await run({ items: [{ sku: 'tee' }], payment_rail: 'crypto', shipping: SHIP });
  assert.equal(r.status, 200); assert.equal(r.headers['Idempotent-Replayed'], 'true'); assert.equal(r.body.id, 'VCH-7');
  fresh({ insertResult: { data: null, error: { code: '23505' } }, again: null });
  err(await run({ items: [{ sku: 'tee' }], payment_rail: 'crypto', shipping: SHIP }), 500, 'db_error');
  fresh({ insertResult: { data: null, error: { code: '42P01' } } });
  err(await run({ items: [{ sku: 'tee' }], payment_rail: 'crypto', shipping: SHIP }), 500, 'db_error');
});

test('paypal: provider failure marks the order failed and answers 502', async () => {
  const r = await run({ items: [{ sku: 'tee' }], payment_rail: 'paypal', shipping: SHIP });
  err(r, 502, 'payment_provider_error');
  assert.equal(S.updates.length, 1);
  assert.equal(S.updates[0].status, 'failed');
  assert.equal(S.updates[0].fulfillment.error, 'PayPal credentials are not configured');
  assert.deepEqual(S.inserts[0].payment, {});
});

test('paypal: creates the PayPal order (shipping only for merch) and stores the approve link', async () => {
  O.env.PAYPAL_CLIENT_ID = 'id'; O.env.PAYPAL_CLIENT_SECRET = 'sec';
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    if (String(url).endsWith('/oauth2/token')) return { ok: true, json: async () => ({ access_token: 'T' }) };
    return { ok: true, json: async () => ({ id: 'PP1', links: [{ rel: 'self', href: 's' }, { rel: 'payer-action', href: 'https://pay/x' }] }) };
  };
  try {
    const r = await run({ items: [{ sku: 'tee' }, { sku: 'mug' }], payment_rail: 'paypal', shipping: SHIP });
    assert.equal(r.status, 201);
    assert.equal(r.body.payment.provider, 'paypal');
    assert.equal(r.body.payment.approve_url, 'https://pay/x');
    assert.equal(S.updates[0].payment.paypal_order_id, 'PP1');
    const sent = JSON.parse(calls[1].init.body);
    assert.equal(sent.purchase_units[0].amount.value, '35.00');
    assert.equal(sent.purchase_units[0].shipping.name.full_name, 'A B');
    assert.equal(sent.payment_source.paypal.experience_context.shipping_preference, 'SET_PROVIDED_ADDRESS');
    fresh();
    O.env.PAYPAL_CLIENT_ID = 'id'; O.env.PAYPAL_CLIENT_SECRET = 'sec';
    const r2 = await run({ items: [{ sku: 'plan' }], payment_rail: 'paypal', details: { store_name: 'S', contact_email: 'a@b.co' } });
    assert.equal(r2.status, 201);
    const sent2 = JSON.parse(calls[3].init.body);
    assert.ok(!('shipping' in sent2.purchase_units[0]));
    assert.equal(sent2.payment_source.paypal.experience_context.shipping_preference, 'NO_SHIPPING');
  } finally { globalThis.fetch = realFetch; }
});

test('paypal HTTP error from PayPal -> failed + 502 with the provider name recorded', async () => {
  O.env.PAYPAL_CLIENT_ID = 'id'; O.env.PAYPAL_CLIENT_SECRET = 'sec';
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => (String(url).endsWith('/oauth2/token') ? { ok: true, json: async () => ({ access_token: 'T' }) } : { ok: false, status: 422, json: async () => ({ name: 'UNPROCESSABLE' }) });
  try {
    err(await run({ items: [{ sku: 'plan' }], payment_rail: 'paypal', details: { store_name: 'S', contact_email: 'a@b.co' } }), 502, 'payment_provider_error');
    assert.equal(S.updates[0].fulfillment.error, 'PayPal create failed: UNPROCESSABLE');
  } finally { globalThis.fetch = realFetch; }
});
