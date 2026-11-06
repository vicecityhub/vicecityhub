// Load supabase/functions/rp-servers/index.ts in Node: the esm.sh client and the Deno global are replaced by fakes,
// so the real request handler (sync, enrich, health, lookup, submit) runs against a scripted fake database and fetch.
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fakeBuilder } from './loadAlley.mjs';

const ROOT = resolve(import.meta.dirname, '..', '..');
const STUBS = { 'https://esm.sh/@supabase/supabase-js@2.45.4': 'export const createClient = () => globalThis.__rp.db;' };

export async function loadRpServers() {
  const dir = mkdtempSync(join(tmpdir(), 'vch-rp-'));
  const out = join(dir, 'rp.mjs');
  const stubPlugin = {
    name: 'esm-sh-stubs',
    setup(b) {
      b.onResolve({ filter: /^https:\/\/esm\.sh\// }, (a) => ({ path: a.path, namespace: 'stub' }));
      b.onLoad({ filter: /.*/, namespace: 'stub' }, (a) => ({ contents: STUBS[a.path], loader: 'js' }));
    },
  };
  try {
    await build({ entryPoints: [join(ROOT, 'supabase/functions/rp-servers/index.ts')], bundle: true, platform: 'node', format: 'esm', outfile: out, plugins: [stubPlugin], logLevel: 'error' });
    const state = { route: () => ({ data: null, error: null }), handler: null };
    state.db = { from: (t) => fakeBuilder(t, (c) => state.route(c)) };
    globalThis.__rp = state;
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
