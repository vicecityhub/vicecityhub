// Load supabase/functions/alley/index.ts in Node: esm.sh imports and the Deno global are replaced by fakes,
// so the real request handler can be driven with fake Requests against a scripted fake database.
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(import.meta.dirname, '..', '..');

const STUBS = {
  'https://esm.sh/@supabase/supabase-js@2.45.4': 'export const createClient = () => globalThis.__alley.db;',
  'https://esm.sh/ethers@6.13.2': 'export const verifyMessage = (text, sig) => globalThis.__alley.recover(text, sig);',
  'https://esm.sh/tweetnacl@1.0.3': 'export default { sign: { detached: { verify: (m, s, p) => globalThis.__alley.naclVerify(m, s, p) } } };',
};

/** One chainable, awaitable query. `route(call)` decides the result: { data, error, count }. */
export function fakeBuilder(table, route) {
  const call = { table, op: 'select', filters: [], cols: null, opts: null, payload: null, single: null };
  const run = () => Promise.resolve(route(call));
  const b = {
    select(cols, opts) { call.cols = cols; call.opts = opts || null; return b; },
    insert(p) { call.op = 'insert'; call.payload = p; return b; },
    update(p) { call.op = 'update'; call.payload = p; return b; },
    upsert(p, opts) { call.op = 'upsert'; call.payload = p; call.opts = opts || null; return b; },
    delete() { call.op = 'delete'; return b; },
    maybeSingle() { call.single = 'maybeSingle'; return run(); },
    single() { call.single = 'single'; return run(); },
    then(res, rej) { return run().then(res, rej); },
  };
  for (const f of ['eq', 'gte', 'gt', 'lt', 'in', 'not', 'order', 'limit']) b[f] = (...a) => { call.filters.push([f, ...a]); return b; };
  return b;
}

export async function loadAlley() {
  const dir = mkdtempSync(join(tmpdir(), 'vch-alley-'));
  const out = join(dir, 'alley.mjs');
  const stubPlugin = {
    name: 'esm-sh-stubs',
    setup(b) {
      b.onResolve({ filter: /^https:\/\/esm\.sh\// }, (a) => ({ path: a.path, namespace: 'stub' }));
      b.onLoad({ filter: /.*/, namespace: 'stub' }, (a) => ({ contents: STUBS[a.path], loader: 'js' }));
    },
  };
  try {
    await build({ entryPoints: [join(ROOT, 'supabase/functions/alley/index.ts')], bundle: true, platform: 'node', format: 'esm', outfile: out, plugins: [stubPlugin], logLevel: 'error' });
    const state = { route: () => ({ data: null, error: null }), recover: () => '', naclVerify: () => false, handler: null };
    state.db = { from: (t) => fakeBuilder(t, (c) => state.route(c)) };
    globalThis.__alley = state;
    globalThis.Deno = {
      env: { get: (k) => ({ SUPABASE_URL: 'https://proj.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'service-key' }[k]) },
      serve: (h) => { state.handler = h; },
    };
    await import(pathToFileURL(out).href);
    return state;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
