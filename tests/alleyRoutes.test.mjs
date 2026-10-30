// Characterization of the Back Alley router, signature verification and the x402 paywall (boost / verified badge).
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { loadAlley } from './helpers/loadAlley.mjs';

const A = await loadAlley();
const NOW = Date.parse('2026-10-29T12:00:00Z');
Date.now = () => NOW;
Math.random = () => 0.5;
const ENV = { SUPABASE_URL: 'https://proj.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'service-key' };
Deno.env.get = (k) => ENV[k];

const BASE = 'https://proj.supabase.co/functions/v1/alley';
const call = async (method, path, { headers = {}, body } = {}) => {
  const res = await A.handler(new Request(`${BASE}${path}`, { method, headers: { 'x-forwarded-for': '9.9.9.9', ...headers }, body }));
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, json, headers: res.headers, text };
};
const get = (p, o) => call('GET', p, o);

let S;
beforeEach(() => {
  S = { thread: { id: 5, status: 'approved', boosted_until: null, agent_id: 'ag1' }, agent: { id: 'ag1', status: 'active', verified: false }, updates: [], inserts: [], throwOn: null, updateError: null };
  A.route = (c) => {
    if (S.throwOn === c.table) throw new Error('boom');
    if (c.op === 'insert' || c.op === 'upsert') { S.inserts.push([c.table, c.payload]); return { error: null }; }
    if (c.op === 'update') { S.updates.push([c.table, c.payload]); return { error: S.updateError }; }
    if (c.table === 'alley_threads' && c.single) return { data: S.thread };
    if (c.table === 'alley_agents' && c.single) return { data: S.agent };
    return { data: [], error: null };
  };
});

// ---------- routing ----------
test('OPTIONS answers CORS preflight without touching anything', async () => {
  const r = await call('OPTIONS', '/post');
  assert.equal(r.status, 204);
  assert.equal(r.headers.get('access-control-allow-origin'), '*');
});

test('GET /, /info, trailing slash and the function prefix all serve the info document', async () => {
  for (const p of ['', '/', '/info', '/info/']) {
    const r = await get(p);
    assert.equal(r.status, 200, p);
    assert.ok(r.json, p);
  }
  assert.deepEqual((await get('/info')).json, (await get('/')).json);
});

test('GET /pricing', async () => {
  const r = await get('/pricing');
  assert.equal(r.status, 200);
  assert.equal(r.json.ok, true);
});

test('GET /threads lists approved threads; a database error is a 500 from the handler', async () => {
  const r = await get('/threads?board=ideas&limit=5');
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.threads, []);
  assert.equal(r.headers.get('cache-control'), 'public, max-age=30');
  S.throwOn = 'alley_threads';
  const e = await get('/threads');
  assert.deepEqual([e.status, e.json.error], [500, 'server error']);
});

test('GET /threads/{id}: digits only, at most 12 of them', async () => {
  assert.equal((await get('/threads/5')).status, 200);
  S.thread = null;
  assert.equal((await get('/threads/5')).status, 404);
  for (const p of ['/threads/abc', '/threads/1234567890123', '/threads/5/x']) {
    const r = await get(p);
    assert.deepEqual([r.status, r.json.error, r.json.hint], [404, 'not found', 'GET /info'], p);
  }
});

test('unknown GET -> 404 with hint; POST to other paths and other methods -> 405', async () => {
  const r = await get('/nope');
  assert.deepEqual([r.status, r.json.hint], [404, 'GET /info']);
  for (const [m, p] of [['POST', '/info'], ['POST', '/threads'], ['PUT', '/post'], ['DELETE', '/report'], ['POST', '/']]) {
    const x = await call(m, p, { body: m === 'POST' ? '{}' : undefined });
    assert.deepEqual([x.status, x.json.error], [405, 'method not allowed'], `${m} ${p}`);
  }
});

test('POST /post and /report reach their handlers (bad JSON -> 400 from each)', async () => {
  for (const p of ['/post', '/report']) {
    const r = await call('POST', p, { body: 'nope' });
    assert.deepEqual([r.status, r.json.error], [400, 'body must be JSON'], p);
  }
});

test('boost / verify validate their input before any payment logic', async () => {
  for (const d of ['0', '8', '1.5', 'x']) assert.equal((await get(`/boost/5?days=${d}`)).status, 400, d);
  assert.equal((await get('/verify?chain=btc&address=x')).status, 400);
  assert.equal((await get('/verify?chain=evm&address=0x12')).status, 400);
});

// ---------- signature verification (through POST /report, which only needs a signature) ----------
const ADDR = '0x' + 'ab'.repeat(20);
const SOL = '11111111111111111111111111111111';
const report = (over = {}) => call('POST', '/report', { body: JSON.stringify({ chain: 'evm', address: ADDR, kind: 'thread', id: 1, nonce: 'nonce-12345', issued_at: new Date(NOW).toISOString(), signature: '0x' + 'cd'.repeat(65), ...over }) });

test('evm: malformed signature never reaches the verifier; recovered address is compared lower-cased; verifier errors mean "no"', async () => {
  let called = 0;
  A.recover = () => { called++; return ADDR.toUpperCase().replace('0X', '0x'); };
  assert.equal((await report({ signature: '0x12' })).status, 401);
  assert.equal((await report({ signature: '0x' + 'g'.repeat(130) })).status, 401);
  assert.equal(called, 0);
  assert.notEqual((await report()).status, 401);
  assert.equal(called, 1);
  A.recover = () => { throw new Error('bad sig'); };
  assert.equal((await report()).status, 401);
  A.recover = () => '0x' + '11'.repeat(20);
  assert.equal((await report()).status, 401);
});

test('solana: base58 or base64 signatures of 64 bytes, 32-byte keys, verifier decides', async () => {
  const seen = [];
  A.naclVerify = (m, s, p) => { seen.push([s.length, p.length]); return true; };
  const b64sig = Buffer.alloc(64, 7).toString('base64');
  assert.notEqual((await report({ chain: 'solana', address: SOL, signature: '1'.repeat(64) })).status, 401);
  assert.notEqual((await report({ chain: 'solana', address: SOL, signature: b64sig })).status, 401);
  assert.deepEqual(seen, [[64, 32], [64, 32]]);
  seen.length = 0;
  for (const signature of ['1'.repeat(63), '1'.repeat(65), 'not*base58', Buffer.alloc(63).toString('base64')]) assert.equal((await report({ chain: 'solana', address: SOL, signature })).status, 401, signature);
  assert.equal((await report({ chain: 'solana', address: '1'.repeat(31) + '0', signature: '1'.repeat(64) })).status, 400);
  assert.equal((await report({ chain: 'solana', address: '2'.repeat(40), signature: '1'.repeat(64) })).status, 401);
  assert.deepEqual(seen, []);
  A.naclVerify = () => { throw new Error('x'); };
  assert.equal((await report({ chain: 'solana', address: SOL, signature: '1'.repeat(64) })).status, 401);
  A.naclVerify = () => false;
  assert.equal((await report({ chain: 'solana', address: SOL, signature: '1'.repeat(64) })).status, 401);
});

// ---------- x402 paywall ----------
const EVM_WALLET = '0x' + '77'.repeat(20);
let fetchLog;
let fac;
function stubNetwork() {
  fetchLog = [];
  fac = { verify: { status: 200, json: { isValid: true } }, settle: { status: 200, json: { success: true, network: 'eip155:8453', transaction: '0xtx', payer: '0xpayer' } }, throwOn: null };
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    fetchLog.push([u, init?.method || 'GET']);
    if (u.includes('/v1/donate')) return { json: async () => ({ direct_transfer: { wallets: [{ chain: 'evm', address: EVM_WALLET }] } }) };
    if (u.endsWith('/supported')) return { status: 200, json: async () => ({ kinds: [] }) };
    const which = u.endsWith('/verify') ? 'verify' : 'settle';
    if (fac.throwOn === which) throw new Error('down');
    return { status: fac[which].status, json: async () => fac[which].json };
  };
}
const SECRET = Buffer.alloc(32, 3).toString('base64');
const payHeader = (over = {}) => ({ 'payment-signature': Buffer.from(JSON.stringify({ x402Version: 2, accepted: { network: 'eip155:8453', scheme: 'exact' }, payload: {}, ...over })).toString('base64') });

test('paywall: not configured -> 503 before any precheck', async () => {
  delete ENV.CDP_API_KEY_ID; delete ENV.CDP_API_KEY_SECRET;
  stubNetwork();
  S.thread = null;
  const r = await get('/boost/5');
  assert.deepEqual([r.status, r.json.error], [503, 'x402_unavailable']);
  assert.equal(fetchLog.length, 0);
});

test('paywall: precheck failures come first (boost and verify)', async () => {
  ENV.CDP_API_KEY_ID = 'kid'; ENV.CDP_API_KEY_SECRET = SECRET;
  stubNetwork();
  S.thread = null;
  assert.equal((await get('/boost/5')).status, 404);
  S.thread = { id: 5, status: 'approved', boosted_until: new Date(NOW + 7 * 86_400_000).toISOString() };
  assert.equal((await get('/boost/5')).status, 409);
  S.agent = null;
  assert.equal((await get(`/verify?chain=evm&address=${ADDR}`)).status, 404);
  S.agent = { id: 'a', status: 'muted', verified: false };
  assert.equal((await get(`/verify?chain=evm&address=${ADDR}`)).status, 403);
  S.agent = { id: 'a', status: 'active', verified: true };
  assert.equal((await get(`/verify?chain=evm&address=${ADDR}`)).status, 409);
});

test('paywall: without a payment header the answer is 402 with the requirements, price in micro-USDC', async () => {
  ENV.CDP_API_KEY_ID = 'kid'; ENV.CDP_API_KEY_SECRET = SECRET;
  stubNetwork();
  const r = await get('/boost/5?days=3');
  assert.equal(r.status, 402);
  assert.equal(r.json.x402Version, 2);
  assert.equal(r.json.accepts.length, 1);
  assert.equal(r.json.accepts[0].amount, '300000');
  assert.equal(r.json.accepts[0].payTo, EVM_WALLET);
  assert.equal(r.json.resource.url, `${BASE}/boost/5?days=3`);
  assert.deepEqual(JSON.parse(Buffer.from(r.headers.get('payment-required'), 'base64').toString()).accepts, r.json.accepts);
  const v = await get(`/verify?chain=evm&address=${ADDR}`);
  assert.equal(v.json.accepts[0].amount, '1000000');
});

test('paywall: bad headers and mismatches are refused before the facilitator is called', async () => {
  ENV.CDP_API_KEY_ID = 'kid'; ENV.CDP_API_KEY_SECRET = SECRET;
  stubNetwork();
  const calls = () => fetchLog.filter((l) => l[0].includes('coinbase'));
  const r1 = await get('/boost/5', { headers: { 'payment-signature': '!!!' } });
  assert.deepEqual([r1.status, r1.json.error], [400, 'invalid_payment_header']);
  const r1b = await get('/boost/5', { headers: { 'x-payment': Buffer.from('not json').toString('base64') } });
  assert.equal(r1b.json.error, 'invalid_payment_header');
  assert.equal((await get('/boost/5', { headers: payHeader({ x402Version: 1 }) })).json.error, 'unsupported_x402_version');
  const r3 = await get('/boost/5', { headers: payHeader({ accepted: { network: 'eip155:1', scheme: 'exact' } }) });
  assert.deepEqual([r3.status, r3.json.error, r3.json.offered], [422, 'payment_option_mismatch', ['eip155:8453']]);
  assert.equal(calls().length, 0);
});

test('paywall: invalid payment -> 402 with the facilitator reason, nothing settled', async () => {
  ENV.CDP_API_KEY_ID = 'kid'; ENV.CDP_API_KEY_SECRET = SECRET;
  stubNetwork();
  fac.verify = { status: 200, json: { isValid: false, invalidReason: 'insufficient_funds' } };
  const r = await get('/boost/5', { headers: payHeader() });
  assert.deepEqual([r.status, r.json.error, r.json.hint], [402, 'insufficient_funds', 'Payment was not valid. Nothing was charged.']);
  assert.ok(r.headers.get('payment-required'));
  assert.equal(fetchLog.filter((l) => l[0].endsWith('/settle')).length, 0);
  fac.verify = { status: 500, json: {} };
  assert.equal((await get('/boost/5', { headers: payHeader() })).json.error, 'facilitator http 500');
  fac.throwOn = 'verify';
  const u = await get('/boost/5', { headers: payHeader() });
  assert.deepEqual([u.status, u.json.error], [502, 'facilitator_unreachable']);
});

test('paywall: state that changed while signing is caught by the second precheck, before settling', async () => {
  ENV.CDP_API_KEY_ID = 'kid'; ENV.CDP_API_KEY_SECRET = SECRET;
  stubNetwork();
  let n = 0;
  const base = A.route;
  A.route = (c) => { if (c.table === 'alley_threads' && c.single && ++n === 2) return { data: null }; return base(c); };
  const r = await get('/boost/5', { headers: payHeader() });
  assert.equal(r.status, 404);
  assert.equal(fetchLog.filter((l) => l[0].endsWith('/settle')).length, 0);
});

test('paywall: settlement failures', async () => {
  ENV.CDP_API_KEY_ID = 'kid'; ENV.CDP_API_KEY_SECRET = SECRET;
  stubNetwork();
  fac.settle = { status: 200, json: { success: false, errorReason: 'nope' } };
  const r = await get('/boost/5', { headers: payHeader() });
  assert.deepEqual([r.status, r.json.error], [402, 'settlement failed: nope']);
  assert.deepEqual(JSON.parse(Buffer.from(r.headers.get('payment-response'), 'base64').toString()), { success: false, errorReason: 'nope', transaction: '', network: 'eip155:8453' });
  fac.settle = { status: 502, json: {} };
  assert.equal((await get('/boost/5', { headers: payHeader() })).json.error, 'settlement failed: facilitator http 502');
  fac.throwOn = 'settle';
  const u = await get('/boost/5', { headers: payHeader() });
  assert.deepEqual([u.status, u.json.error], [502, 'settlement_unconfirmed']);
});

test('paywall: boost success extends the boost, logs the sale and returns the receipt', async () => {
  ENV.CDP_API_KEY_ID = 'kid'; ENV.CDP_API_KEY_SECRET = SECRET;
  stubNetwork();
  const r = await get('/boost/5?days=2', { headers: payHeader() });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.receipt, { product: 'alley_boost', amount_usd: 0.2, asset: 'USDC', network: 'eip155:8453', tx_hash: '0xtx', payer: '0xpayer' });
  assert.equal(r.json.boost.sponsored_until, new Date(NOW + 2 * 86_400_000).toISOString());
  assert.deepEqual(JSON.parse(Buffer.from(r.headers.get('payment-response'), 'base64').toString()), { success: true, transaction: '0xtx', network: 'eip155:8453', payer: '0xpayer' });
  assert.ok(S.inserts.some((i) => i[0] === 'alley_sales' && i[1].kind === 'boost' && i[1].tx === '0xtx'));
  assert.deepEqual(S.updates.at(-1), ['alley_threads', { boosted_until: new Date(NOW + 2 * 86_400_000).toISOString() }]);
});

test('paywall: verified success, and a failing effect still returns the receipt with a warning', async () => {
  ENV.CDP_API_KEY_ID = 'kid'; ENV.CDP_API_KEY_SECRET = SECRET;
  stubNetwork();
  const r = await get(`/verify?chain=evm&address=${ADDR}`, { headers: payHeader() });
  assert.equal(r.status, 200);
  assert.equal(r.json.receipt.amount_usd, 1);
  assert.deepEqual(r.json.verified, { chain: 'evm', address: '0xabab...abab', perks: ['12 posts per hour', 'up to 2 https links per post'] });
  assert.equal(S.updates.at(-1)[0], 'alley_agents');
  S.updateError = { message: 'db down' };
  const w = await get(`/verify?chain=evm&address=${ADDR}`, { headers: payHeader() });
  assert.equal(w.status, 200);
  assert.match(w.json.warning, /Payment settled but the effect could not be applied/);
  assert.equal(w.json.ok, true);
});
