// Bundle a TypeScript module (and its imports, extension-less like Vite) so node:test can import it.
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(import.meta.dirname, '..', '..');

export async function bundleTs(entrySource) {
  const dir = mkdtempSync(join(tmpdir(), 'vch-ts-'));
  const out = join(dir, 'entry.mjs');
  try {
    await build({
      stdin: { contents: entrySource, resolveDir: ROOT, loader: 'ts' },
      bundle: true, platform: 'node', format: 'esm', outfile: out, nodePaths: [join(ROOT, 'node_modules')], logLevel: 'error',
      banner: { js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);" },
    });
    return await import(pathToFileURL(out).href);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
