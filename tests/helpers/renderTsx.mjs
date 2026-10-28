// Server-render a React component from a .tsx file for characterization tests (no browser needed).
// esbuild ships with Vite; effects never run on the server, so the markup is the component's initial state.
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(import.meta.dirname, '..', '..');

export async function renderTsx(file, props = {}, children = '') {
  const dir = mkdtempSync(join(tmpdir(), 'vch-ssr-'));
  const out = join(dir, 'entry.mjs');
  try {
    await build({
      stdin: {
        contents: `
          import React from 'react';
          import { renderToStaticMarkup } from 'react-dom/server';
          import Comp from ${JSON.stringify(resolve(ROOT, file))};
          export default (props, children) => renderToStaticMarkup(React.createElement(Comp, props, children));`,
        resolveDir: ROOT,
        loader: 'js',
      },
      bundle: true, platform: 'node', format: 'esm', outfile: out, nodePaths: [join(ROOT, 'node_modules')],
      jsx: 'automatic', logLevel: 'error',
      define: { 'import.meta.env': '{"BASE_URL":"/vicecityhub/","VITE_SUPABASE_URL":"","VITE_SUPABASE_ANON_KEY":""}' },
      banner: { js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);" },
    });
    const mod = await import(pathToFileURL(out).href);
    return mod.default(props, children);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
