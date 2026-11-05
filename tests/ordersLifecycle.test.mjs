// Characterization of the order lifecycle after creation: createDonation, captureOrder (PayPal), submitProof, verifyOrder,
// runVerification (through them, recheckOrder and settleFromScan) and retryFulfilment, against a scripted database,
// a scripted on-chain verdict and a scripted PayPal / Printful / webhook.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { loadOrders } from './helpers/loadOrders.mjs';

const O = await loadOrders();
const { createDonation, captureOrder, submitProof, verifyOrder, recheckOrder, settleFromScan, retryFulfilment } = O.mod;

const KEY = { id: 'k1', owner_id: 'own1', name: 'bot', scopes: ['quote', 'order'], max_order_usd: 500, max_daily_usd: 1000, allowed_kinds: ['merch', 'donation'] };
const IDEM = 'idem-12345678';
const EVM_TX = '0x' + 'AB'.repeat(32);
const TRON_TX = 'cd'.repeat(32);
const SOL_TX = '5'.repeat(88);
const MERCH = { kind: 'merch', title: 'Tee', quantity: 2, extra: { sync_variant_id: 77 } };
const DOM = { kind: 'domain', title: 'Domain', quantity: 1 };
const DON = { kind: 'donation', title: 'Donation', quantity: 1, extra: { donor: { name: 'Ann' }, message: 'gg' } };
const SHIP = { name: 'A B', address1: '1 Main', city: 'Vice City', zip: '33101', country_code: 'US' };

let S;
const order = (over = {}) => ({
  id: 'oid', public_id: 'VCH-1', agent_key_id: 'k1', owner_id: 'own1', status: 'awaiting_payment', payment_rail: 'crypto', total_usd: 25, created_at: '2026-10-29T12:00:00Z',
  expires_at: '2099-01-01T00:00:00Z', updated_at: 'u0', items: [MERCH], shipping: SHIP, delivery: { wallet_address: 'w' }, payment: { crypto: { tag: 42, amount_due: '25.000042' } }, fulfillment: null, ...over,
});

function fresh(over = {}) {
  S = {
    order: order(), existing: null, again: null, spent: [], insertError: null, claimError: null, claimRow: undefined, casLost: false, cur: null, mine: { id: 'oid' },
    updates: [], inserts: [], claims: [], deletes: [], claimReads: 0, notified: [], fetches: [], verifyArgs: [], verdict: { state: 'error', detail: 'x' },
    capture: { ok: true, body: {} }, pfFind: null, pfCreate: { ok: true, body: { result: { id: 555 } } }, ...over,
  };
  O.env.NOTIFY_WEBHOOK_URL = 'https://hook.test/x';
  O.env.PAYPAL_CLIENT_ID = 'id'; O.env.PAYPAL_CLIENT_SECRET = 'sec';
  O.env.PRINTFUL_API_TOKEN = 'pf';
  O.verifyCrypto = async (a) => { S.verifyArgs.push(a); return S.verdict; };
  globalThis.fetch = async (url, init) => {
    url = String(url);
    S.fetches.push([url, init]);
    if (url.startsWith('https://hook.test')) { S.notified.push(JSON.parse(init.body).content); return { ok: true }; }
    if (url.endsWith('/v1/oauth2/token')) return { ok: true, json: async () => ({ access_token: 'tok' }) };
    if (url.endsWith('/capture')) return { ok: S.capture.ok, status: S.capture.status || 200, json: async () => S.capture.body };
    if (url.includes('api.printful.com/orders/@')) return S.pfFind ? { ok: true, json: async () => ({ result: { id: S.pfFind } }) } : { ok: false };
    if (url.includes('api.printful.com/orders?')) return { ok: S.pfCreate.ok, status: S.pfCreate.status || 200, json: async () => S.pfCreate.body };
    throw new Error('unexpected fetch ' + url);
  };
  O.route = (c) => {
    const eq = (col) => (c.filters.find((f) => f[0] === 'eq' && f[1] === col) || [])[2];
    if (c.table === 'agent_tx_claims') {
      if (c.op === 'insert') { S.claims.push(c.payload); return { error: S.claimError }; }
      if (c.op === 'delete') { S.deletes.push(c.filters.map((f) => f.join(':'))); return { error: null }; }
      S.claimReads++; return { data: S.claimRow === undefined ? { order_id: 'oid' } : S.claimRow };
    }
    if (c.table !== 'agent_orders') return { data: null, error: null };
    if (c.op === 'insert') { S.inserts.push(c.payload); return S.insertError ? { data: null, error: S.insertError } : { data: { id: 'oid', public_id: 'VCH-D', status: 'awaiting_payment', created_at: 'c', ...c.payload }, error: null }; }
    if (c.op === 'update') {
      S.updates.push({ payload: c.payload, filters: c.filters.map((f) => f.join(':')) });
      if (c.cols === 'id') return { data: S.mine };
      if (c.single === 'maybeSingle') return { data: S.casLost ? null : { ...S.order, ...c.payload } };
      return { data: { ...S.order, ...c.payload }, error: null };
    }
    if (eq('public_id')) return { data: S.order };
    if (eq('idempotency_key')) { const first = !S.inserts.length; return { data: first ? S.existing : S.again }; }
    if (c.cols === 'total_usd') return { data: S.spent.map((t) => ({ total_usd: t })) };
    if (eq('id')) return { data: S.cur };
    return { data: [] }; // allocateCryptoTag: no clash
  };
}
beforeEach(() => fresh());

const err = (r, status, code) => { assert.equal(r.status, status); assert.equal(r.body.error.code, code); return r.body.error; };
const lastUpdate = () => S.updates[S.updates.length - 1];

// ───────────────────────── createDonation ─────────────────────────
const DBODY = { authorized_by_principal: true, amount_usd: 12.5 };
const donate = (body = DBODY, idem = IDEM, key = KEY) => createDonation(key, body, idem);

test('donation: scope, kind and idempotency key are checked first, in that order', async () => {
  err(await donate(DBODY, IDEM, { ...KEY, scopes: ['quote'], allowed_kinds: [] }), 403, 'scope_missing');
  err(await donate(DBODY, IDEM, { ...KEY, allowed_kinds: ['merch'] }), 403, 'kind_not_allowed');
  for (const bad of [null, '', 'short', 'x'.repeat(129)]) err(await donate(DBODY, bad), 400, 'idempotency_key_required');
  assert.equal((await donate(DBODY, 'x'.repeat(8))).status, 201);
  assert.equal((await donate(DBODY, 'x'.repeat(128))).status, 201);
});

test('donation: same idempotency key replays the stored order before anything else is validated', async () => {
  fresh({ existing: order({ public_id: 'VCH-9' }) });
  const r = await donate({});
  assert.equal(r.status, 200);
  assert.equal(r.headers['Idempotent-Replayed'], 'true');
  assert.equal(r.body.id, 'VCH-9');
  assert.ok('shipping' in r.body);
  assert.deepEqual(S.inserts, []);
});

test('donation: the principal must have authorised it explicitly (only literal true)', async () => {
  for (const v of [undefined, false, 'true', 1, null]) {
    const e = err(await donate({ authorized_by_principal: v, amount_usd: 5 }), 422, 'authorization_required');
    assert.match(e.hint, /GET \/v1\/donate/);
  }
  err(await createDonation(KEY, undefined, IDEM), 422, 'authorization_required');
});

test('donation: amount must be 1..1000000 with at most 2 decimals', async () => {
  for (const a of [undefined, null, 'abc', NaN, Infinity, 0.5, 0, -3, 1_000_000.01, 1e9, 1.234, 2.005]) {
    err(await donate({ authorized_by_principal: true, amount_usd: a }), 422, 'invalid_amount');
  }
  const e = err(await donate({ authorized_by_principal: true }), 422, 'invalid_amount');
  assert.equal(e.message, 'amount_usd must be a number between 1 and 1000000 with at most 2 decimals.');
  for (const a of [1, '5', 12.5, 99.99]) assert.equal((await donate({ authorized_by_principal: true, amount_usd: a }, IDEM, { ...KEY, max_order_usd: 1e7, max_daily_usd: 1e7 })).status, 201);
  assert.equal((await donate({ authorized_by_principal: true, amount_usd: 1_000_000 }, IDEM, { ...KEY, max_order_usd: 1e7, max_daily_usd: 1e7 })).status, 201);
});

test('donation: per-order and 24h limits apply', async () => {
  err(await donate({ authorized_by_principal: true, amount_usd: 501 }), 403, 'limit_exceeded');
  fresh({ spent: [900] });
  err(await donate({ authorized_by_principal: true, amount_usd: 101 }), 403, 'daily_limit_exceeded');
  assert.equal((await donate({ authorized_by_principal: true, amount_usd: 100 })).status, 201);
});

test('donation: stored as a crypto order with a unique tag; response carries the purpose', async () => {
  const r = await donate({ authorized_by_principal: true, amount_usd: 12.5, donor: { name: '  Ann ', agent: 'x'.repeat(200), operator: 5 }, message: ' m '.repeat(300) });
  assert.equal(r.status, 201);
  const row = S.inserts[0];
  assert.deepEqual({ ...row, payment: undefined, items: undefined }, { agent_key_id: 'k1', owner_id: 'own1', idempotency_key: IDEM, items: undefined, total_usd: 12.5, payment_rail: 'crypto', shipping: null, delivery: null, payment: undefined });
  assert.deepEqual(Object.keys(row.payment), ['crypto']);
  assert.ok(row.payment.crypto.tag >= 1 && row.payment.crypto.tag <= 9999);
  assert.match(row.payment.crypto.amount_due, /^12\.50\d{4}$/);
  const [line] = row.items;
  assert.deepEqual({ ...line, extra: undefined }, { sku: 'donation:ai-development', kind: 'donation', title: 'Donation - AI development', quantity: 1, unit_usd: 12.5, line_usd: 12.5, extra: undefined });
  assert.deepEqual(line.extra.donor, { name: 'Ann', agent: 'x'.repeat(120), operator: null });
  assert.equal(line.extra.message.length, 500);
  assert.match(r.body.purpose, /^Donations go to developing AI projects/);
  assert.equal(r.body.id, 'VCH-D');
  assert.ok(!('extra' in r.body.items[0]));
});

test('donation: blank or missing donor fields and message become null', async () => {
  await donate({ authorized_by_principal: true, amount_usd: 3, donor: { name: '   ', agent: 7 }, message: '  ' });
  assert.deepEqual(S.inserts[0].items[0].extra, { donor: { name: null, agent: null, operator: null }, message: null });
  await donate({ authorized_by_principal: true, amount_usd: 3 });
  assert.deepEqual(S.inserts[1].items[0].extra, { donor: { name: null, agent: null, operator: null }, message: null });
});

test('donation: unique violation replays the concurrent winner; any other insert error -> 500', async () => {
  fresh({ insertError: { code: '23505' }, again: order({ public_id: 'VCH-W' }) });
  const r = await donate();
  assert.deepEqual([r.status, r.body.id, r.headers['Idempotent-Replayed']], [200, 'VCH-W', 'true']);
  fresh({ insertError: { code: '23505' }, again: null });
  err(await donate(), 500, 'db_error');
  fresh({ insertError: { code: '42P01' }, again: order() });
  err(await donate(), 500, 'db_error');
  fresh({ insertError: { message: 'boom' } });
  assert.equal(err(await donate(), 500, 'db_error').message, 'Could not create the donation.');
});

// ───────────────────────── captureOrder ─────────────────────────
const PP = (over = {}) => order({ payment_rail: 'paypal', payment: { paypal_order_id: 'PP1', approve_url: 'https://pp/approve' }, ...over });
const GOOD = { purchase_units: [{ custom_id: 'VCH-1', payments: { captures: [{ id: 'CAP1', status: 'COMPLETED', amount: { currency_code: 'USD', value: '25.00' } }] } }], payer: { email_address: 'p@x.co' } };
const clone = (o) => JSON.parse(JSON.stringify(o));

test('capture: unknown order 404, non-PayPal 422, settled orders are returned without calling PayPal', async () => {
  fresh({ order: null });
  err(await captureOrder('nope'), 404, 'order_not_found');
  fresh({ order: order() });
  err(await captureOrder('VCH-1'), 422, 'wrong_rail');
  for (const st of ['paid', 'fulfilling', 'completed', 'payment_review']) {
    fresh({ order: PP({ status: st }) });
    const r = await captureOrder('VCH-1');
    assert.deepEqual([r.status, r.body.status], [200, st]);
    assert.equal(S.fetches.length, 0);
  }
  for (const st of ['cancelled', 'expired', 'failed']) {
    fresh({ order: PP({ status: st }) });
    assert.equal(err(await captureOrder('VCH-1'), 409, 'bad_state').message, `Order is ${st}.`);
  }
});

test('capture: an awaiting order past its expiry is expired by the loader and refused', async () => {
  fresh({ order: PP({ expires_at: '2001-01-01T00:00:00Z' }) });
  err(await captureOrder('VCH-1'), 409, 'bad_state');
  assert.equal(lastUpdate().payload.status, 'expired');
});

test('capture: PayPal refusal maps to 409 (not approved) or 502 (issue, then HTTP status)', async () => {
  fresh({ order: PP(), capture: { ok: false, body: { details: [{ issue: 'ORDER_NOT_APPROVED' }] } } });
  const e = err(await captureOrder('VCH-1'), 409, 'payment_not_approved');
  assert.match(e.hint, /payment\.approve_url/);
  fresh({ order: PP(), capture: { ok: false, body: { details: [{ issue: 'INSTRUMENT_DECLINED' }] } } });
  assert.equal(err(await captureOrder('VCH-1'), 502, 'paypal_error').message, 'PayPal capture failed (INSTRUMENT_DECLINED).');
  fresh({ order: PP(), capture: { ok: false, status: 500, body: {} } });
  assert.equal(err(await captureOrder('VCH-1'), 502, 'paypal_error').message, 'PayPal capture failed (500).');
  assert.deepEqual(S.updates, []);
  const [url, init] = S.fetches[1];
  assert.equal(url, 'https://api-m.paypal.com/v2/checkout/orders/PP1/capture');
  assert.equal(init.headers.Authorization, 'Bearer tok');
  assert.equal(init.headers['PayPal-Request-Id'], 'cap-VCH-1');
});

test('capture: missing PayPal credentials surface as an error', async () => {
  fresh({ order: PP() });
  O.env.PAYPAL_CLIENT_ID = undefined;
  await assert.rejects(captureOrder('VCH-1'), /PayPal credentials are not configured/);
});

test('capture: anything but a clean COMPLETED / USD / exact amount / matching custom_id goes to manual review', async () => {
  const variants = {
    'no capture': (g) => { g.purchase_units[0].payments.captures = []; },
    'no purchase unit': (g) => { g.purchase_units = []; },
    'pending': (g) => { g.purchase_units[0].payments.captures[0].status = 'PENDING'; },
    'currency': (g) => { g.purchase_units[0].payments.captures[0].amount.currency_code = 'EUR'; },
    'amount': (g) => { g.purchase_units[0].payments.captures[0].amount.value = '24.99'; },
    'custom_id': (g) => { g.purchase_units[0].custom_id = 'VCH-2'; },
    'no payer': (g) => { delete g.payer; },
  };
  for (const [name, mut] of Object.entries(variants)) {
    const g = clone(GOOD); mut(g);
    fresh({ order: PP(), capture: { ok: true, body: g } });
    const r = await captureOrder('VCH-1');
    const u = lastUpdate().payload;
    if (name === 'no payer') { // still a clean match: payer email is only recorded
      assert.equal(u.status, 'fulfilling', name);
      assert.equal(u.payment.payer_email, null);
      continue;
    }
    assert.equal(r.status, 200, name);
    assert.equal(u.status, 'payment_review', name);
    assert.deepEqual(Object.keys(u).sort(), ['payment', 'status', 'updated_at'], name);
    assert.equal(S.notified.length, 1, name);
    assert.match(S.notified[0], /VCH order needs manual review\*\*\nVCH-1: PayPal capture is not a clean COMPLETED\/amount match\./, name);
    assert.equal(S.fetches.filter(([u2]) => u2.includes('printful')).length, 0, name);
  }
  fresh({ order: PP(), capture: { ok: true, body: { ...clone(GOOD), purchase_units: [] } } });
  await captureOrder('VCH-1');
  assert.equal(lastUpdate().payload.payment.capture_id, undefined);
});

test('capture: amount within half a cent is accepted', async () => {
  const g = clone(GOOD); g.purchase_units[0].payments.captures[0].amount.value = '25.004';
  fresh({ order: PP(), capture: { ok: true, body: g } });
  await captureOrder('VCH-1');
  assert.equal(lastUpdate().payload.status, 'fulfilling');
});

test('capture: clean payment on a merch order starts fulfilment and records capture details', async () => {
  fresh({ order: PP({ fulfillment: { keep: 1 } }), capture: { ok: true, body: clone(GOOD) } });
  const r = await captureOrder('VCH-1');
  assert.equal(r.status, 200);
  const u = lastUpdate().payload;
  assert.equal(u.status, 'fulfilling');
  assert.deepEqual(u.fulfillment, { keep: 1, printful_order_id: 555, printful_state: 'submitted for fulfillment' });
  assert.deepEqual([u.payment.paypal_order_id, u.payment.capture_id, u.payment.payer_email], ['PP1', 'CAP1', 'p@x.co']);
  assert.ok(Date.parse(u.payment.captured_at));
  assert.match(S.notified[0], /VCH agent order PAID\*\*\nVCH-1 — \$25\nItems: 2× Tee\nFulfilment started\.$/);
  const pf = S.fetches.find(([x]) => x.includes('api.printful.com/orders?'));
  assert.equal(JSON.parse(pf[1].body).items[0].sync_variant_id, 77);
});

test('capture: Printful failure keeps the order paid and reports the error', async () => {
  fresh({ order: PP(), capture: { ok: true, body: clone(GOOD) }, pfCreate: { ok: false, status: 429, body: { error: { message: 'rate' } } } });
  await captureOrder('VCH-1');
  const u = lastUpdate().payload;
  assert.deepEqual([u.status, u.fulfillment], ['paid', { printful_error: 'Printful: rate' }]);
  assert.match(S.notified[0], /Printful error: Printful: rate$/);
  fresh({ order: PP(), capture: { ok: true, body: clone(GOOD) } });
  O.env.PRINTFUL_API_TOKEN = undefined;
  await captureOrder('VCH-1');
  assert.equal(lastUpdate().payload.fulfillment.printful_error, 'PRINTFUL_API_TOKEN missing');
});

test('capture: an order without merch skips Printful but still ends up "fulfilling"', async () => {
  fresh({ order: PP({ items: [DOM] }), capture: { ok: true, body: clone(GOOD) } });
  await captureOrder('VCH-1');
  const u = lastUpdate().payload;
  assert.deepEqual([u.status, u.fulfillment], ['fulfilling', {}]);
  assert.equal(S.fetches.filter(([x]) => x.includes('printful')).length, 0);
});

// ───────────────────────── submitProof ─────────────────────────
const proof = (body, id = 'VCH-1', key = KEY) => submitProof(key, id, body);
const TXB = { chain: 'evm', tx_hash: EVM_TX };

test('proof: ownership, rail and state', async () => {
  fresh({ order: null });
  err(await proof(TXB), 404, 'order_not_found');
  fresh({ order: order({ agent_key_id: 'other', owner_id: 'else' }) });
  err(await proof(TXB), 404, 'order_not_found');
  fresh({ order: order({ agent_key_id: 'other', owner_id: 'own1' }) }); // same human owner may act
  assert.notEqual((await proof(TXB)).status, 404);
  fresh({ order: PP() });
  err(await proof(TXB), 422, 'wrong_rail');
  for (const st of ['paid', 'cancelled', 'fulfilling']) {
    fresh({ order: order({ status: st }) });
    assert.equal(err(await proof(TXB), 409, 'bad_state').message, `Order is ${st}.`);
  }
});

test('proof: chain and tx hash format are validated per chain', async () => {
  for (const b of [undefined, {}, { chain: 'btc', tx_hash: EVM_TX }]) assert.match(err(await proof(b), 422, 'invalid_chain').message, /^chain must be one of: tron, evm, solana$/);
  const bad = [['tron', '0x' + TRON_TX], ['tron', 'ab'], ['evm', TRON_TX], ['evm', '0x' + 'g'.repeat(64)], ['solana', 'short'], ['solana', '0'.repeat(70)], ['evm', undefined]];
  for (const [chain, tx_hash] of bad) err(await proof({ chain, tx_hash }), 422, 'invalid_tx_hash');
  for (const b of [{ chain: 'tron', tx_hash: TRON_TX }, { chain: 'evm', tx_hash: EVM_TX }, { chain: 'solana', tx_hash: SOL_TX }, { chain: 'evm', tx_hash: `  ${EVM_TX} ` }]) {
    fresh({ verdict: { state: 'pending', network: 'x', detail: 'd' } });
    assert.equal((await proof(b)).status, 202);
  }
});

test('proof: the EVM network must be known (case-insensitive); other chains ignore it', async () => {
  assert.match(err(await proof({ ...TXB, network: 'dogechain' }), 422, 'invalid_network').message, /^network must be one of: polygon, ethereum, base, arbitrum, optimism$/);
  fresh({ verdict: { state: 'pending', network: 'base', detail: 'd' } });
  await proof({ ...TXB, network: 'BASE' });
  assert.equal(S.verifyArgs[0].network, 'base');
  fresh({ verdict: { state: 'pending', network: 'x', detail: 'd' } });
  await proof({ chain: 'tron', tx_hash: TRON_TX, network: 'whatever' });
  assert.equal(S.verifyArgs[0].network, 'whatever');
  fresh({ verdict: { state: 'pending', network: 'x', detail: 'd' } });
  await proof({ ...TXB, network: '' });
  assert.equal(S.verifyArgs[0].network, undefined);
});

test('proof: the tx hash is claimed (lower-cased except on Solana); replay protection', async () => {
  fresh({ verdict: { state: 'pending', network: 'x', detail: 'd' } });
  await proof(TXB);
  await proof({ chain: 'solana', tx_hash: SOL_TX });
  await proof({ chain: 'tron', tx_hash: TRON_TX.toUpperCase() });
  assert.deepEqual(S.claims, [{ chain: 'evm', tx_hash: EVM_TX.toLowerCase(), order_id: 'oid' }, { chain: 'solana', tx_hash: SOL_TX, order_id: 'oid' }, { chain: 'tron', tx_hash: TRON_TX, order_id: 'oid' }]);
  fresh({ claimError: { code: '23505' }, claimRow: { order_id: 'oid' }, verdict: { state: 'pending', network: 'x', detail: 'd' } });
  assert.equal((await proof(TXB)).status, 202); // same order re-submitting its own tx
  fresh({ claimError: { code: '23505' }, claimRow: { order_id: 'other' } });
  err(await proof(TXB), 409, 'tx_already_used');
  fresh({ claimError: { code: '23505' }, claimRow: null });
  err(await proof(TXB), 409, 'tx_already_used');
  fresh({ claimError: { code: '08006' } });
  err(await proof(TXB), 500, 'db_error');
  assert.equal(S.claimReads, 0);
  assert.deepEqual(S.verifyArgs, []);
});

test('proof: request_manual_review stores the proof and alerts the operator without verifying on-chain', async () => {
  const r = await proof({ ...TXB, network: 'Polygon', note: 'n'.repeat(400), request_manual_review: true });
  assert.equal(r.status, 200);
  const u = lastUpdate().payload;
  assert.equal(u.status, 'payment_review');
  assert.deepEqual({ ...u.payment.proof, submitted_at: 0 }, { chain: 'evm', network: 'polygon', tx_hash: EVM_TX, note: 'n'.repeat(300), submitted_at: 0, verification: 'manual' });
  assert.deepEqual(u.payment.crypto, { tag: 42, amount_due: '25.000042' });
  assert.equal(S.verifyArgs.length, 0);
  assert.equal(S.notified.length, 1);
  assert.match(S.notified[0], /^\*\*VCH crypto payment submitted \(manual review\)\*\*\nVCH-1 — \$25\nchain=evm\ntx=0xABAB.*\nItems: Tee\nDelivery: \{"wallet_address":"w"\}$/);
  assert.equal(r.body.payment.proof.verification, 'manual');
  fresh();
  await proof({ ...TXB, request_manual_review: 'yes' }); // only literal true opts out
  assert.equal(S.verifyArgs.length, 1);
  fresh();
  await proof({ ...TXB, request_manual_review: true });
  assert.equal(lastUpdate().payload.payment.proof.note, null);
  assert.equal(lastUpdate().payload.payment.proof.network, null);
});

// ───────────────────────── verifyOrder ─────────────────────────
const verify = (id = 'VCH-1') => verifyOrder(KEY, id);

test('verify: ownership, rail, settled / manual short-circuits, missing proof and state', async () => {
  fresh({ order: null });
  err(await verify(), 404, 'order_not_found');
  fresh({ order: PP() });
  err(await verify(), 422, 'wrong_rail');
  for (const st of ['paid', 'fulfilling', 'completed']) {
    fresh({ order: order({ status: st }) });
    assert.equal((await verify()).body.status, st);
  }
  fresh({ order: order({ payment: { crypto: {} } }) });
  err(await verify(), 409, 'no_payment_proof');
  fresh({ order: order({ payment: { proof: {} } }) });
  err(await verify(), 409, 'no_payment_proof');
  fresh({ order: order({ status: 'payment_review', payment: { proof: { tx_hash: 't', verification: 'manual' } } }) });
  assert.equal((await verify()).status, 200);
  fresh({ order: order({ status: 'cancelled', payment: { proof: { tx_hash: 't', chain: 'evm' } } }) });
  err(await verify(), 409, 'bad_state');
  assert.equal(S.verifyArgs.length, 0);
});

// ───────────────────────── runVerification (via verifyOrder / recheck / scan) ─────────────────────────
const withProof = (over = {}, p = {}) => order({ payment: { crypto: { tag: 42, amount_due: '25.000042' }, proof: { chain: 'evm', network: 'base', tx_hash: EVM_TX, ...p }, ...over.payment }, ...over, payment: { crypto: { tag: 42, amount_due: '25.000042' }, proof: { chain: 'evm', network: 'base', tx_hash: EVM_TX, ...p } } });
const CONFIRMED = { state: 'confirmed', network: 'base', paid_units: '25000042', block_time: '2026-10-29T12:05:00Z' };

test('verification: the on-chain check receives the exact tagged amount and order creation time', async () => {
  fresh({ order: withProof(), verdict: { state: 'pending', network: 'base', detail: 'd' } });
  await verify();
  assert.deepEqual(S.verifyArgs, [{ chain: 'evm', tx: EVM_TX, network: 'base', due: 25_000_042n, createdAtMs: Date.parse('2026-10-29T12:00:00Z') }]);
  fresh({ order: withProof({ payment: undefined }, { network: null }), verdict: { state: 'pending', network: 'base', detail: 'd' } });
  S.order.payment.crypto = undefined;
  await verify();
  assert.deepEqual([S.verifyArgs[0].due, S.verifyArgs[0].network], [25_000_000n, undefined]);
});

test('verification: pending -> 202, order parked in payment_review with the detail', async () => {
  fresh({ order: withProof(), verdict: { state: 'pending', network: 'base', detail: '3/20 confirmations' } });
  const r = await verify();
  assert.equal(r.status, 202);
  const u = lastUpdate();
  assert.equal(u.payload.status, 'payment_review');
  assert.deepEqual({ ...u.payload.proof, ...u.payload.payment.proof, checked_at: 0 }.verification, 'pending_confirmations');
  assert.deepEqual({ ...u.payload.payment.proof, checked_at: 0 }, { chain: 'evm', network: 'base', tx_hash: EVM_TX, verification: 'pending_confirmations', detail: '3/20 confirmations', checked_at: 0 });
  assert.deepEqual(u.payload.payment.crypto, { tag: 42, amount_due: '25.000042' });
  assert.equal(u.payload.updated_at, u.payload.payment.proof.checked_at);
  assert.equal(r.body.next_action.type, 'poll_verify');
  assert.equal(S.deletes.length, 0);
});

test('verification: not_found / mismatch / unavailable release the tx claim and map to 409 / 422 / 503', async () => {
  fresh({ order: withProof(), verdict: { state: 'not_found', detail: 'tx not found' } });
  assert.equal(err(await verify(), 409, 'tx_not_found').message, 'tx not found.');
  assert.deepEqual(S.deletes, [['eq:chain:evm', 'eq:tx_hash:' + EVM_TX.toLowerCase(), 'eq:order_id:oid']]);
  fresh({ order: withProof(), verdict: { state: 'mismatch', detail: 'amount differs' } });
  const e = err(await verify(), 422, 'payment_mismatch');
  assert.equal(e.message, 'amount differs.');
  assert.match(e.hint, /^Send exactly the order's amount_due, or resubmit with request_manual_review=true \/ email vicecityhub@proton\.me quoting VCH-1\.$/);
  assert.equal(S.deletes.length, 1);
  for (const v of [{ state: 'error', detail: 'rpc down' }, { state: 'weird' }]) {
    fresh({ order: withProof(), verdict: v });
    err(await verify(), 503, 'verification_unavailable');
    assert.equal(S.deletes.length, 1);
  }
  assert.deepEqual(S.updates, []);
  fresh({ order: withProof({}, { chain: 'solana', tx_hash: SOL_TX }), verdict: { state: 'mismatch', detail: 'd' } });
  await verify();
  assert.deepEqual(S.deletes, [['eq:chain:solana', 'eq:tx_hash:' + SOL_TX, 'eq:order_id:oid']]);
});

test('confirmed: the settle step is a compare-and-swap on the open states; a lost race returns the current order untouched', async () => {
  fresh({ order: withProof({ status: 'payment_review' }), verdict: CONFIRMED });
  await verify();
  assert.deepEqual(S.updates[0].filters.filter((f) => f.startsWith('in:')), ['in:status:awaiting_payment,payment_review']);
  assert.equal(S.updates[0].payload.status, 'paid');
  fresh({ order: withProof(), verdict: CONFIRMED, casLost: true, cur: order({ status: 'fulfilling', public_id: 'VCH-1' }) });
  const r = await verify();
  assert.deepEqual([r.status, r.body.status], [200, 'fulfilling']);
  assert.equal(S.updates.length, 1);
  assert.equal(S.notified.length, 0);
  assert.equal(S.fetches.length, 0);
  fresh({ order: withProof(), verdict: CONFIRMED, casLost: true, cur: null });
  assert.equal((await verify()).body.status, 'awaiting_payment');
});

test('confirmed merch order: proof is stamped, Printful is created, order moves to fulfilling', async () => {
  fresh({ order: withProof({}, { note: 'n' }), verdict: CONFIRMED });
  const r = await verify();
  assert.equal(r.status, 200);
  const [settle, finish] = S.updates;
  assert.equal(settle.payload.status, 'paid');
  assert.deepEqual({ ...settle.payload.payment.proof, verified_at: 0 }, { chain: 'evm', network: 'base', tx_hash: EVM_TX, note: 'n', verification: 'confirmed', verified: true, verified_at: 0, paid_units: '25000042', block_time: '2026-10-29T12:05:00Z' });
  assert.deepEqual(settle.payload.fulfillment, {});
  assert.deepEqual(finish.payload.fulfillment, { printful_order_id: 555, printful_state: 'submitted for fulfillment' });
  assert.equal(finish.payload.status, 'fulfilling');
  assert.deepEqual(Object.keys(finish.payload).sort(), ['fulfillment', 'status', 'updated_at']);
  assert.match(S.notified[0], /^\*\*VCH crypto order PAID \(auto-verified\)\*\*\nVCH-1 — \$25\nnetwork=base\ntx=0xABAB.*\nItems: 2× Tee\nDelivery: \{"wallet_address":"w"\}\nPrintful order created \(submitted for fulfillment\)\. $/);
});

test('confirmed merch order: a Printful failure leaves it paid and is flagged to the operator', async () => {
  fresh({ order: withProof(), verdict: CONFIRMED, pfCreate: { ok: false, status: 500, body: {} } });
  await verify();
  assert.deepEqual([lastUpdate().payload.status, lastUpdate().payload.fulfillment], ['paid', { printful_error: 'Printful: 500' }]);
  assert.match(S.notified[0], /Printful error: Printful: 500 $/);
});

test('confirmed manual-delivery order (domain / slot): paid with an operator note and an ACTION line', async () => {
  fresh({ order: withProof({ items: [DOM] }), verdict: CONFIRMED });
  await verify();
  const f = lastUpdate().payload.fulfillment;
  assert.equal(lastUpdate().payload.status, 'paid');
  assert.equal(f.note, 'Payment verified on-chain automatically. Delivery (domain transfer / slot activation) is done by the operator, usually within 24h.');
  assert.match(S.notified[0], /Items: 1× Domain\nDelivery: .*\nACTION: deliver the item\.$/);
  assert.equal(S.fetches.filter(([x]) => x.includes('printful')).length, 0);
});

test('confirmed mixed merch + manual order stays paid even when Printful succeeds', async () => {
  fresh({ order: withProof({ items: [MERCH, DOM] }), verdict: CONFIRMED });
  await verify();
  assert.equal(lastUpdate().payload.status, 'paid');
  assert.equal(lastUpdate().payload.fulfillment.printful_order_id, 555);
  assert.ok(lastUpdate().payload.fulfillment.note);
  assert.match(S.notified[0], /Printful order created \(submitted for fulfillment\)\. ACTION: deliver the item\.$/);
});

test('confirmed donation: completed with a receipt, owner told about the donor', async () => {
  fresh({ order: withProof({ items: [DON], fulfillment: { keep: 1 } }), verdict: CONFIRMED });
  const r = await verify();
  const u = lastUpdate().payload;
  assert.equal(u.status, 'completed');
  assert.equal(u.fulfillment.keep, 1);
  assert.deepEqual({ ...u.fulfillment.receipt, verified_at: 0 }, { type: 'donation', reference: 'VCH-1', amount_usd: 25, currency: 'USD', network: 'base', tx_hash: EVM_TX, verified_at: 0, purpose: u.fulfillment.receipt.purpose });
  assert.match(u.fulfillment.receipt.purpose, /^Donations go to developing AI projects/);
  assert.match(u.fulfillment.note, /^Thank you! Your donation was received and verified on-chain\./);
  assert.equal(S.notified[0], `**VCH DONATION received (auto-verified)**\nVCH-1 — $25\nnetwork=base\ntx=${EVM_TX}\nDonor: {"name":"Ann"}\nMessage: gg\nAgent key: k1`);
  assert.equal(r.body.next_action.type, 'none');
  fresh({ order: withProof({ items: [{ kind: 'donation', title: 'D', quantity: 1 }] }), verdict: CONFIRMED });
  await verify();
  assert.match(S.notified[0], /Donor: \{\}\nMessage: -\n/);
});

test('confirmed order with no items is paid, not a donation', async () => {
  fresh({ order: withProof({ items: [] }), verdict: CONFIRMED });
  await verify();
  assert.equal(lastUpdate().payload.status, 'paid');
  assert.ok(!('receipt' in lastUpdate().payload.fulfillment));
  assert.match(S.notified[0], /Items: \nDelivery: .*\n$/);
});

test('recheck: only an order waiting for confirmations is re-verified', async () => {
  assert.equal(await recheckOrder(order()), 'nothing_to_recheck');
  assert.equal(await recheckOrder(order({ payment: { proof: { verification: 'pending_confirmations' } } })), 'nothing_to_recheck');
  assert.equal(await recheckOrder(order({ payment: { proof: { tx_hash: 't', verification: 'manual' } } })), 'nothing_to_recheck');
  fresh({ verdict: { state: 'pending', network: 'base', detail: 'd' } });
  assert.equal(await recheckOrder(withProof({}, { verification: 'pending_confirmations' })), 'recheck -> HTTP 202');
  fresh({ verdict: CONFIRMED });
  assert.equal(await recheckOrder(withProof({}, { verification: 'pending_confirmations' })), 'recheck -> HTTP 200');
});

test('scan: claims the tx for this order, builds an auto-detected proof and runs full verification', async () => {
  fresh({ verdict: { state: 'pending', network: 'base', detail: 'd' } });
  assert.equal(await settleFromScan(order(), { chain: 'evm', network: 'base', tx: EVM_TX }), 'verification -> HTTP 202');
  assert.deepEqual(S.claims, [{ chain: 'evm', tx_hash: EVM_TX.toLowerCase(), order_id: 'oid' }]);
  assert.deepEqual(S.verifyArgs[0], { chain: 'evm', tx: EVM_TX, network: 'base', due: 25_000_042n, createdAtMs: Date.parse('2026-10-29T12:00:00Z') });
  const p = lastUpdate().payload.payment.proof;
  assert.deepEqual([p.note, p.auto_detected, p.network], ['auto-detected on-chain', true, 'base']);
  fresh({ verdict: { state: 'pending', network: 'x', detail: 'd' } });
  await settleFromScan(order(), { chain: 'tron', network: 'tron', tx: TRON_TX.toUpperCase() });
  assert.equal(S.claims[0].tx_hash, TRON_TX);
  assert.equal(S.verifyArgs[0].network, undefined);
  assert.equal(lastUpdate().payload.payment.proof.network, null);
  fresh({ verdict: { state: 'not_found', detail: 'd' } });
  await settleFromScan(order(), { chain: 'solana', network: 'solana', tx: SOL_TX });
  assert.equal(S.claims[0].tx_hash, SOL_TX);
  assert.equal(await settleFromScan(order(), { chain: 'solana', network: 'solana', tx: SOL_TX }), 'verification -> HTTP 409');
});

test('scan: claim failures stop before verification', async () => {
  fresh({ claimError: { code: '1' } });
  assert.equal(await settleFromScan(order(), { chain: 'evm', network: 'base', tx: EVM_TX }), 'db_error');
  fresh({ claimError: { code: '23505' }, claimRow: { order_id: 'z' } });
  assert.equal(await settleFromScan(order(), { chain: 'evm', network: 'base', tx: EVM_TX }), 'claimed_by_other_order');
  fresh({ claimError: { code: '23505' }, claimRow: null });
  assert.equal(await settleFromScan(order(), { chain: 'evm', network: 'base', tx: EVM_TX }), 'claimed_by_other_order');
  assert.equal(S.verifyArgs.length, 0);
  fresh({ claimError: { code: '23505' }, claimRow: { order_id: 'oid' }, verdict: { state: 'pending', network: 'x', detail: 'd' } });
  assert.equal(await settleFromScan(order(), { chain: 'evm', network: 'base', tx: EVM_TX }), 'verification -> HTTP 202');
});

// ───────────────────────── retryFulfilment ─────────────────────────
const paid = (over = {}) => order({ status: 'paid', updated_at: 'u0', fulfillment: { printful_error: 'old', printful_attempts: 1 }, ...over });

test('retry: only a paid merch order that never reached Printful is retried', async () => {
  for (const o of [order(), paid({ status: 'fulfilling' }), paid({ fulfillment: { printful_order_id: 9 } }), paid({ items: [DOM] }), paid({ items: [] })])
    assert.equal(await retryFulfilment(o), 'nothing_to_retry');
  assert.equal(await retryFulfilment(paid({ fulfillment: null })), 'fulfilled');
  assert.deepEqual(S.updates.length, 2);
  assert.equal(await retryFulfilment(paid({ fulfillment: { printful_attempts: 6 } })), 'gave_up');
  assert.equal(await retryFulfilment(paid({ fulfillment: { printful_attempts: 7 } })), 'gave_up');
  assert.equal(S.updates.length, 2);
});

test('retry: a worker that loses the compare-and-swap on updated_at backs off', async () => {
  fresh({ mine: null });
  assert.equal(await retryFulfilment(paid()), 'claimed_elsewhere');
  assert.deepEqual(S.updates[0].filters.filter((f) => /^eq:(status|updated_at)/.test(f)), ['eq:status:paid', 'eq:updated_at:u0']);
  assert.equal(S.updates[0].payload.fulfillment.printful_attempts, 2);
  assert.equal(S.updates.length, 1);
  assert.equal(S.fetches.length, 0);
});

test('retry: success clears the old error, stores the Printful id and moves to fulfilling', async () => {
  assert.equal(await retryFulfilment(paid()), 'fulfilled');
  assert.deepEqual(S.updates[1].payload.fulfillment, { printful_attempts: 2, printful_order_id: 555, printful_state: 'submitted for fulfillment' });
  assert.equal(S.updates[1].payload.status, 'fulfilling');
  assert.deepEqual(S.updates[1].filters, ['eq:id:oid']);
  assert.equal(S.notified.length, 0);
});

test('retry: an existing Printful order is adopted instead of created twice', async () => {
  fresh({ pfFind: 321 });
  assert.equal(await retryFulfilment(paid()), 'fulfilled');
  assert.equal(S.updates[1].payload.fulfillment.printful_order_id, 321);
  assert.equal(S.fetches.filter(([x]) => x.includes('api.printful.com/orders?')).length, 0);
});

test('retry: success on an order that also needs manual delivery keeps it paid but reports retry_failed', async () => {
  assert.equal(await retryFulfilment(paid({ items: [MERCH, DOM] })), 'retry_failed');
  assert.equal(S.updates[1].payload.status, 'paid');
  assert.equal(S.updates[1].payload.fulfillment.printful_order_id, 555);
  assert.equal(S.notified.length, 0);
});

test('retry: failure records the error and counts the attempt; the 6th failed attempt alerts the operator', async () => {
  fresh({ pfCreate: { ok: false, status: 502, body: {} } });
  assert.equal(await retryFulfilment(paid({ fulfillment: { printful_attempts: 4 } })), 'retry_failed');
  assert.deepEqual(S.updates[1].payload.fulfillment, { printful_attempts: 5, printful_error: 'Printful: 502' });
  assert.equal(S.updates[1].payload.status, 'paid');
  assert.equal(S.notified.length, 0);
  fresh({ pfCreate: { ok: false, status: 502, body: {} } });
  assert.equal(await retryFulfilment(paid({ fulfillment: { printful_attempts: 5 } })), 'retry_failed');
  assert.equal(S.notified.length, 1);
  assert.match(S.notified[0], /^\*\*VCH order stuck: Printful fulfillment failed 6x\*\*\nVCH-1 — \$25\nPrintful: 502\nACTION: create the Printful order manually \(payment is verified\)\.$/);
  fresh();
  O.env.PRINTFUL_API_TOKEN = undefined;
  await retryFulfilment(paid({ fulfillment: { printful_attempts: 5 } }));
  assert.match(S.notified[0], /\nPRINTFUL_API_TOKEN missing\n/);
});

test('retry: success on the 6th attempt does not alert', async () => {
  assert.equal(await retryFulfilment(paid({ fulfillment: { printful_attempts: 5 } })), 'fulfilled');
  assert.equal(S.notified.length, 0);
});
