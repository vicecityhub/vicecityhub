// Characterization of createIntent (POST /v1/intents) and of the shipping validation rules.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { loadOrders } from './helpers/loadOrders.mjs';

const O = await loadOrders();
const { createIntent, createOrder } = O.mod;
const KEY = { id: 'k1', owner_id: 'own1', name: 'bot', scopes: ['quote', 'order'], max_order_usd: 500, max_daily_usd: 1000, allowed_kinds: ['merch'] };

let S;
beforeEach(() => {
  S = { inserted: null, insertError: null, seller: null, sellerQuery: null, notified: [] };
  O.env.NOTIFY_WEBHOOK_URL = 'https://hook.test/x';
  globalThis.fetch = async (url, init) => { S.notified.push([url, JSON.parse(init.body)]); return { ok: true }; };
  O.findItem = async (sku) => ({ 'srv:7': { kind: 'server', title: 'Server', purchase: { external_url: 'https://seller.example/s' } }, 'prod:1': { kind: 'product', title: 'Prod', purchase: { external_url: 'https://seller.example/p' } }, 'plan:1': { kind: 'plan', title: 'Plan', purchase: {} } })[sku] || null;
  O.route = (c) => {
    if (c.table === 'agent_intents' && c.op === 'insert') { S.inserted = c.payload; return S.insertError ? { data: null, error: S.insertError } : { data: { public_id: 'vch_int_1' }, error: null }; }
    if (c.table === 'server_marketplace') { S.sellerQuery = c.filters.find((f) => f[1] === 'id')?.[2]; return { data: S.seller }; }
    return { data: null, error: null };
  };
});

test('unknown or missing sku -> 404', async () => {
  for (const body of [undefined, {}, { sku: 5 }, { sku: '   ' }, { sku: 'nope' }]) {
    const r = await createIntent(KEY, body);
    assert.deepEqual([r.status, r.body.error.code], [404, 'unknown_sku']);
  }
});

test('records the intent: sku trimmed, message cut to 1000, only known string contact fields cut to 200', async () => {
  const r = await createIntent(KEY, { sku: ' plan:1 ', message: 'm'.repeat(1500), contact: { email: 'e'.repeat(300), discord: 'd', telegram: 5, wallet: null, other: 'x' } });
  assert.equal(r.status, 201);
  assert.deepEqual(S.inserted, { agent_key_id: 'k1', sku: 'plan:1', message: 'm'.repeat(1000), contact: { email: 'e'.repeat(200), discord: 'd' } });
  assert.deepEqual(r.body, { intent_id: 'vch_int_1', sku: 'plan:1', status: 'recorded', how_to_complete: 'Intent recorded. The operator will follow up using the contact details you supplied.', note: 'Vice City Hub never holds funds for third-party listings.' });
});

test('message and contact are optional (null message, empty contact)', async () => {
  await createIntent(KEY, { sku: 'plan:1', message: 7, contact: 'x' });
  assert.deepEqual([S.inserted.message, S.inserted.contact], [null, {}]);
});

test('how_to_complete: external link for listings, seller contact for servers', async () => {
  assert.equal((await createIntent(KEY, { sku: 'prod:1' })).body.how_to_complete, 'Buy directly from the seller: https://seller.example/p');
  S.seller = null;
  assert.equal((await createIntent(KEY, { sku: 'srv:7' })).body.how_to_complete, 'Buy directly from the seller: https://seller.example/s');
  assert.equal(S.sellerQuery, '7');
  S.seller = { seller_contact: '@seller' };
  assert.equal((await createIntent(KEY, { sku: 'srv:7' })).body.how_to_complete, 'Contact the seller directly: @seller');
  S.seller = { seller_contact: '' };
  assert.equal((await createIntent(KEY, { sku: 'srv:7' })).body.how_to_complete, 'Buy directly from the seller: https://seller.example/s');
});

test('database error -> 500 and nobody is notified', async () => {
  S.insertError = { message: 'x' };
  const r = await createIntent(KEY, { sku: 'plan:1' });
  assert.deepEqual([r.status, r.body.error.code], [500, 'db_error']);
  assert.equal(S.notified.length, 0);
});

test('the owner is notified with id, sku, title, message and contact', async () => {
  await createIntent(KEY, { sku: 'plan:1', message: 'hi', contact: { email: 'a@b.co' } });
  assert.equal(S.notified.length, 1);
  assert.equal(S.notified[0][1].content, '**VCH purchase intent**\nvch_int_1: plan:1 (Plan)\nhi\n{"email":"a@b.co"}');
  await createIntent(KEY, { sku: 'plan:1' });
  assert.equal(S.notified[1][1].content, '**VCH purchase intent**\nvch_int_1: plan:1 (Plan)\n\n{}');
});

// ---------- shipping rules, through createOrder ----------
const MERCH = { kind: 'merch', title: 'Tee', unit_usd: 25, rails: ['crypto'], requires: ['shipping'], extra: {} };
const base = { name: 'A B', address1: '1 Main', city: 'Vice City', zip: '33101', country_code: 'DE' };
async function shippingError(shipping) {
  O.resolveLine = async () => ({ line: MERCH });
  O.route = (c) => (c.op === 'insert' ? { data: { public_id: 'x', ...c.payload }, error: null } : { data: c.single ? null : [], error: null });
  const r = await createOrder(KEY, { items: [{ sku: 't' }], payment_rail: 'crypto', shipping }, 'idem-12345678');
  return r.status === 201 ? null : r.body.error.message;
}

test('shipping rules: object required, each field a non-blank string, ISO alpha-2 code, state for US/CA/AU', async () => {
  for (const s of [undefined, null, 'x', 5]) assert.equal(await shippingError(s), 'shipping is required for merch');
  for (const f of ['name', 'address1', 'city', 'zip', 'country_code']) {
    for (const v of [undefined, '', '  ', 7]) assert.equal(await shippingError({ ...base, [f]: v }), `shipping.${f} is required`, `${f}=${v}`);
  }
  for (const cc of ['de', 'DEU', 'D1', 'D E']) assert.equal(await shippingError({ ...base, country_code: cc }), 'shipping.country_code must be ISO-3166 alpha-2 (e.g. US)', cc);
  for (const cc of ['US', 'CA', 'AU']) {
    assert.equal(await shippingError({ ...base, country_code: cc }), 'shipping.state_code is required for US/CA/AU');
    assert.equal(await shippingError({ ...base, country_code: cc, state_code: '' }), 'shipping.state_code is required for US/CA/AU');
    assert.equal(await shippingError({ ...base, country_code: cc, state_code: 'XX' }), null);
  }
  assert.equal(await shippingError(base), null);
  assert.equal(await shippingError({ ...base, name: ' A ' }), null);
});

test('shipping: the first failing field is reported (fields checked in order)', async () => {
  assert.equal(await shippingError({ ...base, city: '', name: '' }), 'shipping.name is required');
  assert.equal(await shippingError({ ...base, zip: '', country_code: 'zz' }), 'shipping.zip is required');
});
