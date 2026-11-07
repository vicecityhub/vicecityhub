// Characterization of the request router of the rp-servers function: which method and path reach which handler.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { loadRpServers } from './helpers/loadRpServers.mjs';

const R = await loadRpServers();
const hits = [];
beforeEach(() => {
  hits.length = 0;
  R.route = (c) => { hits.push(c.table); return { data: null, error: null, count: 0 }; };
});
const call = async (path, method = 'GET', init = {}) => {
  const res = await R.handler(new Request(`https://proj.supabase.co/rp-servers${path}`, { method, ...init }));
  return { status: res.status, headers: res.headers, json: await res.json().catch(() => null) };
};

test('OPTIONS answers 204 with CORS headers on any path', async () => {
  for (const p of ['', '/sync', '/nope']) {
    const r = await call(p, 'OPTIONS');
    assert.equal(r.status, 204, p);
    assert.ok(r.headers.get('access-control-allow-origin'), p);
  }
});

test('the root lists the routes; trailing slashes and a missing prefix still match', async () => {
  for (const p of ['', '/', '//']) {
    const r = await call(p);
    assert.equal(r.status, 200, p);
    assert.deepEqual(r.json, { name: 'Vice City Hub RP servers API', routes: ['GET /sync', 'GET /enrich', 'GET /lookup?code=', 'POST /submit', 'GET /health'], docs: 'docs/RP-SERVERS.md' });
  }
  const bare = await R.handler(new Request('https://proj.supabase.co/health/', { method: 'GET' }));
  assert.equal(bare.status, 200);
  assert.equal((await bare.json()).ok, true);
});

test('GET /health and /health/ run the health check', async () => {
  for (const p of ['/health', '/health/']) {
    hits.length = 0;
    const r = await call(p);
    assert.deepEqual([r.status, r.json.ok, r.json.listed, r.json.live], [200, true, 0, 0], p);
    assert.equal(r.headers.get('cache-control'), 'public, max-age=30');
    assert.ok(hits.includes('rp_servers'));
  }
});

test('GET /sync and GET /enrich reach the cron jobs (a fresh lock short-circuits them)', async () => {
  R.route = (c) => (c.table === 'agent_cache' && c.op !== 'upsert' ? { data: { refresh_lock: new Date().toISOString() } } : { data: null, error: null });
  for (const p of ['/sync', '/enrich']) {
    const r = await call(p);
    assert.deepEqual([r.status, r.json.ok, r.json.skipped], [200, true, true], p);
  }
});

test('GET /lookup: a bad or missing code is a 422 with the trimmed lowercase code echoed', async () => {
  const bad = await call('/lookup?code=%20ABC%20');
  assert.deepEqual([bad.status, bad.json], [422, { ok: false, code: 'abc', reasons: ['That is not a Cfx.re join code.'] }]);
  const none = await call('/lookup');
  assert.deepEqual([none.status, none.json.code], [422, '']);
  assert.equal(hits.length, 0);
});

test('POST /submit reaches the submit handler; GET /submit does not', async () => {
  const post = await call('/submit', 'POST', { body: '{}', headers: { 'content-type': 'application/json' } });
  assert.notEqual(post.status, 404);
  assert.deepEqual((await call('/submit')).json, { error: 'not_found' });
});

test('wrong methods and unknown paths are 404 not_found', async () => {
  for (const [p, m] of [['/sync', 'POST'], ['/enrich', 'POST'], ['/health', 'POST'], ['/lookup', 'POST'], ['/', 'POST'], ['/nope', 'GET'], ['/sync/extra', 'GET'], ['/SYNC', 'GET'], ['/health', 'DELETE']]) {
    const r = await call(p, m);
    assert.deepEqual([r.status, r.json], [404, { error: 'not_found' }], `${m} ${p}`);
  }
});

test('a handler that throws becomes a 500 internal_error', async () => {
  R.route = () => { throw new Error('boom'); };
  const orig = console.error; console.error = () => {};
  try {
    const r = await call('/health');
    assert.deepEqual([r.status, r.json], [500, { error: 'internal_error' }]);
  } finally { console.error = orig; }
});
