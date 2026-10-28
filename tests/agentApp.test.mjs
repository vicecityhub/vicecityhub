import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp, normalizePath } from '../supabase/functions/agent-api/app.ts';

const BASE = 'https://x.test/functions/v1/agent-api';
const CORS = { 'Access-Control-Allow-Origin': '*' };
const KEY = { id: 'k1' };

/** The pipeline wired to recording fakes. `over` replaces any dependency. */
function setup(over = {}) {
  const log = { rate: [], events: [], route: [], owner: [], mcp: [] };
  const deps = {
    CORS,
    clientIpHash: async () => 'iphash',
    authenticate: async () => null,
    rate: async (bucket, limit, win) => { log.rate.push([bucket, limit, win]); return true; },
    fail: (status, code, message) => ({ status, body: { error: { code, message } } }),
    toResponse: (r) => new Response(JSON.stringify(r.body), { status: r.status, headers: { ...(r.headers || {}) } }),
    route: async (req, url, path, key, ipHash) => { log.route.push({ method: req.method, path, key, ipHash }); return { status: 200, body: { routed: path } }; },
    ownerRoute: async (req, path, body) => { log.owner.push({ path, body }); return { status: 200, body: { owner: path } }; },
    mcpHandle: async (req, ctx) => { log.mcp.push(ctx); return new Response('{"mcp":true}', { status: 200 }); },
    logEvent: (row) => log.events.push(row),
    ...over,
  };
  const handle = createApp(deps);
  const call = (method, path, { headers = {}, body } = {}) => handle(new Request(`${BASE}${path}`, { method, headers, body }));
  return { call, log };
}
const json = async (res) => JSON.parse(await res.text());
const quiet = (fn) => async (...a) => { const orig = console.error; console.error = () => {}; try { return await fn(...a); } finally { console.error = orig; } };

test('normalizePath strips the function prefix and trailing slashes; the bare URL is "/"', () => {
  assert.equal(normalizePath('/functions/v1/agent-api/v1/news/'), '/v1/news');
  assert.equal(normalizePath('/agent-api/v1/catalog'), '/v1/catalog');
  assert.equal(normalizePath('/functions/v1/agent-api'), '/');
  assert.equal(normalizePath('/functions/v1/agent-api///'), '/');
  assert.equal(normalizePath('/v1/orders/x/status'), '/v1/orders/x/status');
});

test('OPTIONS answers 204 with the CORS headers and touches nothing else', async () => {
  const { call, log } = setup();
  const res = await call('OPTIONS', '/v1/news');
  assert.equal(res.status, 204); assert.equal(res.headers.get('Access-Control-Allow-Origin'), '*');
  assert.deepEqual(log.rate, []); assert.deepEqual(log.route, []);
});

test('an anonymous GET goes through the ip rate limit to the route table and is not logged', async () => {
  const { call, log } = setup();
  const res = await call('GET', '/v1/news/');
  assert.equal(res.status, 200); assert.deepEqual(await json(res), { routed: '/v1/news' });
  assert.deepEqual(log.rate, [['ip:iphash', 120, 60]]);
  assert.deepEqual(log.route, [{ method: 'GET', path: '/v1/news', key: null, ipHash: 'iphash' }]);
  assert.deepEqual(log.events, []);
});

test('a valid key gets its own bucket with the higher limit and reaches the route', async () => {
  const { call, log } = setup({ authenticate: async () => KEY });
  await call('GET', '/v1/agents/me');
  assert.deepEqual(log.rate, [['key:k1', 300, 60]]); assert.equal(log.route[0].key, KEY);
});

test('an invalid key is a 401 before any rate limit or route', async () => {
  const { call, log } = setup({ authenticate: async () => 'invalid' });
  const res = await call('GET', '/v1/news', { headers: { authorization: 'Bearer vch_live_x' } });
  assert.equal(res.status, 401); assert.equal((await json(res)).error.code, 'invalid_api_key');
  assert.deepEqual(log.rate, []); assert.deepEqual(log.route, []);
});

test('the general limit gives 429 with Retry-After and stops the request', async () => {
  const { call, log } = setup({ rate: async () => false });
  const res = await call('GET', '/v1/news');
  assert.equal(res.status, 429); assert.equal(res.headers.get('Retry-After'), '60');
  assert.equal((await json(res)).error.message, 'Too many requests. Back off and retry.');
  assert.deepEqual(log.route, []);
});

test('POST has a second, write limit (30/min per key or ip) that also answers 429 + Retry-After', async () => {
  const seen = [];
  const { call, log } = setup({ authenticate: async () => KEY, rate: async (b, l, w) => { seen.push([b, l, w]); return !b.startsWith('w:'); } });
  const res = await call('POST', '/v1/quotes', { body: '{}' });
  assert.equal(res.status, 429); assert.equal(res.headers.get('Retry-After'), '60');
  assert.equal((await json(res)).error.message, 'Write limit: 30 requests/minute.');
  assert.deepEqual(seen, [['key:k1', 300, 60], ['w:k1', 30, 60]]); assert.deepEqual(log.route, []);
  const anon = setup({ rate: async (b) => { anon.seen.push(b); return true; } }); anon.seen = [];
  await anon.call('POST', '/v1/agents/register', { body: '{}' });
  assert.deepEqual(anon.seen, ['ip:iphash', 'w:iphash']);
});

test('GET never touches the write limit', async () => {
  const { call, log } = setup();
  await call('GET', '/v1/news');
  assert.ok(!log.rate.some(([b]) => b.startsWith('w:')));
});

test('POST requests are logged with key, status, path, trimmed user agent and duration', async () => {
  const { call, log } = setup({ authenticate: async () => KEY });
  await call('POST', '/v1/quotes', { body: '{}', headers: { 'user-agent': 'x'.repeat(300) } });
  assert.equal(log.events.length, 1);
  const e = log.events[0];
  assert.equal(e.agent_key_id, 'k1'); assert.equal(e.method, 'POST'); assert.equal(e.path, '/v1/quotes'); assert.equal(e.status, 200);
  assert.equal(e.ip_hash, 'iphash'); assert.equal(e.user_agent.length, 200); assert.ok(e.ms >= 0);
  const anon = setup(); await anon.call('POST', '/v1/agents/register', { body: '{}' });
  assert.equal(anon.log.events[0].agent_key_id, null); assert.equal(anon.log.events[0].user_agent, '');
});

test('the logged status is the status of the failed response too', async () => {
  const { call, log } = setup({ route: async () => ({ status: 404, body: {} }) });
  await call('POST', '/v1/nope', { body: '{}' });
  assert.equal(log.events[0].status, 404);
});

test('/mcp is handed to the MCP handler with key and ip hash instead of the route table', async () => {
  const { call, log } = setup({ authenticate: async () => KEY });
  const res = await call('POST', '/mcp', { body: '{}' });
  assert.deepEqual(await json(res), { mcp: true });
  assert.deepEqual(log.mcp, [{ key: KEY, ipHash: 'iphash' }]); assert.deepEqual(log.route, []);
  assert.equal(log.events[0].path, '/mcp');
});

test('a handler that throws becomes a 500 internal_error and is still logged for POST', quiet(async () => {
  const { call, log } = setup({ route: async () => { throw new Error('boom'); } });
  const res = await call('POST', '/v1/quotes', { body: '{}' });
  assert.equal(res.status, 500); assert.equal((await json(res)).error.code, 'internal_error');
  assert.equal(log.events[0].status, 500);
  const mcp = setup({ mcpHandle: async () => { throw new Error('x'); } });
  assert.equal((await mcp.call('POST', '/mcp', { body: '{}' })).status, 500);
}));

test('owner console: own rate limit, no API key lookup, route gets path and parsed body', async () => {
  let authCalls = 0;
  const { call, log } = setup({ authenticate: async () => { authCalls++; return null; } });
  const res = await call('POST', '/v1/owner/keys', { body: '{"name":"bot"}' });
  assert.deepEqual(await json(res), { owner: '/v1/owner/keys' });
  assert.deepEqual(log.rate, [['owner:iphash', 60, 60]]); assert.deepEqual(log.owner, [{ path: '/v1/owner/keys', body: { name: 'bot' } }]);
  assert.equal(authCalls, 0); assert.deepEqual(log.events, []);
});

test('owner console: GET gets an empty body, an empty POST body is {}, invalid JSON is 400', async () => {
  const a = setup(); await a.call('GET', '/v1/owner/keys');
  assert.deepEqual(a.log.owner[0].body, {});
  const b = setup(); await b.call('POST', '/v1/owner/keys', { body: '' });
  assert.deepEqual(b.log.owner[0].body, {});
  const c = setup(); const res = await c.call('POST', '/v1/owner/keys', { body: '{oops' });
  assert.equal(res.status, 400); assert.equal((await json(res)).error.code, 'invalid_json'); assert.deepEqual(c.log.owner, []);
});

test('owner console: rate limit is a 429 without Retry-After; a throwing route is a 500', quiet(async () => {
  const a = setup({ rate: async () => false });
  const res = await a.call('GET', '/v1/owner/keys');
  assert.equal(res.status, 429); assert.equal(res.headers.get('Retry-After'), null); assert.equal((await json(res)).error.message, 'Too many requests.');
  const b = setup({ ownerRoute: async () => { throw new Error('x'); } });
  assert.equal((await b.call('GET', '/v1/owner/keys')).status, 500);
}));
