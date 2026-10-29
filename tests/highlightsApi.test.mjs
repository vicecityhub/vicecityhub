// Network-facing parts of the Highlights board, run against fake XHR / fetch / Supabase.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { bundleTs } from './helpers/bundleTs.mjs';

const m = await bundleTs(`
  export * from './src/components/highlights/storage';
  export * from './src/components/highlights/deviceLogin';
  export * from './src/components/highlights/uploadFlow';
  export { supa } from './src/lib/SupabaseClient';
`);

class FakeXHR {
  static next = {};
  constructor() { this.headers = {}; this.upload = {}; FakeXHR.last = this; }
  open(method, url) { this.method = method; this.url = url; }
  setRequestHeader(k, v) { this.headers[k] = v; }
  send(body) {
    this.body = body;
    const n = FakeXHR.next;
    queueMicrotask(() => {
      if (n.progress && this.upload.onprogress) this.upload.onprogress({ lengthComputable: true, loaded: n.progress[0], total: n.progress[1] });
      if (n.networkError) return this.onerror();
      this.status = n.status ?? 200; this.responseText = n.responseText ?? '';
      this.onload();
    });
  }
}
globalThis.XMLHttpRequest = FakeXHR;
const blob = new Blob(['x']);

beforeEach(() => { FakeXHR.next = {}; });

test('xhrUpload: resolves on 2xx and sends auth headers to the bucket path', async () => {
  await m.xhrUpload('u1/a.png', blob, 'tok');
  const x = FakeXHR.last;
  assert.equal(x.method, 'POST');
  assert.match(x.url, /\/storage\/v1\/object\/highlights\/u1\/a\.png$/);
  assert.equal(x.headers.Authorization, 'Bearer tok');
  assert.equal(x.headers['x-upsert'], 'false');
  assert.ok(x.headers.apikey);
  assert.equal(x.body.get('cacheControl'), '31536000');
});

test('xhrUpload: reports progress only when asked and only when computable', async () => {
  const seen = [];
  FakeXHR.next = { progress: [25, 100] };
  await m.xhrUpload('p', blob, 't', (p) => seen.push(p));
  assert.deepEqual(seen, [0.25]);
  FakeXHR.next = { progress: [25, 100] };
  await m.xhrUpload('p', blob, 't');
  assert.equal(FakeXHR.last.upload.onprogress, undefined);
});

test('xhrUpload: rejects with the server message, a generic one, or a network error', async () => {
  FakeXHR.next = { status: 413, responseText: '{"message":"too big"}' };
  await assert.rejects(m.xhrUpload('p', blob, 't'), /too big/);
  FakeXHR.next = { status: 502, responseText: '<html>' };
  await assert.rejects(m.xhrUpload('p', blob, 't'), /upload failed \(502\)/);
  FakeXHR.next = { networkError: true };
  await assert.rejects(m.xhrUpload('p', blob, 't'), /network error during upload/);
});

function stubFetch(handler) {
  const calls = [];
  globalThis.fetch = async (url, init) => { calls.push({ url, init }); return handler(url, init); };
  return calls;
}
const res = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => { if (body === undefined) throw new Error('no body'); return body; } });

test('pollDeviceLogin: approved signs in with the magic-link hash', async () => {
  const calls = stubFetch(() => res(200, { token_hash: 'th' }));
  let otp;
  m.supa.auth.verifyOtp = async (a) => { otp = a; return { error: null }; };
  assert.equal(await m.pollDeviceLogin('sec'), 'approved');
  assert.deepEqual(otp, { token_hash: 'th', type: 'magiclink' });
  assert.match(calls[0].url, /\/device-login\/poll$/);
  assert.equal(calls[0].init.body, '{"secret":"sec"}');
});

test('pollDeviceLogin: other outcomes', async () => {
  m.supa.auth.verifyOtp = async () => ({ error: { message: 'bad' } });
  stubFetch(() => res(200, { token_hash: 'th' }));
  assert.equal(await m.pollDeviceLogin('s'), 'error');
  stubFetch(() => res(410, {}));
  assert.equal(await m.pollDeviceLogin('s'), 'expired');
  stubFetch(() => res(202, {}));
  assert.equal(await m.pollDeviceLogin('s'), 'retry');
  stubFetch(() => { throw new Error('offline'); });
  assert.equal(await m.pollDeviceLogin('s'), 'retry');
  stubFetch(() => res(200, undefined));
  assert.equal(await m.pollDeviceLogin('s'), 'retry');
});

test('requestDeviceCode: returns the body, throws on a failed start', async () => {
  stubFetch(() => res(200, { code: 'ABCD-2345', secret: 's', expires_in: 600 }));
  assert.deepEqual(await m.requestDeviceCode(), { code: 'ABCD-2345', secret: 's', expires_in: 600 });
  stubFetch(() => res(500, {}));
  await assert.rejects(m.requestDeviceCode(), /start failed/);
});

test('callDeviceLogin: bearer token from the session, body survives a non-JSON reply', async () => {
  m.supa.auth.getSession = async () => ({ data: { session: { access_token: 'AT' } } });
  const calls = stubFetch(() => res(400, undefined));
  assert.deepEqual(await m.callDeviceLogin('/inspect', { code: 'X' }), { status: 400, body: {} });
  assert.equal(calls[0].init.headers.Authorization, 'Bearer AT');
  m.supa.auth.getSession = async () => ({ data: { session: null } });
  stubFetch(() => res(200, { device: 'PS5' }));
  await m.callDeviceLogin('/approve', {});
});

// ---------- postHighlight ----------

function fakeSupabase({ insertError = null, session = { access_token: 'AT' } } = {}) {
  const log = { inserted: null, removed: null };
  m.supa.auth.getSession = async () => ({ data: { session } });
  m.supa.from = (table) => ({ insert: async (row) => { log.inserted = { table, row }; return { error: insertError }; } });
  Object.defineProperty(m.supa, 'storage', { configurable: true, value: { from: () => ({ remove: async (paths) => { log.removed = paths; } }) } });
  return log;
}
const imageFile = { name: 'My Shot.png', type: 'image/png', size: 1, slice() { return blob; } };
const base = { userId: 'u1', file: imageFile, title: 'Nice', game: 'GTA V', platform: 'ps5', onProgress() {} };

test('postHighlight: image goes up and is recorded without a poster', async () => {
  const log = fakeSupabase();
  await m.postHighlight(base);
  assert.equal(log.inserted.table, 'highlights');
  assert.equal(log.inserted.row.kind, 'image');
  assert.equal(log.inserted.row.poster_path, null);
  assert.match(log.inserted.row.media_path, /^u1\/\d+-my-shot\.png$/);
  assert.deepEqual([log.inserted.row.title, log.inserted.row.game, log.inserted.row.platform], ['Nice', 'GTA V', 'ps5']);
  assert.equal(log.removed, null);
});

test('postHighlight: an empty file type is repaired from the extension', async () => {
  fakeSupabase();
  let sliced;
  const f = { name: 'clip.webm', type: '', size: 7, slice: (a, b, t) => { sliced = [a, b, t]; return blob; } };
  // video: the poster step needs a DOM, which Node does not have: makePoster rejects and the whole post fails loudly
  await assert.rejects(m.postHighlight({ ...base, file: f }));
  assert.deepEqual(sliced, [0, 7, 'video/webm']);
});

test('postHighlight: failed insert removes the upload and explains the daily limit', async () => {
  const log = fakeSupabase({ insertError: { message: 'daily_limit exceeded' } });
  await assert.rejects(m.postHighlight(base), /Daily limit reached: 10 uploads per 24 hours/);
  assert.equal(log.removed.length, 1);
  assert.match(log.removed[0], /^u1\//);
});

test('postHighlight: no session means no upload', async () => {
  fakeSupabase({ session: null });
  FakeXHR.last = null;
  await assert.rejects(m.postHighlight(base), /Your session expired\. Sign in again\./);
  assert.equal(FakeXHR.last, null);
});

test('postHighlight: upload error is passed through and nothing is recorded', async () => {
  const log = fakeSupabase();
  FakeXHR.next = { status: 403, responseText: '{"message":"RLS"}' };
  await assert.rejects(m.postHighlight(base), /RLS/);
  assert.equal(log.inserted, null);
});
