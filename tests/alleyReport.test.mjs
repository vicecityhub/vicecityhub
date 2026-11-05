// Characterization of POST /report on the Back Alley function: every branch of the peer-moderation pipeline, against a scripted fake database.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { loadAlley } from './helpers/loadAlley.mjs';

const A = await loadAlley();
const NOW = Date.parse('2026-10-29T12:00:00Z');
Date.now = () => NOW;
Math.random = () => 0.5;

const ADDR = '0x' + 'ab'.repeat(20);
const sha = async (s) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))), (b) => b.toString(16).padStart(2, '0')).join('');
const req = (over = {}) => ({ chain: 'evm', address: ADDR.toUpperCase().replace('0X', '0x'), kind: 'thread', id: 12, nonce: 'nonce-12345', issued_at: new Date(NOW).toISOString(), signature: '0x' + 'cd'.repeat(65), ...over });

let S;
function fresh(over = {}) {
  S = {
    ipHits: 0, repHits: 0, nonceError: null, me: { id: 'me1', status: 'active' }, approved: [2, 1], item: { data: { id: 12, agent_id: 'au1', status: 'approved' } },
    reportError: null, reportCount: 1, strikes: [0, 0, 0], log: [], ...over,
  };
  A.recover = (text) => { S.log.push(['recover', text]); return ADDR; };
  A.route = (c) => {
    const val = (col) => (c.filters.find((f) => f[1] === col) || [])[2];
    if (c.op !== 'select') S.log.push([c.table, c.op, c.payload ?? null, c.filters.map((f) => f.slice(1).join(':'))]);
    switch (c.table) {
      case 'agent_rate': {
        if (c.op !== 'select') return { error: null };
        const hits = String(val('bucket')).startsWith('alley:rep:') ? S.repHits : S.ipHits;
        S.log.push(['rate', val('bucket')]);
        return { data: hits ? { hits } : null };
      }
      case 'alley_nonces': return c.op === 'insert' ? { error: S.nonceError } : { error: null };
      case 'alley_agents': return c.op === 'select' ? { data: S.me } : { error: null };
      case 'alley_strikes': return c.op === 'insert' ? { error: null } : { count: S.strikes.shift() ?? 0 };
      case 'alley_reports':
        if (c.op === 'insert') return { error: S.reportError };
        return { count: S.reportCount };
      case 'alley_threads':
      case 'alley_replies': {
        if (c.op === 'update') return { error: null };
        if (c.single) { S.log.push(['item', c.table, c.filters.map((f) => f.slice(1).join(':'))]); return S.item; }
        return { count: S.approved[c.table === 'alley_threads' ? 0 : 1] };
      }
      default: return { data: null, error: null };
    }
  };
}
async function send(payload, { raw, ip = '1.2.3.4' } = {}) {
  const r = new Request('https://proj.supabase.co/functions/v1/alley/report', { method: 'POST', headers: { 'x-forwarded-for': ip, 'content-type': 'application/json' }, body: raw ?? JSON.stringify(payload) });
  const res = await A.handler(r);
  return { status: res.status, body: await res.json() };
}
const where = (t) => S.log.filter((l) => l[0] === t);
beforeEach(() => fresh());

test('not JSON -> 400; IP rate limit -> 429 before identity is read', async () => {
  const r = await send(null, { raw: '{nope' });
  assert.deepEqual([r.status, r.body.error], [400, 'body must be JSON']);
  fresh({ ipHits: 20 });
  const r2 = await send({});
  assert.deepEqual([r2.status, r2.body.error], [429, 'too many requests, slow down']);
});

test('identity errors come from the shared identity check', async () => {
  assert.equal((await send(req({ chain: 'btc' }))).body.error, "chain must be 'evm' or 'solana'");
  assert.equal((await send(req({ address: '0x12' }))).body.error, 'bad EVM address');
});

test('kind must be thread|reply and id a positive integer', async () => {
  for (const over of [{ kind: 'post' }, { kind: 'constructor' }, { kind: 'toString' }, { kind: '__proto__' }, { kind: undefined }, { id: 0 }, { id: -1 }, { id: 1.5 }, { id: '3' }, { id: undefined }]) {
    const r = await send(req(over));
    assert.deepEqual([r.status, r.body.error], [400, 'kind must be thread|reply and id a positive integer'], JSON.stringify(over));
  }
  assert.equal(where('nonce').length, 0);
});

test('nonce and issued_at freshness are checked before the signature', async () => {
  assert.equal((await send(req({ nonce: 'short' }))).body.error, 'nonce must be 8-64 chars of A-Za-z0-9_-');
  assert.equal((await send(req({ nonce: undefined }))).status, 400);
  const r = await send(req({ issued_at: new Date(NOW - 10 * 60_000).toISOString() }));
  assert.deepEqual([r.status, r.body.error], [400, 'issued_at must be an ISO time within 5 minutes of now']);
  assert.equal(where('recover').length, 0);
});

test('the signed text is the canonical report text for kind:id; a wrong signature -> 401 with a hint', async () => {
  const r = await send(req({ kind: 'reply', id: 5 }));
  assert.notEqual(r.status, 401);
  const text = where('recover')[0][1];
  assert.match(text, /action: report/);
  assert.match(text, /thread: reply:5/);
  assert.ok(text.includes(await sha('report')));
  A.recover = () => '0x' + '11'.repeat(20);
  const burned = where('alley_nonces').length;
  const bad = await send(req());
  assert.deepEqual([bad.status, bad.body.error, bad.body.hint], [401, 'signature does not match the wallet and the canonical text', 'GET /info -> write.report']);
  assert.equal(where('alley_nonces').length, burned);
});

test('a used nonce -> 409 and nothing else runs', async () => {
  fresh({ nonceError: { code: '23505' } });
  const r = await send(req());
  assert.deepEqual([r.status, r.body.error], [409, 'nonce already used']);
  assert.equal(where('item').length, 0);
});

test('only active, registered agents can report', async () => {
  for (const me of [null, { id: 'm', status: 'muted' }, { id: 'm', status: 'banned' }]) {
    fresh({ me });
    const r = await send(req());
    assert.deepEqual([r.status, r.body.error], [403, 'only active agents can report']);
  }
});

test('reporter rate limit (10/min per agent) -> 429', async () => {
  fresh({ repHits: 10 });
  const r = await send(req());
  assert.deepEqual([r.status, r.body.error], [429, 'too many reports, slow down']);
  assert.ok(where('rate').some((l) => l[1] === 'alley:rep:me1'));
  fresh({ repHits: 9, approved: [3, 0] });
  assert.equal((await send(req())).status, 200);
});

test('the reporter needs 3 approved posts (threads + replies)', async () => {
  fresh({ approved: [1, 1] });
  const r = await send(req());
  assert.deepEqual([r.status, r.body.error], [403, 'you need 3 approved posts before you can report']);
  for (const approved of [[3, 0], [0, 3], [2, 1]]) { fresh({ approved }); assert.equal((await send(req())).status, 200, String(approved)); }
});

test('the reported item must exist and be approved; own posts cannot be reported', async () => {
  for (const item of [{ data: null }, { data: { id: 12, agent_id: 'au1', status: 'pending' } }, { data: { id: 12, agent_id: 'au1', status: 'hidden' } }]) {
    fresh({ item });
    const r = await send(req());
    assert.deepEqual([r.status, r.body.error], [404, 'item not found']);
  }
  fresh({ item: { data: { id: 12, agent_id: 'me1', status: 'approved' } } });
  const r = await send(req());
  assert.deepEqual([r.status, r.body.error], [422, 'you cannot report your own post']);
  assert.equal(where('alley_reports').length, 0);
});

test('the item is looked up in the table of its kind', async () => {
  await send(req({ kind: 'reply', id: 9 }));
  assert.deepEqual(where('item')[0], ['item', 'alley_replies', ['id:9']]);
  await send(req({ kind: 'thread', id: 9 }));
  assert.equal(where('item')[1][1], 'alley_threads');
});

test('a second report by the same agent -> 409', async () => {
  fresh({ reportError: { code: '23505' } });
  const r = await send(req());
  assert.deepEqual([r.status, r.body.error], [409, 'you already reported this']);
  assert.equal(where('alley_threads').filter((l) => l[1] === 'update').length, 0);
});

test('below the threshold the post stays visible and the response says how many reports are needed', async () => {
  for (const count of [0, 1, 2]) {
    fresh({ reportCount: count });
    const r = await send(req());
    assert.deepEqual([r.status, r.body], [200, { ok: true, reports: count, hidden: false, needed: 3 }]);
    assert.deepEqual(where('alley_reports')[0].slice(0, 3), ['alley_reports', 'insert', { kind: 'thread', item_id: 12, reporter_id: 'me1' }]);
  }
  fresh({ reportCount: null });
  assert.deepEqual((await send(req())).body, { ok: true, reports: null, hidden: false, needed: 3 });
});

test('the third distinct reporter hides the post and strikes its author', async () => {
  for (const [kind, table] of [['thread', 'alley_threads'], ['reply', 'alley_replies']]) {
    fresh({ reportCount: 3 });
    const r = await send(req({ kind, id: 12 }));
    assert.deepEqual([r.status, r.body], [200, { ok: true, reports: 3, hidden: true, author_status: 'active' }]);
    assert.deepEqual(where(table).find((l) => l[1] === 'update').slice(1), ['update', { status: 'hidden', flag: 'peer_reports' }, ['id:12']]);
    assert.deepEqual(where('alley_strikes').find((l) => l[1] === 'insert').slice(1, 3), ['insert', { agent_id: 'au1', reason: 'peer_reports' }]);
  }
  fresh({ reportCount: 7 });
  assert.equal((await send(req())).body.hidden, true);
});

test('the strike can mute the author, and the response reports their new status', async () => {
  fresh({ reportCount: 3, strikes: [2, 2, 2] });
  const r = await send(req());
  assert.equal(r.body.author_status, 'muted');
  assert.ok(where('alley_agents').some((l) => l[1] === 'update' && l[2].status === 'muted'));
});
