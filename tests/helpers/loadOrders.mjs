// Load supabase/functions/agent-api/orders.ts in Node: the Supabase client, the Deno global and the catalog are fakes,
// so createOrder & co. can be driven directly against a scripted database.
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fakeBuilder } from './loadAlley.mjs';

const ROOT = resolve(import.meta.dirname, '..', '..');

export async function loadOrders() {
  const dir = mkdtempSync(join(tmpdir(), 'vch-orders-'));
  const out = join(dir, 'orders.mjs');
  const plugin = {
    name: 'orders-stubs',
    setup(b) {
      b.onResolve({ filter: /^https:\/\/esm\.sh\// }, (a) => ({ path: a.path, namespace: 'stub' }));
      b.onResolve({ filter: /(^|\/)catalog\.ts$/ }, (a) => ({ path: a.path, namespace: 'catalog-stub' }));
      // orders.ts sees the real verify.ts helpers, except verifyCrypto (network) which tests script via state.verifyCrypto
      b.onResolve({ filter: /(^|\/)verify\.ts$/ }, (a) => (/orders(\.orig)?\.ts$/.test(a.importer)
        ? { path: join(ROOT, 'supabase/functions/agent-api/verify.ts'), namespace: 'verify-stub' } : undefined));
      b.onLoad({ filter: /.*/, namespace: 'verify-stub' }, (a) => ({
        contents: `export * from ${JSON.stringify(a.path)}; export const verifyCrypto = (a) => globalThis.__orders.verifyCrypto(a);`,
        loader: 'js', resolveDir: join(ROOT, 'supabase/functions/agent-api'),
      }));
      b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export const createClient = () => globalThis.__orders.db;', loader: 'js' }));
      b.onLoad({ filter: /.*/, namespace: 'catalog-stub' }, () => ({
        contents: 'export const findItem = (s) => globalThis.__orders.findItem(s); export const resolveLine = (s) => globalThis.__orders.resolveLine(s);',
        loader: 'js',
      }));
    },
  };
  try {
    await build({ entryPoints: [join(ROOT, 'supabase/functions/agent-api', process.env.ORDERS_FILE || 'orders.ts')], bundle: true, platform: 'node', format: 'esm', outfile: out, plugins: [plugin], logLevel: 'error' });
    const env = { SUPABASE_URL: 'https://proj.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'service-key' };
    const state = { route: () => ({ data: null, error: null }), resolveLine: async () => ({ reason: 'unknown_sku' }), findItem: async () => null, verifyCrypto: async () => ({ state: 'error', detail: 'unscripted' }), env };
    state.db = { from: (t) => fakeBuilder(t, (c) => state.route(c)), rpc: async () => ({ data: true, error: null }) };
    globalThis.__orders = state;
    globalThis.Deno = { env: { get: (k) => env[k] } };
    state.mod = await import(pathToFileURL(out).href);
    return state;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
