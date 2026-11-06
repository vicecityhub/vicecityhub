// Characterization of the two cron jobs of the rp-servers function: GET /sync (Cfx.re live fields) and GET /enrich (Discord invites),
// against a scripted fake database and fake Cfx.re / Discord endpoints.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { loadRpServers } from './helpers/loadRpServers.mjs';

const R = await loadRpServers();
const NOW = Date.parse('2026-11-01T12:00:00Z');
const DAY = 864e5;
let clock = 0;
Date.now = () => NOW + clock;
const realSetTimeout = globalThis.setTimeout;
const iso = (ms) => new Date(ms).toISOString();
const ISO = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/;

// ---- scripted database ----
let S;
const filterVal = (c, col) => (c.filters.find((f) => f[1] === col) || [])[2];
function fresh(over = {}) {
  S = { locks: {}, rows: [], error: null, updates: [], upserts: [], queries: [], ...over };
  clock = 0;
  R.route = (c) => {
    if (c.table === 'agent_cache') {
      if (c.op === 'upsert') { S.upserts.push(c.payload); return { error: null }; }
      const lock = S.locks[filterVal(c, 'key')];
      return { data: lock ? { refresh_lock: lock } : null };
    }
    if (c.table === 'rp_servers') {
      if (c.op === 'update') { S.updates.push({ id: filterVal(c, 'id'), patch: c.payload }); return { error: null }; }
      S.queries.push(c);
      return S.error ? { data: null, error: { message: 'db down' } } : { data: S.rows };
    }
    return { data: null, error: null };
  };
}

// ---- fake network: Cfx.re single-server endpoint and Discord invite API ----
let net;
const reply = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => body });
function stubNetwork() {
  net = { cfx: {}, discord: {}, log: [], inflight: 0, maxInflight: 0, delay: 0, onFetch: null, sleeps: [] };
  globalThis.fetch = async (url) => {
    const u = String(url);
    net.log.push(u);
    net.onFetch?.(u);
    net.inflight++; net.maxInflight = Math.max(net.maxInflight, net.inflight);
    try {
      if (net.delay) await new Promise((r) => realSetTimeout(r, net.delay));
      const dm = u.match(/discord\.com\/api\/v10\/invites\/([^?]+)\?with_counts=true$/);
      const script = dm ? net.discord[dm[1]] : net.cfx[u.match(/\/single\/([a-z0-9]+)$/)?.[1]];
      if (script === 'error') throw new Error('net down');
      if (typeof script === 'number') return reply(script, {});
      return script ? reply(200, script) : reply(404, {});
    } finally { net.inflight--; }
  };
  globalThis.setTimeout = (fn, ms, ...a) => { net.sleeps.push(ms); return realSetTimeout(fn, 0, ...a); };
}
const server = (over = {}, vars = {}) => ({
  Data: {
    hostname: '^1Host One', clients: 12, sv_maxclients: 64, upvotePower: 5, iconVersion: 3, resources: ['a', 'b', 'c'], ownerName: 'Owner', gametype: 'Roleplay',
    server: 'FXServer-master v1.0.0.9999 win32', lastSeen: iso(NOW - 60_000),
    vars: { sv_projectName: 'Proj', sv_projectDesc: 'Desc', locale: 'en-US', peak_players: '30', discord_link: 'https://discord.gg/abc', sv_appearAllowlisted: 'false', tags: 'rp,serious', ...vars },
    ...over,
  },
});
const invite = (over = {}) => ({ guild: { name: 'Guild', features: [] }, approximate_member_count: 500, approximate_presence_count: 50, ...over });
const row = (over = {}) => ({ id: 'r1', cfx_code: 'abcde1', source: 'curated', access: 'public', listing_status: 'active', last_seen_at: iso(NOW - DAY), created_at: iso(NOW - 30 * DAY), discord_url: 'https://discord.gg/old1', ...over });

const call = async (path) => {
  const res = await R.handler(new Request(`https://proj.supabase.co/rp-servers${path}`, { method: 'GET' }));
  return { status: res.status, json: await res.json() };
};
const sync = () => call('/sync');
const enrich = () => call('/enrich');
const noMs = ({ ms, ...rest }) => rest;
const SYNC_ZERO = { ok: true, checked: 0, live: 0, offline: 0, errors: 0, dead: 0, revived: 0, skipped_budget: 0 };
const ENRICH_ZERO = { ok: true, checked: 0, valid: 0, replaced: 0, cleared: 0, errors: 0 };
const patchOf = (i = 0) => { const { last_checked_at, ...rest } = S.updates[i].patch; assert.match(last_checked_at, ISO); return rest; };

beforeEach(() => { fresh(); stubNetwork(); });

// ---------- GET /sync ----------
test('sync: a lock younger than 90 seconds skips the run without touching the table; 90 seconds is old enough', async () => {
  fresh({ locks: { 'rp-sync': iso(NOW - 89_999) } });
  assert.deepEqual((await sync()).json, { ok: true, skipped: true });
  assert.deepEqual([S.queries.length, S.upserts.length], [0, 0]);
  fresh({ locks: { 'rp-sync': iso(NOW - 90_000) } });
  assert.equal((await sync()).json.skipped, undefined);
  fresh();
  assert.equal((await sync()).json.ok, true);
  assert.equal(S.upserts.length, 1);
  assert.deepEqual(Object.keys(S.upserts[0]), ['key', 'value', 'refresh_lock', 'updated_at']);
  assert.deepEqual([S.upserts[0].key, S.upserts[0].value], ['rp-sync', {}]);
  assert.match(S.upserts[0].refresh_lock, ISO);
});

test('sync: the 60 least recently checked listed servers are read; a database error is a 500 and nothing is fetched', async () => {
  await sync();
  assert.equal(S.queries[0].cols, 'id,cfx_code,source,access,listing_status,last_seen_at,created_at');
  assert.deepEqual(S.queries[0].filters, [['not', 'cfx_code', 'is', null], ['in', 'listing_status', ['active', 'dead']], ['order', 'last_checked_at', { ascending: true, nullsFirst: true }], ['limit', 60]]);
  fresh({ error: true, rows: [row()] });
  const r = await sync();
  assert.deepEqual([r.status, r.json], [500, { ok: false, error: 'db' }]);
  assert.equal(net.log.length, 0);
  fresh({ rows: null });
  assert.deepEqual(noMs((await sync()).json), SYNC_ZERO);
});

test('sync: a live server gets all its live fields; the totals count it as live', async () => {
  fresh({ rows: [row()] });
  net.cfx.abcde1 = server();
  const r = await sync();
  assert.deepEqual(noMs(r.json), { ...SYNC_ZERO, checked: 1, live: 1 });
  assert.equal(r.json.ms, 0);
  assert.equal(S.updates.length, 1);
  assert.equal(S.updates[0].id, 'r1');
  assert.deepEqual(patchOf(), {
    host_name: 'Host One', project_desc: 'Desc', live: true, status: 'ONLINE', online_count: 12, max_players: 64, peak_players: 30, upvotes: 5, resources_count: 3, owner_name: 'Owner', fx_build: 'v1.0.0.9999',
    icon_url: 'https://frontend.cfx-services.net/api/servers/icon/abcde1/3.png', banner_url: null, last_seen_at: iso(NOW - 60_000), locale: 'en-US',
  });
});

test('sync: locale, access and name are only patched when the listing says so', async () => {
  fresh({ rows: [row({ source: 'submitted' })] });
  net.cfx.abcde1 = server({}, { locale: 'nope!', sv_appearAllowlisted: 'true', sv_projectName: 'Renamed' });
  await sync();
  const p = patchOf();
  assert.deepEqual([p.locale, p.access, p.name], [undefined, 'allowlist', 'Renamed']);
  assert.equal('locale' in p, false);
  net.cfx.abcde1 = server();
  fresh({ rows: [row({ source: 'curated', access: 'allowlist' })] });
  net.cfx.abcde1 = server();
  await sync();
  const q = patchOf();
  assert.deepEqual(['locale' in q, 'access' in q, 'name' in q], [true, false, false]);
});

test('sync: a server not seen for 20 minutes is offline with no player count; zero max players is stored as null', async () => {
  fresh({ rows: [row()] });
  net.cfx.abcde1 = server({ lastSeen: iso(NOW - 20 * 60_000), sv_maxclients: 0 });
  const r = await sync();
  assert.deepEqual(noMs(r.json), { ...SYNC_ZERO, checked: 1, offline: 1 });
  assert.deepEqual([patchOf().live, patchOf().status, patchOf().online_count, patchOf().max_players], [false, 'OFFLINE', null, null]);
  fresh({ rows: [row()] });
  net.cfx.abcde1 = server({ lastSeen: iso(NOW - 20 * 60_000 + 1) });
  assert.equal(noMs((await sync()).json).live, 1);
  fresh({ rows: [row()] });
  net.cfx.abcde1 = server({ lastSeen: undefined });
  const never = await sync();
  assert.deepEqual([never.json.offline, patchOf().last_seen_at], [1, null]);
});

test('sync: a dead listing that is live again is revived; one that is still offline stays dead', async () => {
  fresh({ rows: [row({ listing_status: 'dead' })] });
  net.cfx.abcde1 = server();
  const r = await sync();
  assert.deepEqual(noMs(r.json), { ...SYNC_ZERO, checked: 1, live: 1, revived: 1 });
  assert.equal(patchOf().listing_status, 'active');
  fresh({ rows: [row({ listing_status: 'dead' })] });
  net.cfx.abcde1 = server({ lastSeen: iso(NOW - DAY) });
  const s = await sync();
  assert.deepEqual(noMs(s.json), { ...SYNC_ZERO, checked: 1, offline: 1 });
  assert.equal('listing_status' in patchOf(), false);
});

test('sync: a code Cfx.re no longer lists goes offline; after 14 days without a sighting an active listing is marked dead', async () => {
  const cases = [
    [row({ last_seen_at: iso(NOW - DAY) }), false],
    [row({ last_seen_at: iso(NOW - 14 * DAY) }), false],
    [row({ last_seen_at: iso(NOW - 14 * DAY - 1) }), true],
    [row({ last_seen_at: null, created_at: iso(NOW - 20 * DAY) }), true],
    [row({ last_seen_at: null, created_at: iso(NOW - 2 * DAY) }), false],
    [row({ last_seen_at: null, created_at: null }), false],
    [row({ last_seen_at: iso(NOW - 40 * DAY), listing_status: 'dead' }), false],
  ];
  for (const [r, dead] of cases) {
    fresh({ rows: [r] });
    const res = await sync();
    assert.deepEqual(noMs(res.json), { ...SYNC_ZERO, checked: 1, offline: 1, dead: dead ? 1 : 0 }, JSON.stringify(r));
    assert.deepEqual(patchOf(), { live: false, status: 'OFFLINE', online_count: null, ...(dead ? { listing_status: 'dead' } : {}) }, JSON.stringify(r));
  }
});

test('sync: a Cfx.re error counts as an error and the row is left untouched', async () => {
  fresh({ rows: [row(), row({ id: 'r2', cfx_code: 'abcde2' })] });
  net.cfx.abcde1 = 'error';
  net.cfx.abcde2 = 500;
  const r = await sync();
  assert.deepEqual(noMs(r.json), { ...SYNC_ZERO, checked: 2, errors: 2 });
  assert.equal(S.updates.length, 0);
  assert.equal(net.log.length, 4);
});

test('sync: after 45 seconds the remaining rows are skipped without a request', async () => {
  fresh({ rows: [row({ id: 'r1', cfx_code: 'aaaaa1' }), row({ id: 'r2', cfx_code: 'aaaaa2' }), row({ id: 'r3', cfx_code: 'aaaaa3' })] });
  net.cfx.aaaaa1 = net.cfx.aaaaa2 = net.cfx.aaaaa3 = server();
  net.onFetch = () => { clock = 45_001; };
  // 3 rows run through a pool of 6: all start before the first fetch finishes, so the budget is checked at the start of each
  const r = await sync();
  assert.equal(r.json.checked + r.json.skipped_budget, 3);
  clock = 0;
  stubNetwork();
  fresh({ rows: Array.from({ length: 12 }, (_, i) => row({ id: `r${i}`, cfx_code: `bbbb${String.fromCharCode(97 + i)}` })) });
  for (const x of S.rows) net.cfx[x.cfx_code] = server();
  net.delay = 1;
  net.onFetch = () => { clock = 45_001; };
  const big = await sync();
  assert.equal(big.json.checked + big.json.skipped_budget, 12);
  assert.ok(big.json.skipped_budget >= 6, JSON.stringify(big.json));
  assert.equal(net.log.length, big.json.checked);
});

test('sync: at most 6 servers are fetched at the same time, and every row is handled', async () => {
  fresh({ rows: Array.from({ length: 20 }, (_, i) => row({ id: `r${i}`, cfx_code: `cccc${String.fromCharCode(97 + i)}` })) });
  for (const x of S.rows) net.cfx[x.cfx_code] = server();
  net.delay = 2;
  const r = await sync();
  assert.equal(net.maxInflight, 6);
  assert.deepEqual([r.json.checked, r.json.live, S.updates.length], [20, 20, 20]);
  assert.deepEqual(S.updates.map((u) => u.id).sort(), S.rows.map((x) => x.id).sort());
});

// ---------- GET /enrich ----------
test('enrich: the throttle is 600 seconds, and the lock is taken under its own key', async () => {
  fresh({ locks: { 'rp-enrich': iso(NOW - 599_999) } });
  assert.deepEqual((await enrich()).json, { ok: true, skipped: true });
  assert.equal(S.queries.length, 0);
  fresh({ locks: { 'rp-enrich': iso(NOW - 600_000), 'rp-sync': iso(NOW) } });
  assert.equal((await enrich()).json.ok, true);
  assert.equal(S.upserts[0].key, 'rp-enrich');
});

test('enrich: the 20 listed servers with the oldest Discord check are read; a database error is a 500', async () => {
  const r = await enrich();
  assert.deepEqual(noMs(r.json), ENRICH_ZERO);
  assert.equal(S.queries[0].cols, 'id,cfx_code,discord_url');
  assert.deepEqual(S.queries[0].filters, [['eq', 'listing_status', 'active'], ['not', 'cfx_code', 'is', null], ['order', 'discord_checked_at', { ascending: true, nullsFirst: true }], ['limit', 20]]);
  fresh({ error: true });
  const e = await enrich();
  assert.deepEqual([e.status, e.json], [500, { ok: false, error: 'db' }]);
  fresh({ rows: null });
  assert.deepEqual(noMs((await enrich()).json), ENRICH_ZERO);
});

test('enrich: a valid invite refreshes the Discord fields (verified or partnered counts as verified)', async () => {
  fresh({ rows: [row({ id: 'a', discord_url: 'https://discord.gg/good1' }), row({ id: 'b', discord_url: 'discord.com/invite/good2' }), row({ id: 'c', discord_url: 'https://discord.gg/good3' })] });
  net.discord.good1 = invite({ guild: { name: 'G', features: ['VERIFIED'] } });
  net.discord.good2 = invite({ guild: { name: 'G', features: ['PARTNERED'] }, approximate_member_count: undefined, approximate_presence_count: 'x' });
  net.discord.good3 = invite();
  const r = await enrich();
  assert.deepEqual(noMs(r.json), { ...ENRICH_ZERO, checked: 3, valid: 3 });
  const patches = S.updates.map((u) => { const { discord_checked_at, ...rest } = u.patch; assert.match(discord_checked_at, ISO); return [u.id, rest]; });
  assert.deepEqual(patches, [
    ['a', { discord_url: 'https://discord.gg/good1', discord_members: 500, discord_online: 50, discord_verified: true }],
    ['b', { discord_url: 'https://discord.gg/good2', discord_members: null, discord_online: null, discord_verified: true }],
    ['c', { discord_url: 'https://discord.gg/good3', discord_members: 500, discord_online: 50, discord_verified: false }],
  ]);
  assert.equal(net.log.some((u) => u.includes('/single/')), false);
});

test('enrich: an expired invite is replaced by the one the server advertises now', async () => {
  fresh({ rows: [row({ discord_url: 'https://discord.gg/old1' })] });
  net.discord.old1 = 404;
  net.discord.newer = invite();
  net.cfx.abcde1 = server({}, { discord_link: 'https://discord.com/invite/newer' });
  const r = await enrich();
  assert.deepEqual(noMs(r.json), { ...ENRICH_ZERO, checked: 1, valid: 1, replaced: 1 });
  assert.equal(S.updates[0].patch.discord_url, 'https://discord.gg/newer');
  assert.deepEqual(net.log.map((u) => u.replace(/^https:\/\/[^/]+/, '')), ['/api/v10/invites/old1?with_counts=true', '/api/servers/single/abcde1', '/api/v10/invites/newer?with_counts=true']);
});

test('enrich: no invite stored also looks at what the server advertises', async () => {
  fresh({ rows: [row({ discord_url: null })] });
  net.discord.newer = invite();
  net.cfx.abcde1 = server({}, { discord_link: 'discord.gg/newer' });
  const r = await enrich();
  assert.deepEqual(noMs(r.json), { ...ENRICH_ZERO, checked: 1, valid: 1, replaced: 1 });
  assert.equal(net.log[0].includes('/single/abcde1'), true);
});

test('enrich: when nothing better exists the invite is cleared; the same dead invite advertised again is not retried', async () => {
  const cases = [
    ['no listing', 'gone'],
    ['no discord link advertised', server({}, { discord_link: undefined })],
    ['not an invite', server({}, { discord_link: 'https://example.com/x' })],
    ['the same dead invite', server({}, { discord_link: 'https://discord.com/invite/old1' })],
    ['the listing errors', 'error'],
  ];
  for (const [name, cfx] of cases) {
    fresh({ rows: [row({ discord_url: 'https://discord.gg/old1' })] });
    stubNetwork();
    net.discord.old1 = 404;
    net.cfx.abcde1 = cfx === 'gone' ? undefined : cfx;
    const r = await enrich();
    assert.deepEqual(noMs(r.json), { ...ENRICH_ZERO, checked: 1, cleared: 1 }, name);
    const { discord_checked_at, ...rest } = S.updates[0].patch;
    assert.deepEqual(rest, { discord_url: null, discord_members: null, discord_online: null, discord_verified: false }, name);
    assert.equal(net.log.filter((u) => u.includes('/invites/')).length, 1, name);
  }
});

test('enrich: an advertised invite that is dead too clears the link (and is not counted as replaced)', async () => {
  fresh({ rows: [row()] });
  net.discord.old1 = 404;
  net.discord.newer = 404;
  net.cfx.abcde1 = server({}, { discord_link: 'https://discord.gg/newer' });
  const r = await enrich();
  assert.deepEqual(noMs(r.json), { ...ENRICH_ZERO, checked: 1, cleared: 1 });
  assert.equal(S.updates[0].patch.discord_url, null);
});

test('enrich: a Discord error (rate limit, 5xx, network) changes nothing and does not look at the listing', async () => {
  for (const script of [429, 503, 'error']) {
    fresh({ rows: [row()] });
    stubNetwork();
    net.discord.old1 = script;
    const r = await enrich();
    assert.deepEqual(noMs(r.json), { ...ENRICH_ZERO, checked: 1, errors: 1 }, String(script));
    assert.equal(S.updates.length, 0);
    assert.equal(net.log.length, 1);
  }
  fresh({ rows: [row()] });
  stubNetwork();
  net.discord.old1 = 404;
  net.discord.newer = 429;
  net.cfx.abcde1 = server({}, { discord_link: 'https://discord.gg/newer' });
  const r = await enrich();
  assert.deepEqual(noMs(r.json), { ...ENRICH_ZERO, checked: 1, errors: 1 });
  assert.equal(S.updates.length, 0);
});

test('enrich: 400 ms pause after every row (errors included), one row after another', async () => {
  fresh({ rows: [row({ id: 'a', discord_url: 'https://discord.gg/good1' }), row({ id: 'b', discord_url: 'https://discord.gg/bad1' }), row({ id: 'c', discord_url: 'https://discord.gg/bad2' })] });
  net.discord.good1 = invite();
  net.discord.bad1 = 429;
  net.discord.bad2 = 404;
  const r = await enrich();
  assert.deepEqual(noMs(r.json), { ...ENRICH_ZERO, checked: 3, valid: 1, errors: 1, cleared: 1 });
  assert.deepEqual(net.sleeps.filter((ms) => ms === 400), [400, 400, 400]);
  assert.equal(net.maxInflight, 1);
});

test('enrich: after 45 seconds the loop stops before the next row', async () => {
  fresh({ rows: [row({ id: 'a', discord_url: 'https://discord.gg/good1' }), row({ id: 'b', discord_url: 'https://discord.gg/good2' }), row({ id: 'c', discord_url: 'https://discord.gg/good3' })] });
  net.discord.good1 = net.discord.good2 = net.discord.good3 = invite();
  net.onFetch = (u) => { if (u.includes('good2')) clock = 45_001; };
  const r = await enrich();
  assert.deepEqual(noMs(r.json), { ...ENRICH_ZERO, checked: 2, valid: 2 });
  assert.equal(r.json.ms, 45_001);
  assert.deepEqual(S.updates.map((u) => u.id), ['a', 'b']);
  assert.equal(net.sleeps.filter((ms) => ms === 400).length, 2);
});

test('enrich: counters add up when the outcomes are mixed', async () => {
  fresh({ rows: [row({ id: 'a', discord_url: 'https://discord.gg/good1' }), row({ id: 'b', discord_url: 'https://discord.gg/old1', cfx_code: 'abcde2' }), row({ id: 'c', discord_url: 'https://discord.gg/old2', cfx_code: 'abcde3' }), row({ id: 'd', discord_url: 'https://discord.gg/err1' })] });
  net.discord.good1 = invite();
  net.discord.old1 = 404; net.discord.old2 = 404; net.discord.err1 = 500; net.discord.fresh1 = invite();
  net.cfx.abcde2 = server({}, { discord_link: 'https://discord.gg/fresh1' });
  const r = await enrich();
  assert.deepEqual(noMs(r.json), { ok: true, checked: 4, valid: 2, replaced: 1, cleared: 1, errors: 1 });
  assert.deepEqual(S.updates.map((u) => u.id), ['a', 'b', 'c']);
});
