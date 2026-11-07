// Characterization of the pricing stage (through POST /v1/quotes) and of the order view's next_action, against a scripted fake catalog.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { loadOrders } from './helpers/loadOrders.mjs';

const O = await loadOrders();
const { createQuote, view } = O.mod;
const NOW = Date.parse('2026-10-29T12:00:00Z');
Date.now = () => NOW;

const KEY = { id: 'k1', owner_id: 'own1', name: 'bot', scopes: ['quote', 'order'], max_order_usd: 500, max_daily_usd: 1000, allowed_kinds: ['merch', 'plan', 'domain', 'product'] };
const LINES = {
  tee: { kind: 'merch', title: 'Tee', unit_usd: 25, rails: ['paypal', 'crypto'], requires: ['shipping'], extra: { secret: 1 } },
  mug: { kind: 'merch', title: 'Mug', unit_usd: 10, rails: ['paypal', 'crypto'], requires: ['shipping'], extra: {} },
  dom: { kind: 'domain', title: 'Domain', unit_usd: 12.5, rails: ['crypto'], requires: ['delivery.wallet_address'], extra: {} },
  plan: { kind: 'plan', title: 'Plan', unit_usd: 5, rails: ['paypal', 'crypto'], requires: ['details.store_name'], extra: {} },
  ppo: { kind: 'plan', title: 'PayPal only', unit_usd: 3, rails: ['paypal'], requires: [], extra: {} },
  cheap: { kind: 'merch', title: 'Cheap', unit_usd: 19.99, rails: ['paypal', 'crypto'], requires: [], extra: {} },
  dime: { kind: 'merch', title: 'Dime', unit_usd: 0.1, rails: ['paypal', 'crypto'], requires: [], extra: {} },
  dime2: { kind: 'merch', title: 'Dime2', unit_usd: 0.2, rails: ['paypal', 'crypto'], requires: [], extra: {} },
};

let S;
function fresh(over = {}) {
  S = { spent: [], quotes: [], filters: null, ...over };
  O.resolveLine = async (sku) => (LINES[sku] ? { line: LINES[sku] } : { reason: sku.startsWith('r:') ? sku.slice(2) : 'unknown_sku' });
  O.route = (c) => {
    if (c.table === 'agent_quotes' && c.op === 'insert') { S.quotes.push(c.payload); return { data: { public_id: 'Q-1', expires_at: '2026-10-29T12:30:00Z' } }; }
    if (c.table === 'agent_orders') { S.filters = c.filters; return { data: S.spent.map((t) => ({ total_usd: t })) }; }
    return { data: null, error: null };
  };
}
beforeEach(() => fresh());
const quote = (items, key = KEY) => createQuote(key, { items });
const err = (r, status, code) => { assert.equal(r.status, status); assert.equal(r.body.error.code, code); return r.body.error; };
const SHAPE = 'Each item needs a string `sku` and an integer `quantity` between 1 and 10.';

test('items must be an array of 1-10 objects', async () => {
  for (const items of [undefined, null, 'tee', {}, [], Array.from({ length: 11 }, () => ({ sku: 'tee' }))]) {
    const e = err(await quote(items), 422, 'invalid_items');
    assert.equal(e.message, '`items` must be an array of 1-10 {sku, quantity} objects.');
  }
  assert.equal((await quote(Array.from({ length: 10 }, () => ({ sku: 'tee' })))).status, 201);
});

test('each item needs a string sku (trimmed) and an integer quantity of 1-10; a missing quantity is 1', async () => {
  for (const it of [null, 5, 'tee', {}, { sku: 5 }, { sku: '' }, { sku: '   ' }, { sku: 'tee', quantity: 0 }, { sku: 'tee', quantity: -1 }, { sku: 'tee', quantity: 1.5 },
    { sku: 'tee', quantity: 11 }, { sku: 'tee', quantity: 'abc' }, { sku: 'tee', quantity: null }, { sku: 'tee', quantity: '' }, { sku: 'tee', quantity: [] }, { sku: 'tee', quantity: NaN }]) {
    assert.equal(err(await quote([it]), 422, 'invalid_items').message, SHAPE, JSON.stringify(it));
  }
  for (const [quantity, expected] of [[undefined, 1], ['3', 3], [true, 1], [10, 10]]) {
    fresh();
    const r = await quote([{ sku: ' tee ', quantity }]);
    assert.equal(r.status, 201, String(quantity));
    assert.deepEqual([r.body.items[0].sku, r.body.items[0].quantity], ['tee', expected]);
  }
});

test('the same sku is merged in first-seen order; the merged quantity is not capped again', async () => {
  const r = await quote([{ sku: 'tee', quantity: 1 }, { sku: 'mug' }, { sku: ' tee ', quantity: 2 }, { sku: 'mug', quantity: 9 }]);
  assert.deepEqual(r.body.items.map((i) => [i.sku, i.quantity, i.line_usd]), [['tee', 3, 75], ['mug', 10, 100]]);
  const big = await quote([{ sku: 'dime', quantity: 10 }, { sku: 'dime', quantity: 10 }]);
  assert.deepEqual([big.body.items[0].quantity, big.body.total_usd], [20, 2]);
});

test('lines carry kind, title, unit and line prices; the stored quote keeps the extra data, the response does not', async () => {
  const r = await quote([{ sku: 'tee', quantity: 2 }]);
  assert.equal(r.status, 201);
  assert.deepEqual(r.body.items, [{ sku: 'tee', kind: 'merch', title: 'Tee', quantity: 2, unit_usd: 25, line_usd: 50 }]);
  assert.deepEqual(S.quotes[0], { agent_key_id: 'k1', items: [{ sku: 'tee', kind: 'merch', title: 'Tee', quantity: 2, unit_usd: 25, line_usd: 50, extra: { secret: 1 } }], total_usd: 50 });
  assert.deepEqual([r.body.quote_id, r.body.currency, r.body.expires_at], ['Q-1', 'USD', '2026-10-29T12:30:00Z']);
  assert.match(r.body.next, /^POST .*\/v1\/orders with \{quote_id, payment_rail, \.\.\.required fields\} and an Idempotency-Key header$/);
});

test('prices are rounded to cents per line and in total', async () => {
  const r = await quote([{ sku: 'cheap', quantity: 3 }, { sku: 'dime' }, { sku: 'dime2' }]);
  assert.deepEqual(r.body.items.map((i) => i.line_usd), [59.97, 0.1, 0.2]);
  assert.equal(r.body.total_usd, 60.27);
  assert.equal((await quote([{ sku: 'dime' }, { sku: 'dime2' }])).body.total_usd, 0.3);
});

test('payment rails are the intersection over all lines (first line order), requirements a de-duplicated union', async () => {
  const r = await quote([{ sku: 'tee' }, { sku: 'dom' }, { sku: 'plan' }, { sku: 'tee', quantity: 2 }]);
  assert.deepEqual(r.body.payment_rails_available, ['crypto']);
  assert.deepEqual(r.body.requires, ['shipping', 'delivery.wallet_address', 'details.store_name']);
  const both = await quote([{ sku: 'plan' }, { sku: 'tee' }]);
  assert.deepEqual(both.body.payment_rails_available, ['paypal', 'crypto']);
  assert.deepEqual((await quote([{ sku: 'ppo' }])).body.requires, []);
});

test('a line the catalog cannot sell says why, with the sku', async () => {
  let e = err(await quote([{ sku: 'nope' }]), 404, 'unknown_sku');
  assert.deepEqual([e.message, e.hint], ['SKU not found: nope', 'List SKUs with GET /v1/catalog.']);
  e = err(await quote([{ sku: 'r:out_of_stock' }]), 409, 'out_of_stock');
  assert.equal(e.message, 'Out of stock: r:out_of_stock');
  e = err(await quote([{ sku: 'r:use_variant_sku' }]), 422, 'use_variant_sku');
  assert.deepEqual([e.message, e.hint], ['Merch products are ordered by variant.', 'Use a `merchv:<id>` SKU from the product\'s `variants` array.']);
  e = err(await quote([{ sku: 'r:intent_only' }]), 422, 'not_orderable');
  assert.deepEqual([e.message, e.hint], ['r:intent_only is a peer listing without on-site checkout.', 'Use POST /v1/intents to contact the seller.']);
  e = err(await quote([{ sku: 'r:no_price' }]), 409, 'no_price');
  assert.equal(e.message, 'r:no_price has no price right now.');
});

test('the key may only buy the kinds it was minted for; domains and plans are quantity 1 only', async () => {
  const e = err(await quote([{ sku: 'tee' }], { ...KEY, allowed_kinds: ['plan'] }), 403, 'kind_not_allowed');
  assert.equal(e.message, "This API key may not buy 'merch' items.");
  assert.equal(err(await quote([{ sku: 'dom', quantity: 2 }]), 422, 'invalid_items').message, 'domain items are quantity 1 only.');
  assert.equal(err(await quote([{ sku: 'plan', quantity: 3 }]), 422, 'invalid_items').message, 'plan items are quantity 1 only.');
  // the kind rule is checked before the quantity rule
  assert.equal(err(await quote([{ sku: 'dom', quantity: 2 }], { ...KEY, allowed_kinds: ['merch'] }), 403, 'kind_not_allowed').message, "This API key may not buy 'domain' items.");
});

test('lines are checked one after another: the first problem wins, and rails are decided only after every line passed', async () => {
  err(await quote([{ sku: 'dom' }, { sku: 'ppo' }, { sku: 'nope' }]), 404, 'unknown_sku');
  const e = err(await quote([{ sku: 'dom' }, { sku: 'ppo' }]), 422, 'mixed_rails');
  assert.deepEqual([e.message, e.hint], ['These items cannot be paid in one order (no common payment rail).', 'Split into separate orders: domains are crypto-only; merch and store plans accept PayPal or crypto.']);
  // mixed rails come before the spend limits
  err(await quote([{ sku: 'dom' }, { sku: 'ppo' }], { ...KEY, max_order_usd: 1 }), 422, 'mixed_rails');
});

test('spend limits: per order (inclusive) and rolling 24 hours (inclusive), counting every order that did not die', async () => {
  let e = err(await quote([{ sku: 'tee', quantity: 5 }], { ...KEY, max_order_usd: 100 }), 403, 'limit_exceeded');
  assert.deepEqual([e.message, e.hint], ["Order total $125 exceeds this key's per-order limit of $100.", 'A human owner can mint a key with a higher mandate from the Agents page.']);
  assert.equal((await quote([{ sku: 'tee', quantity: 4 }], { ...KEY, max_order_usd: 100 })).status, 201);
  fresh({ spent: ['900', 80] });
  e = err(await quote([{ sku: 'tee' }]), 403, 'daily_limit_exceeded');
  assert.equal(e.message, '24h spend would be $1005 > limit $1000.');
  fresh({ spent: [900, 75] });
  assert.equal((await quote([{ sku: 'tee' }])).status, 201);
  assert.deepEqual(S.filters, [['eq', 'agent_key_id', 'k1'], ['gte', 'created_at', new Date(NOW - 86_400_000).toISOString()], ['not', 'status', 'in', '(cancelled,expired,failed)']]);
});

test('the quote needs the quote scope before anything is priced', async () => {
  err(await quote([{ sku: 'tee' }], { ...KEY, scopes: ['order'] }), 403, 'scope_missing');
  assert.equal(S.quotes.length, 0);
});

// ---------- next_action in the order view ----------
const ORDER = { public_id: 'VCH-7', status: 'awaiting_payment', payment_rail: 'crypto', total_usd: 25, items: [{ sku: 'tee', kind: 'merch' }], payment: {} };
const next = (over) => view({ ...ORDER, ...over }).next_action;

test('awaiting PayPal payment: approve, then capture', () => {
  const a = next({ payment_rail: 'paypal', payment: { approve_url: 'https://pp/approve' } });
  assert.deepEqual([a.type, a.url], ['approve_paypal', 'https://pp/approve']);
  assert.match(a.then, /^POST .*\/v1\/orders\/VCH-7\/capture$/);
  assert.equal(next({ payment_rail: 'paypal', payment: null }).url, undefined);
});

test('awaiting crypto payment: the exact amount, the Hub wallets (EVM ones with their networks) and the polling hint', () => {
  const v = view({ ...ORDER, payment: { crypto: { amount_due: '25.001234' } } });
  const a = v.next_action;
  assert.deepEqual([a.type, a.amount_due, a.exact_amount_required, a.auto_detect], ['send_stablecoin', '25.001234', true, true]);
  assert.match(a.note, /^Send EXACTLY amount_due \(the last 4 digits are a unique order tag\)/);
  assert.match(a.then, /payment-proof \{chain, tx_hash, network\?\}\. Poll GET .*\/v1\/orders\/VCH-7\/status until paid\/fulfilling\.$/);
  assert.ok(a.options.length > 0);
  a.options.forEach((w, i) => {
    const base = v.payment.options[i];
    if (base.chain === 'evm') { assert.ok(w.networks.length > 0); assert.deepEqual({ ...w, networks: undefined }, { ...base, networks: undefined }); } else assert.deepEqual(w, base);
  });
  assert.equal(next({ payment: null, total_usd: 25.5 }).amount_due, '25.500000');
  assert.equal(next({ payment: { crypto: { amount_due: 25 } } }).amount_due, '25.000000');
});

test('payment review: poll while confirmations are pending, otherwise wait for the operator', () => {
  const polling = next({ status: 'payment_review', payment: { proof: { verification: 'pending_confirmations', detail: '1/12' } } });
  assert.deepEqual([polling.type, polling.detail], ['poll_verify', '1/12']);
  assert.match(polling.then, /^POST .*\/v1\/orders\/VCH-7\/verify \(retry in ~60s\)$/);
  assert.equal(next({ status: 'payment_review', payment: { proof: { verification: 'pending_confirmations' } } }).detail, null);
  for (const payment of [{}, null, { proof: { verification: 'manual' } }]) {
    assert.deepEqual(next({ status: 'payment_review', payment }), { type: 'wait', note: 'Payment submitted; the operator verifies it manually (usually within 24h).' });
  }
});

test('paid and fulfilling orders wait', () => {
  for (const status of ['paid', 'fulfilling']) assert.deepEqual(next({ status }), { type: 'wait', note: 'Paid. Fulfillment in progress; poll the status endpoint.' });
});

test('completed: a thank-you for donations only (an empty order counts), nothing to do otherwise', () => {
  const thanks = { type: 'none', note: 'Donation received and verified on-chain. Thank you. The receipt is in fulfillment.receipt.' };
  assert.deepEqual(next({ status: 'completed', items: [{ kind: 'donation' }, { kind: 'donation' }] }), thanks);
  assert.deepEqual(next({ status: 'completed', items: [] }), thanks);
  assert.deepEqual(next({ status: 'completed', items: undefined }), thanks);
  assert.deepEqual(next({ status: 'completed', items: [{ kind: 'donation' }, { kind: 'merch' }] }), { type: 'none' });
});

test('every other state has nothing to do', () => {
  for (const status of ['failed', 'expired', 'cancelled', 'refunded']) assert.deepEqual(next({ status }), { type: 'none' }, status);
  assert.deepEqual(next({ payment_rail: 'wire' }), { type: 'none' });
  assert.deepEqual(next({ status: 'awaiting_payment', payment_rail: undefined }), { type: 'none' });
});
