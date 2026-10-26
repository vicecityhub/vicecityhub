import test from 'node:test';
import assert from 'node:assert/strict';
import { createRouter } from '../supabase/functions/agent-api/router.ts';

const BASE = 'https://x.test/functions/v1/agent-api';
const HANDLERS = [
  'indexDoc', 'catalogList', 'catalogItem', 'reconcile', 'donationInfo', 'x402Donate', 'search', 'newsList', 'newsItem',
  'rpList', 'whoAmI', 'orderStatus', 'getOrder', 'registerAgent', 'createQuote', 'createOrder', 'createIntent',
  'createDonation', 'captureOrder', 'submitProof', 'verifyOrder', 'cancelOrder',
];

/** Router wired to recording stubs: every handler returns { handler, args } so a test sees who got called and with what. */
function setup() {
  const calls = [];
  let nudges = 0;
  const deps = {
    fail: (status, code, message, hint) => ({ status, body: { error: { code, message, hint } } }),
    spec: { openapi: '3.1.0' },
    nudgeReconcile: () => { nudges++; },
  };
  for (const name of HANDLERS) deps[name] = (...args) => { calls.push(name); return { status: 200, body: { handler: name, args } }; };
  const route = createRouter(deps);
  const run = (method, path, { key = null, body, headers = {}, query = '' } = {}) => {
    const req = new Request(`${BASE}${path}${query}`, { method, headers, body: body === undefined ? undefined : body });
    return route(req, new URL(req.url), path, key, 'iphash');
  };
  return { run, calls, nudges: () => nudges };
}

const KEY = { id: 'k1' };

test('open GET routes reach their handler with the right arguments', async () => {
  const { run } = setup();
  const named = async (method, path, expected, opts) => {
    const r = await run(method, path, opts);
    assert.equal(r.status, 200, `${method} ${path}`);
    assert.equal(r.body.handler, expected, `${method} ${path}`);
    return r.body.args;
  };
  await named('GET', '/', 'indexDoc');
  await named('GET', '/v1', 'indexDoc');
  assert.equal((await named('GET', '/v1/catalog', 'catalogList', { query: '?limit=5' }))[0].get('limit'), '5');
  assert.deepEqual(await named('GET', '/v1/catalog/domain%3Avice.nft', 'catalogItem'), ['domain:vice.nft']);
  await named('GET', '/v1/internal/reconcile', 'reconcile');
  await named('GET', '/v1/donate', 'donationInfo');
  const x = await named('GET', '/v1/donate/x402', 'x402Donate', { query: '?amount=1' });
  assert.deepEqual([x[1].get('amount'), x[2], x[3]], ['1', {}, 'iphash']);
  assert.equal((await named('GET', '/v1/search', 'search', { query: '?q=gta' }))[0].get('q'), 'gta');
  await named('GET', '/v1/news', 'newsList');
  assert.deepEqual(await named('GET', '/v1/news/42', 'newsItem'), ['42']);
  for (const kind of ['servers', 'factions', 'jobs', 'mods']) {
    assert.equal((await named('GET', `/v1/rp/${kind}`, 'rpList'))[0], kind);
  }
});

test('GET /v1/openapi.json serves the spec with a one hour cache', async () => {
  const { run } = setup();
  assert.deepEqual(await run('GET', '/v1/openapi.json'), {
    status: 200,
    body: { openapi: '3.1.0' },
    headers: { 'Cache-Control': 'public, max-age=3600' },
  });
});

test('order status polling nudges the reconciler and needs no key', async () => {
  const { run, nudges } = setup();
  const r = await run('GET', '/v1/orders/abc123/status');
  assert.deepEqual([r.body.handler, r.body.args], ['orderStatus', ['abc123']]);
  assert.equal(nudges(), 1);
});

test('keyed routes answer 401 auth_required without calling the handler', async () => {
  const { run, calls } = setup();
  const cases = [
    ['GET', '/v1/agents/me'],
    ['GET', '/v1/orders/abc123'],
    ['POST', '/v1/quotes', '{}'],
    ['POST', '/v1/orders', '{}'],
    ['POST', '/v1/intents', '{}'],
    ['POST', '/v1/donations', '{}'],
    ['POST', '/v1/orders/abc123/payment-proof', '{}'],
    ['POST', '/v1/orders/abc123/verify', '{}'],
    ['POST', '/v1/orders/abc123/cancel', '{}'],
  ];
  for (const [method, path, body] of cases) {
    const r = await run(method, path, { body });
    assert.equal(r.status, 401, `${method} ${path}`);
    assert.equal(r.body.error.code, 'auth_required', `${method} ${path}`);
  }
  assert.deepEqual(calls, []);
});

test('keyed routes pass the key, ids, body and idempotency header through', async () => {
  const { run } = setup();
  const idem = { 'idempotency-key': 'idem-1' };
  const b = '{"items":[1]}';
  const args = async (method, path, expected, opts = {}) => {
    const r = await run(method, path, { key: KEY, ...opts });
    assert.equal(r.body.handler, expected, `${method} ${path}`);
    return r.body.args;
  };
  assert.deepEqual(await args('GET', '/v1/agents/me', 'whoAmI'), [KEY]);
  assert.deepEqual(await args('GET', '/v1/orders/o_1', 'getOrder'), [KEY, 'o_1']);
  assert.deepEqual(await args('POST', '/v1/quotes', 'createQuote', { body: b }), [KEY, { items: [1] }]);
  assert.deepEqual(await args('POST', '/v1/orders', 'createOrder', { body: b, headers: idem }), [KEY, { items: [1] }, 'idem-1']);
  assert.deepEqual(await args('POST', '/v1/orders', 'createOrder', { body: b }), [KEY, { items: [1] }, null]);
  assert.deepEqual(await args('POST', '/v1/intents', 'createIntent', { body: b }), [KEY, { items: [1] }]);
  assert.deepEqual(await args('POST', '/v1/donations', 'createDonation', { body: b, headers: idem }), [KEY, { items: [1] }, 'idem-1']);
  assert.deepEqual(await args('POST', '/v1/orders/o_1/payment-proof', 'submitProof', { body: b }), [KEY, 'o_1', { items: [1] }]);
  assert.deepEqual(await args('POST', '/v1/orders/o_1/verify', 'verifyOrder'), [KEY, 'o_1']);
  assert.deepEqual(await args('POST', '/v1/orders/o_1/cancel', 'cancelOrder'), [KEY, 'o_1']);
});

test('open POST routes work without a key', async () => {
  const { run } = setup();
  const reg = await run('POST', '/v1/agents/register', { body: '{"name":"bot"}' });
  assert.deepEqual([reg.body.handler, reg.body.args], ['registerAgent', [{ name: 'bot' }, 'iphash']]);
  const x = await run('POST', '/v1/donate/x402', { body: '{"amount":2}', query: '?chain=base' });
  assert.equal(x.body.handler, 'x402Donate');
  assert.deepEqual([x.body.args[1].get('chain'), x.body.args[2], x.body.args[3]], ['base', { amount: 2 }, 'iphash']);
  const cap = await run('POST', '/v1/orders/o_9/capture', { body: '{}' });
  assert.deepEqual([cap.body.handler, cap.body.args], ['captureOrder', ['o_9']]);
});

test('an empty POST body is {}; invalid JSON is rejected before any route is looked at', async () => {
  const { run, calls } = setup();
  const empty = await run('POST', '/v1/agents/register', { body: '' });
  assert.deepEqual(empty.body.args[0], {});
  const bad = await run('POST', '/v1/agents/register', { body: '{nope' });
  assert.equal(bad.status, 400);
  assert.equal(bad.body.error.code, 'invalid_json');
  // even for a path that does not exist, bad JSON wins over 404
  const badUnknown = await run('POST', '/v1/nothing', { body: '{nope' });
  assert.equal(badUnknown.body.error.code, 'invalid_json');
  assert.deepEqual(calls, ['registerAgent']);
});

test('unknown paths, wrong methods and near misses give 404 not_found', async () => {
  const { run, calls } = setup();
  const misses = [
    ['GET', '/nope'],
    ['GET', '/v2'],
    ['GET', '/v1/'],           // trailing slash is trimmed by index.ts before routing, so the router never sees it
    ['GET', '/v1/news/abc'],   // id must be numeric
    ['GET', '/v1/rp/other'],
    ['GET', '/v1/orders/a-b'], // \w+ only
    ['GET', '/v1/orders/abc/capture'],
    ['GET', '/v1/quotes'],     // POST-only
    ['POST', '/v1/catalog'],   // GET-only
    ['POST', '/v1/openapi.json'],
    ['PUT', '/v1/orders'],
    ['DELETE', '/v1/orders/abc'],
    ['GET', '/v1/openapiXjson'], // dot in a path is literal
  ];
  for (const [method, path] of misses) {
    const r = await run(method, path, { body: method === 'POST' ? '{}' : undefined });
    assert.equal(r.status, 404, `${method} ${path}`);
    assert.equal(r.body.error.code, 'not_found', `${method} ${path}`);
    assert.equal(r.body.error.message, `No route for ${method} ${path}`);
  }
  assert.deepEqual(calls, []);
});

test('a malformed percent-escape in a catalog id throws, as the old router did (index.ts turns it into a 500)', async () => {
  const { run } = setup();
  await assert.rejects(() => run('GET', '/v1/catalog/%E0%A4%A'), URIError);
});
